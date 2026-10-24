// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Note entry and keyboard dispatch: typing frets (one and two digits), placing a note
 * (it sounds), deleting one note or every note in the loop range, moving the cursor across
 * beats, bars and strings, and which keys the document handler takes (and from where).
 * Written against the old `assets/js/appManager.ts` before it became `noteEntry` and
 * `keyboardDispatch`; the snapshots are unchanged.
 */

const played = vi.hoisted(() => [] as unknown[][])
const modalOpen = vi.hoisted(() => ({ value: false }))

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/audio/samplePlayer', () => ({
  samplePlayer: {
    playFret: (...args: unknown[]) => {
      played.push([args[0], args[2], args[3], args[9]])
      return null
    },
  },
}))
vi.mock('../src/services/playback', () => {
  const stub = {
    togglePlayback: vi.fn(),
    setPlayPosition: vi.fn(),
    adaptToLoopChange: vi.fn(),
    jumpToPosition: vi.fn(),
  }
  return { default: stub, playback: stub }
})
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () => ({
  modalManager: { isAnyModalOpen: () => modalOpen.value, getHandler: vi.fn(), isModalOpen: () => false },
}))

type SongType = (typeof import('../src/stores/song'))['default']
let Song: SongType
let selection: typeof import('../src/stores/selectionState')
let range: typeof import('../src/services/editor/rangeSelection')
let undo: (typeof import('../src/services/editor/editCommands'))['undoHistory']
let playback: { togglePlayback: ReturnType<typeof vi.fn> }
let bus: (typeof import('../src/utils/typedEventBus'))['typedEventBus']
let api: {
  enterFretDigit: (digit: number) => boolean
  placeNote: (blockId: number, beatId: number, string: number, fret: number) => void
  deleteSelectedNotes: () => void
  moveSelection: (direction: 'left' | 'right' | 'up' | 'down') => void
  hasExplicitNoteSelection: () => boolean
  keyDown: (event: KeyboardEvent) => void
}

const moves: string[] = []

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  Song = (await import('../src/stores/song')).default
  selection = await import('../src/stores/selectionState')
  range = await import('../src/services/editor/rangeSelection')
  undo = (await import('../src/services/editor/editCommands')).undoHistory
  playback = (await import('../src/services/playback')).default as never
  bus = (await import('../src/utils/typedEventBus')).typedEventBus
  const entry = await import('../src/services/editor/noteEntry')
  const { handleKeyDown } = await import('../src/services/editor/keyboardDispatch')
  api = {
    enterFretDigit: entry.enterFretDigit,
    placeNote: (blockId, beatId, string, fret) => entry.placeNote(0, blockId, 0, beatId, string, fret),
    deleteSelectedNotes: entry.deleteSelectedNotes,
    moveSelection: entry.moveSelection,
    hasExplicitNoteSelection: entry.hasExplicitNoteSelection,
    keyDown: handleKeyDown,
  }
  Song.initEmptySong()
  undo.clear()
  range.clearRange()
  played.length = 0
  moves.length = 0
  modalOpen.value = false
  playback.togglePlayback.mockClear()
  bus.off?.('navigation.setClickedPos')
  bus.on('navigation.setClickedPos', (pos) => {
    moves.push(`${pos.blockId}:${pos.beatId}:${pos.string}`)
    Object.assign(selection.selectionState.cursor, pos)
  })
})

function select(blockId: number, beatId: number, string: number): void {
  Object.assign(selection.selectionState.cursor, { trackId: 0, blockId, voiceId: 0, beatId, string })
  selection.selectionState.hasExplicitSelection = true
}

function frets(blockId: number): string {
  return Song.measures[0][blockId][0]
    .map(
      (beat) =>
        `${beat.duration}:${Array.from(beat.notes, (note) => (note == null ? '.' : note.fret)).join('')}`,
    )
    .join(' ')
}

