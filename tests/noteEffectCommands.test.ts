import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import { setFret } from '../src/services/editor/noteCommands'
import { undoHistory } from '../src/services/editor/editCommands'
import { processEffectSelect } from '../src/services/editor/noteEffectCommands'
import type { NoteEffectSelection } from '../src/services/menuMutationRouting'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
function selectionOf(strings: number[]): NoteEffectSelection {
  const notes = strings.map((string) => ({
    trackId: 0,
    blockId: 0,
    voiceId: 0,
    beatId: 0,
    string,
    note: Song.measures[0][0][0][0].notes[string]!,
  }))
  return { notes, blocks: [0], beats: [] }
}

const palmMuted = () => [1, 2].map((string) => Song.measures[0][0][0][0].notes[string]?.palmMute === true)

describe('processEffectSelect', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
    setFret(0, 0, 0, 0, 1, 3, true)
    setFret(0, 0, 0, 0, 2, 5, true)
  })

  it('sets an effect on every note of a mixed selection (it used to follow the last note only)', () => {
    // The last note has it: the old code read only that one and took the effect away from both.
    Song.measures[0][0][0][0].notes[2]!.palmMute = true
    processEffectSelect(selectionOf([1, 2]), 'palmMute')
    expect(palmMuted()).toEqual([true, true])
  })

  it('removes it only when every selected note has it, in one undo step', () => {
    processEffectSelect(selectionOf([1, 2]), 'palmMute')
    processEffectSelect(selectionOf([1, 2]), 'palmMute')
    expect(palmMuted()).toEqual([false, false])
    undoHistory.undo()
    expect(palmMuted()).toEqual([true, true])
  })

  it('does nothing without notes', () => {
    expect(() => processEffectSelect({ notes: [], blocks: [0], beats: [] }, 'palmMute')).not.toThrow()
    expect(undoHistory.peek()).toBeNull()
  })
})
