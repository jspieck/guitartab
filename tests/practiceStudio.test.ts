// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markerSections } from '../src/utils/markerSections'
import { hasSongContent, practicePartOf, withPracticePart } from '../src/utils/gtSerialization'
import type { MeasureMetaInfo } from '../src/types/song'

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
const marker = (text: string) => ({ text, color: { red: 0, green: 0, blue: 0 } })
const bars = (markers: Record<number, string>, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    numerator: 4,
    denominator: 4,
    ...(markers[i] != null ? { marker: marker(markers[i]) } : {}),
  })) as unknown as MeasureMetaInfo[]

describe('marker sections', () => {
  it('runs from each marker to the bar before the next, the last to the end', () => {
    expect(markerSections(bars({ 0: 'Intro', 4: 'Riff', 9: 'Outro' }, 12))).toEqual([
      { text: 'Intro', startBlock: 0, endBlock: 4 },
      { text: 'Riff', startBlock: 4, endBlock: 9 },
      { text: 'Outro', startBlock: 9, endBlock: 12 },
    ])
    expect(markerSections(bars({}, 3))).toEqual([])
  })
})

describe('the .gt practice part', () => {
  it('follows the song parts and is not song content', () => {
    const song = ['a', 'b', 'c', 'd', 'e', 'f'].join('%%%')
    const memory = { playbackRate: 0.7, loop: null }
    const document = withPracticePart(song, memory)
    expect(practicePartOf(document)).toEqual(memory)
    expect(practicePartOf(song)).toBeUndefined()
    expect(hasSongContent(document, song)).toBe(true)
    expect(hasSongContent(song, song)).toBe(true)
    expect(hasSongContent(document, `${song}x`)).toBe(false)
    expect(practicePartOf(`${song}%%%{broken`)).toBeUndefined()
  })
})

describe('practice memory and section loops', () => {
  beforeEach(async () => {
    localStorage.clear()
    const { default: Song } = await import('../src/stores/song')
    const { clearRange } = await import('../src/services/editor/rangeSelection')
    Song.initEmptySong()
    Song.numMeasures = 3
    Song.measures[0].length = 3
    Song.measureMeta.length = 3
    for (let blockId = 0; blockId < 3; blockId += 1) {
      Song.measureMeta[blockId] ??= Song.defaultMeasureMeta()
      Song.measures[0][blockId] ??= [[], []]
      const rest = Song.defaultMeasure()
      rest.duration = 'wr'
      Song.measures[0][blockId][0] = [rest]
      Song.measures[0][blockId][1] = [{ ...rest }]
    }
    Song.songDescription.title = 'Practice'
    clearRange()
  })

  it('loops a marker section on the shown track and ends the loop on a second click', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { toggleSectionLoop, isSectionLooped } = await import('../src/services/sectionLoops')
    const { currentLoopInterval } = await import('../src/services/editor/rangeSelection')
    Song.measureMeta[1].marker = marker('Riff')
    toggleSectionLoop(1)
    const loop = currentLoopInterval()
    expect(loop).toMatchObject({ startBlock: 1, endBlock: Song.measureMeta.length - 1, startRatio: 0 })
    expect(isSectionLooped(1, Song.measureMeta.length)).toBe(true)
    toggleSectionLoop(1)
    expect(currentLoopInterval()).toBeNull()
    toggleSectionLoop(0) // no marker there
    expect(currentLoopInterval()).toBeNull()
  })

  it('remembers speed and loop per song and brings them back', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { practiceState } = await import('../src/stores/practiceState')
    const memory = await import('../src/services/practiceMemory')
    const { currentLoopInterval, clearRange } = await import('../src/services/editor/rangeSelection')
    const { toggleSectionLoop } = await import('../src/services/sectionLoops')
    Song.measureMeta[1].marker = marker('Riff')
    toggleSectionLoop(1)
    practiceState.playbackRate = 0.6
    const saved = memory.currentPracticeMemory()
    expect(saved).toMatchObject({ playbackRate: 0.6, loop: { start: { blockId: 1, beatId: 0 } } })
    memory.rememberPractice()

    clearRange()
    practiceState.playbackRate = 1
    memory.recallPractice()
    expect(practiceState.playbackRate).toBe(0.6)
    expect(currentLoopInterval()).toMatchObject({ startBlock: 1 })

    // a .gt file's own part wins over the browser's memory
    memory.recallPractice({ playbackRate: 0.8, loop: null })
    expect(practiceState.playbackRate).toBe(0.8)
    expect(currentLoopInterval()).toBeNull()

    // another song (other bar count) has no memory
    practiceState.playbackRate = 1
    Song.measureMeta.push({ ...Song.measureMeta[0] })
    memory.recallPractice()
    expect(practiceState.playbackRate).toBe(1)
  })

  it('ignores a loop that does not fit the song', async () => {
    const memory = await import('../src/services/practiceMemory')
    const { currentLoopInterval } = await import('../src/services/editor/rangeSelection')
    const end = { trackId: 0, blockId: 999, voiceId: 0, beatId: 0 }
    expect(memory.applyPracticeMemory({ playbackRate: 0.5, loop: { start: end, end } })).toBe(true)
    expect(currentLoopInterval()).toBeNull()
    expect(memory.applyPracticeMemory('nonsense')).toBe(false)
  })
})
