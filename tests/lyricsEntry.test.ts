// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Lyric entry at the cursor: start on a note, store and advance, flow a line, undo, the L key. */

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
  }
  return { default: stub, playback: stub }
})
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
type SongType = (typeof import('../src/stores/song'))['default']
let Song: SongType
let selection: (typeof import('../src/stores/selectionState'))['selectionState']
let state: (typeof import('../src/stores/lyricsEntryState'))['lyricsEntryState']
let entry: typeof import('../src/services/editor/lyricsEntry')
let undo: (typeof import('../src/services/editor/editCommands'))['undoHistory']

beforeEach(async () => {
  Song = (await import('../src/stores/song')).default
  selection = (await import('../src/stores/selectionState')).selectionState
  state = (await import('../src/stores/lyricsEntryState')).lyricsEntryState
  entry = await import('../src/services/editor/lyricsEntry')
  undo = (await import('../src/services/editor/editCommands')).undoHistory
  const bus = (await import('../src/utils/typedEventBus')).typedEventBus
  Song.initEmptySong()
  const beat = (duration: string, fret?: number) => {
    const made = Song.defaultMeasure()
    made.duration = duration as never
    made.notes = new Array(6).fill(null)
    if (fret != null) made.notes[0] = { ...Song.defaultNote(), fret }
    return made
  }
  // Bar 1: note, rest, note, note (quarters); bar 2: a note and a rest.
  Song.measures[0][0][0] = [beat('q', 5), beat('qr'), beat('q', 7), beat('q', 8)]
  Song.measures[0][1][0] = [beat('h', 3), beat('hr')]
  undo.clear()
  state.active = false
  state.verse = 0
  bus.off?.('navigation.setClickedPos')
  bus.on('navigation.setClickedPos', (pos) => Object.assign(selection.cursor, pos))
  Object.assign(selection.cursor, { trackId: 0, voiceId: 0, blockId: 0, beatId: 1, string: 0 })
})

function lyrics(): string {
  return Song.measures[0]
    .slice(0, 2)
    .map((bar) => bar[0].map((beat) => beat.lyrics?.join('/') || '_').join(' '))
    .join(' | ')
}

const at = () => `${selection.cursor.blockId}:${selection.cursor.beatId}`

describe('lyrics entry', () => {
  it('starts on the next note when the cursor is on a rest', () => {
    expect(Song.measures[0][0][0].map((beat) => beat.duration).join(' ')).toBe('q qr q q')
    expect(entry.startLyricsEntry()).toBe(true)
    expect(state.active).toBe(true)
    expect(at()).toBe('0:2')
  })

  it('stores a syllable and moves to the next note, skipping rests and crossing bars', () => {
    Object.assign(selection.cursor, { beatId: 0 })
    entry.startLyricsEntry()
    expect(entry.enterLyricsAndAdvance('Hel-')).toBe(true)
    expect(at()).toBe('0:2')
    entry.enterLyricsAndAdvance('lo')
    entry.enterLyricsAndAdvance('you')
    expect(at()).toBe('1:0')
    expect(lyrics()).toMatch(/^Hel- _ lo you \| _/)
    // At the last note it stays.
    expect(entry.enterLyricsAndAdvance('end')).toBe(false)
    expect(at()).toBe('1:0')
    expect(entry.cursorLyric()).toBe('end')
  })

  it('flows a typed line onto the following notes as one undo step', () => {
    Object.assign(selection.cursor, { beatId: 0 })
    entry.startLyricsEntry()
    entry.enterLyricsAndAdvance('Hel-lo  world and more')
    expect(lyrics()).toMatch(/^Hel- _ lo _ \| world/)
    undo.undo()
    expect(lyrics()).not.toMatch(/[a-z]/)
  })

  it('writes the chosen verse and clears with an empty entry', () => {
    Object.assign(selection.cursor, { beatId: 0 })
    entry.startLyricsEntry()
    entry.enterLyrics('one')
    entry.setLyricVerse(1)
    entry.enterLyrics('two')
    expect(Song.measures[0][0][0][0].lyrics).toEqual(['one', 'two'])
    entry.setLyricVerse(0)
    entry.enterLyrics('')
    expect(Song.measures[0][0][0][0].lyrics).toEqual(['', 'two'])
    entry.moveLyricCursor(1)
    entry.moveLyricCursor(-1)
    expect(at()).toBe('0:0')
  })

  it('opens with Shift+L (L alone is the tie)', async () => {
    const { handleKeyDown } = await import('../src/services/editor/keyboardDispatch')
    const event = new KeyboardEvent('keydown', { code: 'KeyL', key: 'L', shiftKey: true, cancelable: true })
    handleKeyDown(event)
    expect(event.defaultPrevented).toBe(true)
    expect(state.active).toBe(true)
  })
})
