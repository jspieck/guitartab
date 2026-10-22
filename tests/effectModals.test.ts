import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/assets/js/songData'
import { undoHistory } from '../src/services/editor/editCommands'
import {
  RepeatAlternativeModalHandler,
  StrokeModalHandler,
  TempoModalHandler,
  TextModalHandler,
} from '../src/assets/js/modals/effectModals'
import { AddChordModalHandler } from '../src/assets/js/modals/addChordModalHandler'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

const at = { trackId: 0, blockId: 1, voiceId: 0, beatId: 0 }

describe('edit dialogs (EditModalHandler)', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
  })

  it('fills the form from the song when opened, and applies as one undo step', () => {
    Song.measures[0][1][0][0].text = 'Old'
    const text = new TextModalHandler()
    text.openModal(at)
    expect(text.form.text).toBe('Old')

    text.form.text = 'New'
    text.apply()
    expect(Song.measures[0][1][0][0].text).toBe('New')
    undoHistory.undo()
    expect(Song.measures[0][1][0][0].text).toBe('Old')
  })

  it('resets the form between openings', () => {
    const text = new TextModalHandler()
    Song.measures[0][1][0][0].text = 'Here'
    text.openModal(at)
    text.openModal({ ...at, blockId: 2 })
    expect(text.form.text).toBe('')
  })

  it('repeat endings round-trip through the bit mask; none checked removes them', () => {
    Song.measureMeta[1].repeatAlternative = 0b101
    const endings = new RepeatAlternativeModalHandler()
    endings.openModal(at)
    expect(endings.form.endings.slice(0, 3)).toEqual([true, false, true])

    endings.form.endings = endings.form.endings.map(() => false)
    endings.apply()
    expect(Song.measureMeta[1].repeatAlternative).toBeUndefined()
  })

  it('tempo is clamped and defaults to the song tempo', () => {
    Song.bpm = 120
    const tempo = new TempoModalHandler()
    tempo.openModal(at)
    expect(tempo.form.bpm).toBe(120)
    tempo.form.bpm = 5000
    tempo.apply()
    expect(Song.measureMeta[1].bpm).toBe(300)
  })

  it('a stroke on a range covers every selected bar in one step', () => {
    const beats = [1, 2].map((blockId) => ({ ...at, blockId, beat: Song.measures[0][blockId][0][0] }))
    const stroke = new StrokeModalHandler()
    stroke.openModal({ notes: [], beats, blocks: [1, 2] })
    stroke.form.strokeType = 'down'
    stroke.apply()
    expect(beats.map(({ beat }) => beat.effects.stroke?.strokeType)).toEqual(['down', 'down'])
    undoHistory.undo()
    expect(beats.map(({ beat }) => beat.effects.stroke)).toEqual([undefined, undefined])
    expect(undoHistory.canUndo()).toBe(false)
  })

  it('add chord from the toolbar puts the chord on the beat and in the library, as one undo step', () => {
    const dialog = new AddChordModalHandler()
    dialog.openModal(at)
    dialog.updateChordRoot('A')
    dialog.updateChordType('min')
    dialog.saveChord()

    expect(Song.measures[0][1][0][0].chord?.name).toBe('Amin')
    expect(Song.measures[0][1][0][0].chord?.frets).toEqual([0, 1, 2, 2, 0, 0])
    expect(Song.chordsMap[0].has('Amin')).toBe(true)
    undoHistory.undo()
    expect(Song.measures[0][1][0][0].chord).toBeUndefined()
    expect(Song.chordsMap[0].has('Amin')).toBe(false)
    expect(undoHistory.canUndo()).toBe(false)
  })

  it('editing a library chord fills the form from it', () => {
    const dialog = new AddChordModalHandler()
    dialog.openModal({ trackId: 0 })
    dialog.updateChordRoot('G')
    dialog.updateChordType('maj')
    dialog.saveChord()
    const stored = Song.chordsMap[0].get('Gmaj')!

    const editor = new AddChordModalHandler()
    editor.openModal({ trackId: 0, existingChord: stored })
    const state = editor.getModalState()
    expect(state.chordProperties.name).toBe('Gmaj')
    expect(state.chordProperties.currentNotes).toEqual([3, 2, 0, 0, 0, 3])
    // Stored frets are absolute, highest string first: G major is 3 0 0 0 2 3.
    expect(stored.frets).toEqual([3, 0, 0, 0, 2, 3])
    expect(stored.capo).toBe(1)
    expect(Song.measures[0][1][0][0].chord).toBeUndefined()
  })
})
