// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Big win 8 through the real key dispatcher: selecting with Shift+arrows and Ctrl+A, rhythm
 * keys (dot, tuplet, rest, tie, insert/delete beat), transposing, cut/paste at the cursor,
 * pasting as new bars, and padding short bars on load. Each edit is one undo step.
 */

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/audio/samplePlayer', () => ({ samplePlayer: { playFret: () => null } }))
vi.mock('../src/services/playback', () => {
  const stub = {
    togglePlayback: vi.fn(),
    setPlayPosition: vi.fn(),
    adaptToLoopChange: vi.fn(),
    jumpToPosition: vi.fn(),
    followTrackChange: vi.fn(),
  }
  return { default: stub, playback: stub }
})
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
type SongType = (typeof import('../src/stores/song'))['default']
let Song: SongType
let selection: (typeof import('../src/stores/selectionState'))['selectionState']
let undo: (typeof import('../src/services/editor/editCommands'))['undoHistory']
let keyDown: (event: KeyboardEvent) => void

function beat(duration: string, frets: Record<number, number> = {}) {
  const made = Song.defaultMeasure()
  made.duration = duration as never
  made.notes = new Array(6).fill(null)
  for (const [string, fret] of Object.entries(frets))
    made.notes[Number(string)] = { ...Song.defaultNote(), fret }
  return made
}

beforeEach(async () => {
  Song = (await import('../src/stores/song')).default
  selection = (await import('../src/stores/selectionState')).selectionState
  undo = (await import('../src/services/editor/editCommands')).undoHistory
  keyDown = (await import('../src/services/editor/keyboardDispatch')).handleKeyDown
  const range = await import('../src/services/editor/rangeSelection')
  const bus = (await import('../src/utils/typedEventBus')).typedEventBus
  Song.initEmptySong()
  Song.numMeasures = 3
  Song.measures[0].length = 3
  Song.measureMeta.length = 3
  // Bar 1: E string 3, 5, quarter rest, half... (4/4): q q q(r) q(r); bar 2: a half note and a half rest.
  Song.measures[0][0][0] = [beat('q', { 0: 3 }), beat('q', { 0: 5 }), beat('qr'), beat('qr')]
  Song.measures[0][1][0] = [beat('h', { 2: 7 }), beat('hr')]
  Song.measures[0][2][0] = [beat('wr')]
  undo.clear()
  range.clearRange()
  bus.off?.('navigation.setClickedPos')
  bus.on('navigation.setClickedPos', (pos) => Object.assign(selection.cursor, pos))
  Object.assign(selection.cursor, { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 })
  selection.hasExplicitSelection = true
})

/** A key press; waits for the lazily loaded editing tools it may run. */
async function press(key: string, init: KeyboardEventInit = {}): Promise<boolean> {
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : key
  const event = new KeyboardEvent('keydown', { key, code, cancelable: true, ...init })
  keyDown(event)
  await vi.dynamicImportSettled()
  return event.defaultPrevented
}

const bar = (blockId: number) =>
  Song.measures[0][blockId][0]
    .map((b) => {
      const frets = Array.from(b.notes, (note, string) =>
        note ? `${string}:${note.fret}${note.tied ? 't' : ''}` : '',
      )
        .filter(Boolean)
        .join(',')
      return `${b.duration}${b.dotted ? '.' : ''}${b.tuplet && b.tuplet > 0 ? `/${b.tuplet}` : ''}${frets ? `[${frets}]` : ''}`
    })
    .join(' ')

