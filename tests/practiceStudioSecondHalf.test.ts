// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beatNotes, nextBeat, upcomingBeats, type DockSong } from '../src/services/practiceDock'
import type { Beat, Interval, MeasureMetaInfo } from '../src/types/song'

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => {
  const stub = { adaptToLoopChange: vi.fn(), jumpToPosition: vi.fn(), setPlayPosition: vi.fn() }
  return { default: stub, playback: stub }
})
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)

/** A beat with frets by string (null: no note), e.g. beat([null, 3]) = fret 3 on string 1. */
function beat(frets: (number | null)[]): Beat {
  return { notes: frets.map((fret, string) => (fret == null ? null : { string, fret })) } as unknown as Beat
}
const rest = () => beat([])

// three bars of one voice: [E2 fret 0, rest], [string 1 fret 2], [string 5 fret 5, string 0 fret 1]
const song: DockSong = {
  measures: [
    [[beat([0]), rest()]],
    [[beat([null, 2])]],
    [[beat([null, null, null, null, null, 5]), beat([1])]],
  ],
  strings: [40, 45, 50, 55, 59, 64],
  capo: 2,
}

describe('practice dock: notes of a beat and the next beats', () => {
  it('places a beat on the tab’s strings, frets counted from the nut with the capo', () => {
    expect(beatNotes(song, 0, { blockId: 0, beatId: 0 })).toEqual([{ string: 0, neckFret: 2, pitch: 42 }])
    expect(beatNotes(song, 0, { blockId: 0, beatId: 1 })).toEqual([])
    expect(beatNotes(song, 0, { blockId: 9, beatId: 0 })).toEqual([])
  })

  it('goes on through the bar, then the next bar, and back to the loop start at the loop end', () => {
    expect(nextBeat(song, 0, { blockId: 0, beatId: 0 })).toEqual({ blockId: 0, beatId: 1 })
    expect(nextBeat(song, 0, { blockId: 0, beatId: 1 })).toEqual({ blockId: 1, beatId: 0 })
    expect(nextBeat(song, 0, { blockId: 2, beatId: 1 })).toBeNull()
    const loop = { startBlock: 0, startBeat: 0, endBlock: 1 } as Interval
    expect(nextBeat(song, 0, { blockId: 1, beatId: 0 }, loop)).toEqual({ blockId: 0, beatId: 0 })
  })

  it('lists the next beats that play, skipping rests, as far as asked', () => {
    const next = upcomingBeats(song, 0, { blockId: 0, beatId: 0 }, 2)
    expect(next.map((entry) => entry.position)).toEqual([
      { blockId: 1, beatId: 0 },
      { blockId: 2, beatId: 0 },
    ])
    expect(next[1].notes).toEqual([{ string: 5, neckFret: 7, pitch: 71 }])
    // not further than `range` beats ahead
    expect(upcomingBeats(song, 0, { blockId: 0, beatId: 0 }, 2, null, 1)).toEqual([])
  })
})

const marker = (text: string) => ({ text, color: { red: 0, green: 0, blue: 0 } })

describe('loop handles, loop by bar numbers, section speeds', () => {
  beforeEach(async () => {
    localStorage.clear()
    const { default: Song } = await import('../src/stores/song')
    const { clearRange } = await import('../src/services/editor/rangeSelection')
    const { practiceState } = await import('../src/stores/practiceState')
    const { setSectionRates } = await import('../src/stores/sectionPracticeState')
    Song.initEmptySong()
    Song.measures[0].length = 4
    Song.measureMeta.length = 4
    for (let blockId = 0; blockId < 4; blockId += 1) {
      Song.measureMeta[blockId] ??= Song.defaultMeasureMeta()
      const quarter = () => Object.assign(Song.defaultMeasure(), { duration: 'q' })
      Song.measures[0][blockId] = [[quarter(), quarter(), quarter(), quarter()], [quarter()]]
    }
    Song.songDescription.title = 'Handles'
    Object.assign(practiceState, { trainer: false, trainerStart: 0.7, playbackRate: 1 })
    setSectionRates(null)
    clearRange()
  })

  it('moves one end of the loop beat by beat and never past the other end', async () => {
    const range = await import('../src/services/editor/rangeSelection')
    range.startRange(0, 1, 0, 1)
    range.extendRange(0, 2, 0, 2)
    range.applyRangeAsLoop()
    range.moveRangeEdge('start', 0, 3)
    range.applyRangeAsLoop()
    expect(range.currentLoopInterval()).toMatchObject({ startBlock: 0, startBeat: 3, endBlock: 2 })
    range.moveRangeEdge('end', 3, 0)
    range.applyRangeAsLoop()
    expect(range.orderedRange()!.map((end) => [end.blockId, end.beatId])).toEqual([
      [0, 3],
      [3, 0],
    ])
    // dragged past the start: the end stops there
    range.moveRangeEdge('end', 0, 0)
    expect(range.orderedRange()!.map((end) => [end.blockId, end.beatId])).toEqual([
      [0, 3],
      [0, 3],
    ])
  })

  it('loops whole bars by number, in either order, clamped to the song', async () => {
    const { loopBars } = await import('../src/services/sectionLoops')
    const { currentLoopInterval, orderedRange } = await import('../src/services/editor/rangeSelection')
    loopBars(2, 1)
    expect(currentLoopInterval()).toMatchObject({ startBlock: 1, startBeat: 0, startRatio: 0, endBlock: 2 })
    expect(orderedRange()![1].beatId).toBe(3)
    loopBars(-5, 99)
    expect(currentLoopInterval()).toMatchObject({ startBlock: 0, endBlock: 3 })
  })

  it('starts a section slow with the trainer on, remembers the speed it reached and brings it back', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { practiceState, setPlaybackRate } = await import('../src/stores/practiceState')
    const { toggleSectionLoop } = await import('../src/services/sectionLoops')
    const { sectionPracticeState } = await import('../src/stores/sectionPracticeState')
    const memory = await import('../src/services/practiceMemory')
    const { nextTick } = await import('vue')
    memory.watchPracticeMemory()
    Song.measureMeta[2].marker = marker('Solo')
    practiceState.trainer = true

    toggleSectionLoop(2)
    expect(practiceState.playbackRate).toBe(0.7)
    // the trainer steps up while the section loops
    setPlaybackRate(0.8)
    await nextTick()
    expect(sectionPracticeState.rates).toEqual({ 2: 0.8 })
    expect(memory.currentPracticeMemory().sections).toEqual({ 2: 0.8 })

    // another loop, then the section again: it goes on at 80 %
    toggleSectionLoop(2)
    setPlaybackRate(1)
    toggleSectionLoop(2)
    expect(practiceState.playbackRate).toBe(0.8)

    // saved with the song and read back
    memory.rememberPractice()
    sectionPracticeState.rates = {}
    memory.recallPractice()
    expect(sectionPracticeState.rates).toEqual({ 2: 0.8 })
    // a .gt part without sections clears them
    memory.recallPractice({ playbackRate: 1, loop: null })
    expect(sectionPracticeState.rates).toEqual({})
  })

  it('leaves the speed alone without the trainer', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { practiceState } = await import('../src/stores/practiceState')
    const { toggleSectionLoop } = await import('../src/services/sectionLoops')
    Song.measureMeta[1].marker = marker('Riff') as unknown as MeasureMetaInfo['marker']
    practiceState.playbackRate = 0.9
    toggleSectionLoop(1)
    expect(practiceState.playbackRate).toBe(0.9)
  })
})