function key(init: KeyboardEventInit, target?: EventTarget): { event: KeyboardEvent; taken: boolean } {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  if (target) Object.defineProperty(event, 'target', { value: target })
  api.keyDown(event)
  return { event, taken: event.defaultPrevented }
}

describe('note entry', () => {
  it('types frets only with an explicit note selection, two quick digits make one fret', () => {
    select(0, 0, 0)
    selection.selectionState.hasExplicitSelection = false
    expect(api.hasExplicitNoteSelection()).toBe(false)
    expect(api.enterFretDigit(3)).toBe(false)

    select(0, 0, 0)
    expect(api.enterFretDigit(1)).toBe(true)
    vi.advanceTimersByTime(200)
    api.enterFretDigit(2)
    vi.advanceTimersByTime(2000)
    api.enterFretDigit(5)
    select(0, 1, 2)
    api.enterFretDigit(7)
    expect([frets(0), played]).toMatchSnapshot()
    expect(undo.peek()?.label).toBeDefined()
  })

  it('places a note on a rest and sounds it', () => {
    api.placeNote(1, 0, 4, 9)
    expect([frets(1), played]).toMatchSnapshot()
  })

  it('deletes the note at the cursor, or every note in the loop range in one step', () => {
    api.placeNote(0, 0, 0, 1)
    api.placeNote(0, 1, 2, 2)
    api.placeNote(1, 0, 3, 3)
    api.placeNote(1, 1, 1, 4)
    select(0, 0, 0)
    api.deleteSelectedNotes()
    const afterOne = [frets(0), frets(1)]

    range.startRange(0, 0, 0, 1)
    range.extendRange(0, 1, 0, 0)
    range.applyRangeAsLoop()
    const steps = undo.peek()
    api.deleteSelectedNotes()
    const afterRange = [frets(0), frets(1)]
    undo.undo()
    expect({
      afterOne,
      afterRange,
      oneStep: undo.peek() === steps,
      undone: [frets(0), frets(1)],
    }).toMatchSnapshot()
  })

  it('moves across beats, bars and strings and stops at the edges', () => {
    select(0, 0, 0)
    api.moveSelection('left')
    api.moveSelection('down')
    api.moveSelection('up')
    for (let i = 0; i < 9; i += 1) api.moveSelection('right')
    api.moveSelection('left')
    for (let i = 0; i < 6; i += 1) api.moveSelection('up')
    expect(moves).toMatchSnapshot()
  })
})

describe('keyboard dispatch', () => {
  it('takes the shortcut keys and leaves the rest', () => {
    select(0, 0, 1)
    const results = {
      digit: key({ key: '4' }).taken,
      arrow: key({ key: 'ArrowRight' }).taken,
      letter: key({ key: 'q', code: 'KeyQ' }).taken,
      unbound: key({ key: 'x', code: 'KeyX' }).taken,
      space: key({ key: ' ', code: 'Space' }).taken,
      spaceRepeat: key({ key: ' ', code: 'Space', repeat: true }).taken,
      toggles: playback.togglePlayback.mock.calls.length,
    }
    expect({ results, moves, bar: frets(0) }).toMatchSnapshot()
  })

  it('ignores keys already handled, typed into fields, or undo while a dialog is open', () => {
    select(0, 0, 1)
    const handled = new KeyboardEvent('keydown', { key: '5', cancelable: true })
    handled.preventDefault()
    api.keyDown(handled)
    const input = document.createElement('input')
    const typed = key({ key: '6' }, input).taken
    const spaceOnButton = key({ key: ' ', code: 'Space' }, document.createElement('button')).taken
    api.placeNote(0, 0, 1, 2)
    modalOpen.value = true
    const undoInDialog = key({ key: 'z', code: 'KeyZ', ctrlKey: true }).taken
    modalOpen.value = false
    const undoOutside = key({ key: 'z', code: 'KeyZ', ctrlKey: true }).taken
    expect({ typed, spaceOnButton, undoInDialog, undoOutside, bar: frets(0) }).toMatchSnapshot()
  })
})