describe('selection', () => {
  it('Shift+→ extends a range from the cursor; Shift+← shrinks it back', async () => {
    expect(await press('ArrowRight', { shiftKey: true })).toBe(true)
    await press('ArrowRight', { shiftKey: true })
    expect(selection.cursor.beatId).toBe(2)
    expect([selection.rangeStart?.beatId, selection.rangeEnd?.beatId]).toEqual([0, 2])
    await press('ArrowLeft', { shiftKey: true })
    expect([selection.rangeStart?.beatId, selection.rangeEnd?.beatId]).toEqual([0, 1])
  })

  it('Ctrl+A selects the bar, again the whole track', async () => {
    Object.assign(selection.cursor, { blockId: 1, beatId: 0 })
    await press('a', { ctrlKey: true })
    expect([selection.rangeStart?.blockId, selection.rangeEnd?.blockId, selection.rangeEnd?.beatId]).toEqual([
      1, 1, 1,
    ])
    await press('a', { ctrlKey: true })
    expect([selection.rangeStart?.blockId, selection.rangeEnd?.blockId]).toEqual([0, 2])
  })

  it('a key pressed while Ctrl+A is still loading its command runs after it', async () => {
    // No await in between: Ctrl+A's command comes from a lazy chunk (a promise even when loaded).
    const key = (k: string) =>
      keyDown(
        new KeyboardEvent('keydown', {
          key: k,
          code: `Key${k.toUpperCase()}`,
          ctrlKey: true,
          cancelable: true,
        }),
      )
    key('a')
    key('x')
    await vi.dynamicImportSettled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    // The whole bar was cut, not only the cursor's beat.
    expect(bar(0)).toBe('qr qr qr qr')
  })

  it('Ctrl+C / Ctrl+V without a range copy the beat and paste over the cursor', async () => {
    await press('c', { ctrlKey: true })
    Object.assign(selection.cursor, { beatId: 2 })
    await press('v', { ctrlKey: true })
    expect(bar(0)).toBe('q[0:3] q[0:5] q[0:3] qr')
    undo.undo()
    expect(bar(0)).toBe('q[0:3] q[0:5] qr qr')
  })

  it('Ctrl+X cuts a range to rests; Ctrl+Shift+V inserts it as new bars, one undo step', async () => {
    await press('ArrowRight', { shiftKey: true })
    await press('x', { ctrlKey: true })
    expect(bar(0)).toBe('qr qr qr qr')
    Object.assign(selection.cursor, { blockId: 1, beatId: 0 })
    await press('V', { ctrlKey: true, shiftKey: true, code: 'KeyV' } as KeyboardEventInit)
    expect(Song.numMeasures).toBe(4)
    expect(bar(1)).toMatch(/^q\[0:3\] q\[0:5\]/)
    expect(bar(2)).toBe('h[2:7] hr')
    undo.undo()
    expect(Song.numMeasures).toBe(3)
    expect(bar(1)).toBe('h[2:7] hr')
  })
})

describe('rhythm keys', () => {
  it('. dots the beat, R makes it a rest, both undoable', async () => {
    Object.assign(selection.cursor, { beatId: 1 })
    await press('.')
    expect(bar(0)).toBe('q[0:3] q.[0:5] er qr')
    undo.undo()
    expect(bar(0)).toBe('q[0:3] q[0:5] qr qr')
    await press('r')
    expect(bar(0)).toBe('q[0:3] qr qr qr')
  })

  it('Alt+3 makes a triplet, again removes it', async () => {
    await press('3', { altKey: true })
    expect(bar(0)).toBe('e/3[0:3] er/3 er/3 q[0:5] qr qr')
    await press('3', { altKey: true })
    expect(bar(0)).toBe('q[0:3] q[0:5] qr qr')
  })

  it('Insert takes room from the rests at the end; refused when the bar ends in notes', async () => {
    ;(await import('../src/stores/noteInputState')).noteInputState.noteLength = 'q'
    Object.assign(selection.cursor, { beatId: 1 })
    expect(await press('Insert')).toBe(true)
    expect(bar(0)).toBe('q[0:3] qr q[0:5] qr')
    await press('Insert')
    expect(bar(0)).toBe('q[0:3] qr qr q[0:5]')
    await press('Insert')
    expect(bar(0)).toBe('q[0:3] qr qr q[0:5]')
    expect(undo.peek()?.label).toBe('Insert beat')
  })

  it('Ctrl+Delete deletes the beat and fills the bar end with rests', async () => {
    await press('Delete', { ctrlKey: true })
    expect(bar(0)).toBe('q[0:5] qr qr qr')
    undo.undo()
    expect(bar(0)).toBe('q[0:3] q[0:5] qr qr')
  })

  it('L ties to the previous note on the string', async () => {
    Object.assign(selection.cursor, { beatId: 1 })
    await press('l')
    expect(bar(0)).toBe('q[0:3] q[0:3t] qr qr')
  })
})

describe('transpose', () => {
  it('Ctrl+↑ / Ctrl+Shift+↓ move the selection; refused when it leaves the neck', async () => {
    await press('ArrowRight', { shiftKey: true })
    await press('ArrowUp', { ctrlKey: true })
    expect(bar(0)).toBe('q[0:4] q[0:6] qr qr')
    await press('ArrowDown', { ctrlKey: true, shiftKey: true })
    // Below the low E string's range an octave down: nothing changes.
    expect(bar(0)).toBe('q[0:4] q[0:6] qr qr')
    expect(undo.peek()?.label).toBe('Transpose')
  })
})

describe('short bars', () => {
  it('get rests at their end when a song is loaded', async () => {
    const { padBarWithRests } = await import('../src/services/editor/barFilling')
    Song.measures[0][1][0] = [beat('q', { 2: 7 })]
    expect(padBarWithRests(0, 1, 0)).toBe(true)
    expect(bar(1)).toBe('q[2:7] hr qr')
    expect(padBarWithRests(0, 1, 0)).toBe(false)
  })
})
