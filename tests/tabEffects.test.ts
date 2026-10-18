import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Song from '../src/assets/js/songData'
import type { TabBeat, TabNoteData } from '../src/types/tab'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getMeasureBeatWidth, getMeasureBeatX } from '../src/utils/measureBeatLayout'
import { buildTabEffects } from '../src/utils/tabEffects'
import { computeRowLanes, type LaneBox, type RowLanes } from '../src/utils/tabRowLanes'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

const TRACK_ID = 0
const VOICE_ID = 0
const BLOCK_ID = 0

function createNote(overrides: Partial<TabNoteData> = {}): TabNoteData {
  return {
    fret: 0,
    string: 0,
    ...overrides,
  } as TabNoteData
}

function createBeat(duration: string, notes: Array<TabNoteData | null>): TabBeat {
  return {
    duration,
    notes,
  } as TabBeat
}

function beatCenter(measureData: TabBeat[], beatIndex: number): number {
  return (
    getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, beatIndex, measureData) +
    getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, beatIndex, measureData) / 2
  )
}

/** Lanes for a row made of just this measure, as the layout engine would compute them. */
function lanesFor(measureData: TabBeat[]): RowLanes {
  return computeRowLanes({
    numStrings: 6,
    stringSpacing: 12,
    blocks: [
      {
        blockId: BLOCK_ID,
        meta: undefined,
        beats: measureData.map((beat, index) => ({ beat, centerX: beatCenter(measureData, index) })),
      },
    ],
  })
}

function buildInput(measureData: TabBeat[]) {
  return {
    measureData,
    trackId: TRACK_ID,
    voiceId: VOICE_ID,
    blockId: BLOCK_ID,
    stringSpacing: 12,
    numStrings: 6,
    lanes: lanesFor(measureData),
  }
}

function insideLane(y: number, lane: LaneBox | undefined): boolean {
  return lane != null && y >= lane.top && y <= lane.top + lane.height
}

describe('buildTabEffects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, 900)
  })

  it('draws a slide from right of its digit to just before the next digit', () => {
    const measureData = [
      createBeat('q', [createNote({ fret: 5, slide: true }), null, null, null, null, null]),
      createBeat('q', [createNote({ fret: 8 }), null, null, null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))

    expect(effects.slides).toHaveLength(1)
    const [, startX, startY, endX, endY] = /M([\d.]+) (-?[\d.]+)L([\d.]+) (-?[\d.]+)/
      .exec(effects.slides[0].path)!
      .map(Number)
    expect(startX).toBeGreaterThan(beatCenter(measureData, 0) + 4)
    expect(endX).toBeLessThan(beatCenter(measureData, 1) - 4)
    // Upward slide (5 -> 8) rises from left to right.
    expect(endY).toBeLessThan(startY)
  })

  it('draws one P.M. label per run of beats, in the palm-mute lane', () => {
    const measureData = [
      createBeat('q', [
        createNote({ palmMute: true, string: 0 }),
        createNote({ palmMute: true, string: 1 }),
        null,
        null,
        null,
        null,
      ]),
      createBeat('q', [createNote({ palmMute: true }), null, null, null, null, null]),
    ]
    const input = buildInput(measureData)

    const effects = buildTabEffects(input)

    expect(effects.runs).toHaveLength(1)
    expect(effects.runs[0]).toMatchObject({ kind: 'palmMute', label: 'P.M.' })
    expect(insideLane(effects.runs[0].y, input.lanes.above.palmMute)).toBe(true)
    expect(effects.runs[0].lineEndX).toBeGreaterThan(beatCenter(measureData, 1))
    expect(effects.textEffects).toHaveLength(0)
  })

  it('groups consecutive let-ring beats into one run ending at the last let-ring beat', () => {
    const measureData = [
      createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
      createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
      createBeat('q', [createNote(), null, null, null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))
    const endX =
      getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 1, measureData) +
      getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 1, measureData)

    expect(effects.runs).toHaveLength(1)
    expect(effects.runs[0].kind).toBe('letRing')
    expect(effects.runs[0].lineEndX).toBe(endX - 2)
  })

  it('gives every stacked effect of one beat its own vertical position', () => {
    const measureData = [
      createBeat('q', [
        createNote({
          palmMute: true,
          artificialStyle: 'N.H.',
          letRing: true,
          accentuated: true,
          stacatto: true,
        }),
        null,
        null,
        null,
        null,
        null,
      ]),
    ]
    const input = buildInput(measureData)

    const effects = buildTabEffects(input)
    const ys = [...effects.textEffects.map((effect) => effect.y), ...effects.runs.map((run) => run.y)]

    expect(effects.textEffects.map((effect) => effect.text).sort()).toEqual(['>', 'N.H.', '•'])
    expect(effects.runs.map((run) => run.kind).sort()).toEqual(['letRing', 'palmMute'])
    expect(new Set(ys).size).toBe(ys.length)
    // Everything sits above the strings, inside the row's reserved lanes.
    expect(ys.every((y) => y < 0 && y >= -input.lanes.overBarHeight)).toBe(true)
  })

  it('places tremolo picking marks in their lane, centred on the note', () => {
    const measureData = [
      createBeat('q', [
        createNote({ tremoloPicking: true, tremoloPickingLength: 's' }),
        null,
        null,
        null,
        null,
        null,
      ]),
    ]
    const input = buildInput(measureData)

    const effects = buildTabEffects(input)

    expect(effects.tremoloPickings).toHaveLength(1)
    expect(effects.tremoloPickings[0]).toMatchObject({ x: beatCenter(measureData, 0) - 7, lines: 2 })
    expect(insideLane(effects.tremoloPickings[0].y, input.lanes.above.tremoloPicking)).toBe(true)
  })

  it('places the trill in the trill lane within the beat column', () => {
    const measureData = [
      createBeat('q', [null, null, createNote({ trill: { fret: 7, period: 4 } }), null, null, null]),
    ]
    const input = buildInput(measureData)

    const effects = buildTabEffects(input)
    const center = beatCenter(measureData, 0)

    expect(effects.trills).toHaveLength(1)
    expect(effects.trills[0]).toMatchObject({ textX: center - 10, beatIndex: 0, stringIndex: 2 })
    expect(insideLane(effects.trills[0].textY, input.lanes.above.trill)).toBe(true)
    expect(effects.trills[0].path.startsWith(`M${center + 2} `)).toBe(true)
  })

  it('renders beat text, dynamics and strokes', () => {
    const measureData = [
      {
        ...createBeat('q', [
          createNote({ fret: 1 }),
          createNote({ fret: 3, string: 1 }),
          null,
          null,
          null,
          null,
        ]),
        text: 'intro',
        dynamicPresent: true,
        dynamic: 'mf',
        effects: { stroke: { strokeType: 'down', strokeLength: 8 } },
      } as unknown as TabBeat,
    ]
    const input = buildInput(measureData)

    const effects = buildTabEffects(input)

    expect(effects.beatTexts).toEqual([expect.objectContaining({ text: 'intro' })])
    expect(insideLane(effects.beatTexts[0].y, input.lanes.above.text)).toBe(true)
    expect(effects.dynamics).toEqual([expect.objectContaining({ text: 'mf' })])
    expect(insideLane(effects.dynamics[0].y, input.lanes.below.dynamic)).toBe(true)
    expect(effects.strokes).toHaveLength(1)
  })
})
