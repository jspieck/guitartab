import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPlaybackNotes,
  pressLiveNote,
  releaseLiveNote,
  showPlaybackBeat,
  soundingFrets,
  soundingNotes,
  soundingPitches,
} from '../src/stores/soundingNotesState'

const GUITAR = [40, 45, 50, 55, 59, 64]

describe('soundingNotesState', () => {
  beforeEach(() => {
    clearPlaybackNotes()
    for (const pitch of Object.keys(soundingNotes.live)) releaseLiveNote(Number(pitch))
  })

  it('turns a played beat into pitches and fret positions, capo included', () => {
    showPlaybackBeat([{ fret: 3 }, null, { fret: 0 }], GUITAR, 2)
    expect([...soundingPitches.value].sort()).toEqual([45, 52])
    expect(soundingFrets.value).toEqual([
      { pitch: 45, string: 0, fret: 5 },
      { pitch: 52, string: 2, fret: 2 },
    ])
  })

  it('keeps the earlier note for a tie and drops strings that stop', () => {
    showPlaybackBeat([{ fret: 3 }, { fret: 2 }], GUITAR, 0)
    showPlaybackBeat([{ fret: 7, tied: true }, null], GUITAR, 0)
    expect([...soundingPitches.value]).toEqual([43])
    clearPlaybackNotes()
    expect(soundingPitches.value.size).toBe(0)
  })

  it('adds live notes; ones without a string only light the piano', () => {
    pressLiveNote(60, 3, 5)
    pressLiveNote(30)
    expect([...soundingPitches.value].sort()).toEqual([30, 60])
    expect(soundingFrets.value).toEqual([{ pitch: 60, string: 3, fret: 5 }])
    releaseLiveNote(60)
    expect([...soundingPitches.value]).toEqual([30])
  })
})
