// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Characterization of playback: drives the real engine on fake timers (the timer worker's
 * 25 ms ticks and animation frames) and logs, against the audio clock, every note handed to
 * the sample player (with its arguments), metronome click, stop, published position,
 * playhead move and scroll. Songs cover repeats and voltas, tempo and meter changes, tuplets,
 * note effects, mute/solo, count-in, loops (set before and during playback), the speed
 * trainer, jumps and pause/resume. The logs are file snapshots, recorded against the old
 * `assets/js/playbackEngine.ts`; `services/playback/` reproduced all of them before these
 * fixes changed five: a tick that reached into the next bar read its beats from the old bar
 * (bar-end-sixteenths), a ghost note halved the strings after it and grace notes differed by
 * instrument (effects), the bar clock restarted at 0 instead of the loop start (loop: clicks
 * missing and the accent drifting; loop-while-playing), a loop set while playing started from
 * a ratio read as ticks (loop-while-playing), and loop lookups counted tuplets at their
 * written length (loop-triplets).
 */

const env = vi.hoisted(() => ({ startMs: 0, log: [] as string[], jumped: true }))

const r = (value: number) => Number(value.toFixed(4))
const now = () => r((Date.now() - env.startMs) / 1000)
const add = (line: string) => env.log.push(`${now().toFixed(4)} ${line}`)

vi.mock('../src/services/audio/audioGraph', () => ({
  audioGraph: {
    getCurrentTime: () => (Date.now() - env.startMs) / 1000,
    ensureContextRunning: () => Promise.resolve(),
  },
}))
vi.mock('../src/services/audio/meters', () => ({ drawMeters: () => {} }))
vi.mock('../src/services/audio/metronome', () => ({
  metronome: {
    playClick: (time: number, accent: boolean) => add(`click ${r(time)}${accent ? ' accent' : ''}`),
  },
}))
vi.mock('../src/services/audio/samplePlayer', () => {
  const effects = (note: Record<string, unknown> | null) =>
    note == null
      ? '-'
      : Object.entries(note)
          .filter(([key, value]) => value === true || (key === 'graceObj' && value != null))
          .map(([key]) => key)
          .join('+') || 'plain'
  return {
    samplePlayer: {
      playFret: (...a: unknown[]) => {
        const [track, voice, string, fret, volume, start, duration, , note, instr, next] = a as number[]
        add(
          `note t${track}v${voice} s${string} f${fret} vol=${volume} at=${r(start)} dur=${r(duration)} ${instr} next=${next} ${effects(note as never)}`,
        )
        return null
      },
      playPitch: (...a: unknown[]) => {
        const [track, voice, pitch, volume, start, duration] = a as number[]
        add(`pitch t${track}v${voice} p${pitch} vol=${volume} at=${r(start)} dur=${r(duration)}`)
        return null
      },
      preloadFret: (track: number, string: number, fret: number) =>
        add(`preload t${track} s${string} f${fret}`),
      stopVoice: (track: number, voice: number) => add(`stopVoice t${track}v${voice}`),
      stopAll: () => add('stopAll'),
    },
  }
})
vi.mock('../src/services/editor/playbackController', () => ({
  hidePlayBackBars: () => add('hideBar'),
  initPlayBackParameters: () => {
    env.jumped = true
  },
  hasBeenJumped: () => env.jumped,
  setJumped: () => {
    env.jumped = true
  },
  movePlayBackBarToPosInBlock: (...a: number[]) => add(`bar@pos ${a.map(r).join(',')}`),
  movePlayBackBarToBeat: (...a: number[]) => add(`bar@beat ${a.map(r).join(',')}`),
  movePlayBackBarToPosition: (...a: number[]) => {
    env.jumped = false
    add(`bar->pos ${a.map(r).join(',')}`)
  },
}))
vi.mock('../src/services/editor/navigationController', () => ({
  scrollToSvgPos: (...a: number[]) => add(`scroll ${a.join(',')}`),
}))
vi.mock('../src/stores/playbackTransportState', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/stores/playbackTransportState')>()),
  publishPlaybackPosition: (block: number, beat: number, pos: number) =>
    add(`position ${block}:${beat} ${r(pos)}`),
  publishPlaybackUiStarted: () => add('ui started'),
  publishPlaybackUiStopped: () => add('ui stopped'),
}))
vi.mock('../src/stores/soundingNotesState', () => ({
  showPlaybackBeat: (notes: ({ fret: number } | null)[]) =>
    add(`sounding ${Array.from(notes, (note) => (note == null ? '.' : note.fret)).join(' ')}`),
  clearPlaybackNotes: () => add('sounding cleared'),
}))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
type Playback = (typeof import('../src/services/playback'))['default']
type SongType = (typeof import('../src/stores/song'))['default']
type Note = import('../src/stores/song').Note
type Beat = import('../src/stores/song').Beat

let playback: Playback
let scheduler: (typeof import('../src/services/playback/scheduler'))['scheduler']
let playhead: (typeof import('../src/services/playback/playhead'))['playhead']
let Song: SongType
let practice: typeof import('../src/stores/practiceState')
let range: typeof import('../src/services/editor/rangeSelection')
let Settings: (typeof import('../src/stores/settingsState'))['default']
let tabLayout: (typeof import('../src/stores/tabLayoutState'))['tabLayout']
let bus: (typeof import('../src/utils/typedEventBus'))['typedEventBus']
let lastIndicator = ''
let sequencer: typeof import('../src/stores/sequencerState')

beforeAll(async () => {
  playback = (await import('../src/services/playback')).default
  scheduler = (await import('../src/services/playback/scheduler')).scheduler
  playhead = (await import('../src/services/playback/playhead')).playhead
  Song = (await import('../src/stores/song')).default
  practice = await import('../src/stores/practiceState')
  range = await import('../src/services/editor/rangeSelection')
  Settings = (await import('../src/stores/settingsState')).default
  tabLayout = (await import('../src/stores/tabLayoutState')).tabLayout
  bus = (await import('../src/utils/typedEventBus')).typedEventBus
  sequencer = await import('../src/stores/sequencerState')
  bus.on('navigation.setClickedPos', (pos) => add(`cursor ${pos.blockId}:${pos.beatId}`))
})

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame'],
  })
  env.startMs = Date.now()
  env.log = []
  env.jumped = true
  lastIndicator = ''
  let timer: ReturnType<typeof setInterval> | null = null
  scheduler.timerWorker = {
    postMessage: (message: unknown) => {
      if (message === 'start') timer = setInterval(() => scheduler.tick(), 25)
      if (message === 'stop' && timer != null) clearInterval(timer)
    },
  } as unknown as Worker
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  vi.spyOn(sequencer, 'setSequencerIndicator').mockImplementation((track: number, block: number) => {
    const text = `${track}:${block}`
    if (text !== lastIndicator) add(`sequencer ${text}`)
    lastIndicator = text
  })
  Song.initEmptySong()
  practice.setPlaybackRate(1)
  Object.assign(practice.practiceState, { metronome: false, countIn: false, trainer: false })
  Settings.scrollingEnabled = true
  range.clearRange()
  playback.resetPosition()
  playhead.reset()
})

afterEach(() => {
  if (Settings.songPlaying) playback.stop()
  // one more animation frame: it resets the playhead state, as it does in the app after a stop
  vi.advanceTimersByTime(50)
  range.clearRange()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ---- song building -------------------------------------------------------------------

function note(fret: number, extra: Partial<Note> = {}): Note {
  return { ...Song.defaultNote(), fret, ...extra }
}

/** A beat; `notes` maps string → note. */
function beat(duration: string, notes: Record<number, Note> = {}, extra: Partial<Beat> = {}): Beat {
  const b = { ...Song.defaultMeasure(), duration: duration as never, notes: [] as (Note | null)[], ...extra }
  for (const [string, n] of Object.entries(notes)) b.notes[Number(string)] = n
  return b
}

const rests = (duration = 'wr') => [beat(duration)]

/** Sets the song's bars: one entry per bar of [track][voice 0 beats]; voice 1 rests. */
function setSong(
  bars: { meta?: Partial<(typeof Song.measureMeta)[number]>; tracks: Beat[][] }[],
  tracks: { instrument?: string; strings?: number[]; extra?: Record<string, unknown> }[] = [{}],
  bpm = 120,
): void {
  Song.tracks = tracks.map((track, index) => ({
    ...Song.tracks[0],
    ...(track.strings ? { strings: track.strings, numStrings: track.strings.length } : {}),
    channel: { index, effectChannel: 0 },
    ...track.extra,
  }))
  Song.playBackInstrument = tracks.map((track) => ({
    ...Song.playBackInstrument[0],
    instrument: track.instrument ?? 'guitar',
    volume: 100,
    mute: false,
    solo: false,
  }))
  Song.measureMeta = bars.map((bar, index) => ({
    denominator: 4,
    numerator: 4,
    timeMeterPresent: index === 0,
    repeatOpen: false,
    keySignature: 0,
    automations: [],
    ...(index === 0 ? { bpm } : {}),
    ...bar.meta,
  }))
  Song.measures = tracks.map((_, trackId) =>
    bars.map((bar) => {
      const meta = bar.meta ?? {}
      const whole = (meta.numerator ?? 4) === 3 ? 'hr' : 'wr'
      return [bar.tracks[trackId] ?? rests(), rests(whole)]
    }),
  )
  Song.setTempo(bpm)
  // rows of two bars, so the animation loop scrolls on every second bar
  tabLayout.blockToRow = tracks.map(() =>
    [0, 1].map(() => bars.map((_, block) => ({ rowId: Math.floor(block / 2) }))),
  ) as never
}

/** Four quarters with frets bar*10 + beat (so the log shows which bar played). */
const quarters = (bar: number) => [0, 1, 2, 3].map((i) => beat('q', { 0: note(bar * 10 + i) }))

function run(ms: number, actions: Record<number, () => void> = {}): void {
  const times = Object.keys(actions)
    .map(Number)
    .sort((a, b) => a - b)
  let elapsed = 0
  for (const time of times) {
    vi.advanceTimersByTime(time - elapsed)
    elapsed = time
    add(`-- ${actions[time].name || 'action'}`)
    actions[time]()
  }
  vi.advanceTimersByTime(ms - elapsed)
}

function snapshot(): string {
  return `${env.log.join('\n')}\n`
}

const file = (name: string) => `__snapshots__/playback/${name}.txt`

// ---- scenarios -----------------------------------------------------------------------

describe('playback characterization', () => {
  it('two tracks, to the end of the song', async () => {
    const eighths = (bar: number) => Array.from({ length: 8 }, (_, i) => beat('e', { 0: note(bar * 10 + i) }))
    setSong(
      [{ tracks: [quarters(0), eighths(0)] }, { tracks: [quarters(1), eighths(1)] }],
      [{}, { instrument: 'bass', strings: [28, 33, 38, 43] }],
    )
    playback.start()
    run(4800)
    await expect(snapshot()).toMatchFileSnapshot(file('two-tracks'))
  })

  it('repeats and voltas', async () => {
    // 0 |: 1 [1. 2 :| [2. 3 | 4
    setSong(
      [
        { tracks: [quarters(0)] },
        { meta: { repeatOpen: true }, tracks: [quarters(1)] },
        { meta: { repeatAlternative: 1, repeatClose: 1 }, tracks: [quarters(2)] },
        { meta: { repeatAlternative: 2 }, tracks: [quarters(3)] },
        { tracks: [quarters(4)] },
      ],
      [{}],
      240,
    )
    playback.start()
    run(6500)
    await expect(snapshot()).toMatchFileSnapshot(file('repeats'))
  })

  it('D.S. al Coda', async () => {
    // 0 | 𝄋 1 | 2 To Coda | 3 D.S. al Coda | 𝄌 4  →  0 1 2 3 1 2 4
    setSong(
      [
        { tracks: [quarters(0)] },
        { meta: { directionTargets: ['Segno'] }, tracks: [quarters(1)] },
        { meta: { directionJumps: ['DaCoda'] }, tracks: [quarters(2)] },
        { meta: { directionJumps: ['DaSegnoAlCoda'] }, tracks: [quarters(3)] },
        { meta: { directionTargets: ['Coda'] }, tracks: [quarters(4)] },
      ],
      [{}],
      240,
    )
    playback.start()
    run(7500)
    await expect(snapshot()).toMatchFileSnapshot(file('ds-al-coda'))
  })

  it('tempo and meter changes, dotted notes and triplets', async () => {
    setSong(
      [
        {
          tracks: [
            [
              beat('q', { 0: note(1) }, { dotted: true }),
              beat('e', { 0: note(2) }),
              beat('h', { 0: note(3) }),
            ],
          ],
        },
        {
          meta: { numerator: 3, bpm: 60 },
          tracks: [[beat('q', { 0: note(11) }), beat('q', { 0: note(12) }), beat('q', { 0: note(13) })]],
        },
        {
          meta: { bpm: 180 },
          tracks: [
            [
              ...[1, 2, 3].map((i) => beat('e', { 0: note(20 + i) }, { tuplet: 3, tupletId: 1 })),
              beat('q', { 0: note(24) }),
              beat('h', { 0: note(25) }),
            ],
          ],
        },
        { tracks: [quarters(3)] },
      ],
      [{}],
      120,
    )
    playback.start()
    run(9000)
    await expect(snapshot()).toMatchFileSnapshot(file('tempo-meter'))
  })

  it('note effects and instruments', async () => {
    const grace = { fret: 7, duration: 's' } as never
    setSong(
      [
        {
          tracks: [
            [
              beat(
                'q',
                { 0: note(0), 1: note(2), 2: note(2) },
                {
                  effects: {
                    ...Song.defaultMeasureEffects(),
                    stroke: { strokeType: 'down', strokeLength: 8 },
                  } as never,
                },
              ),
              beat(
                'q',
                { 0: note(0), 1: note(2), 2: note(2) },
                {
                  effects: {
                    ...Song.defaultMeasureEffects(),
                    stroke: { strokeType: 'up', strokeLength: 16 },
                  } as never,
                },
              ),
              beat('q', { 3: note(5, { graceObj: grace }), 4: note(3, { ghost: true }) }),
              beat('q', { 0: note(3, { tieBegin: true }) }),
            ],
            [
              beat('q', { 0: note(4, { slide: true }) }),
              beat('q', { 0: note(6, { letRing: true }) }),
              beat('h', { 0: note(1) }, { otherNotes: [{ ...note(0), height: 30 }] }),
            ],
            [
              beat('q', { 0: note(36) }),
              beat('q', { 0: note(38) }),
              beat('q', { 0: note(42) }),
              beat('q', { 0: note(38, { dead: true }) }),
            ],
            [beat('w', { 0: note(9) })],
          ],
        },
        {
          tracks: [
            [
              beat('q', { 0: note(3, { tied: true }) }),
              beat('q', { 0: note(3, { tied: true }) }),
              beat('h', { 1: note(4, { ghost: true }), 2: note(4) }),
            ],
            [beat('h', { 0: note(2, { graceObj: grace }) }), beat('h', { 0: note(1, { vibrato: true }) })],
            [beat('w', { 0: note(49) })],
            [beat('w', { 0: note(9) })],
          ],
        },
        { tracks: [] },
        { tracks: [] },
      ],
      [
        {},
        { instrument: 'piano' },
        { instrument: 'drums', extra: { channel: { index: 9, effectChannel: 0 } } },
        {},
      ],
    )
    Song.playBackInstrument[3].mute = true
    playback.start()
    run(4500)
    await expect(snapshot()).toMatchFileSnapshot(file('effects'))
  })

  it('solo and quiet tracks', async () => {
    // (as many bars as tracks: the old engine crashed on fewer, see playbackScheduler.test.ts)
    setSong(
      [{ tracks: [quarters(0), quarters(1), quarters(2)] }, { tracks: [] }, { tracks: [] }],
      [{}, {}, {}],
    )
    Song.playBackInstrument[1].solo = true
    Song.playBackInstrument[2].solo = true
    Song.playBackInstrument[2].volume = 3
    playback.start()
    run(2500)
    await expect(snapshot()).toMatchFileSnapshot(file('solo'))
  })

  it('count-in and metronome in 3/4', async () => {
    const threes = (bar: number) => [0, 1, 2].map((i) => beat('q', { 0: note(bar * 10 + i) }))
    setSong([
      { meta: { numerator: 3 }, tracks: [threes(0)] },
      { meta: { numerator: 3 }, tracks: [threes(1)] },
    ])
    Object.assign(practice.practiceState, { metronome: true, countIn: true })
    playback.start()
    run(5000)
    await expect(snapshot()).toMatchFileSnapshot(file('count-in'))
  })

  it('a loop set before playing, with metronome and speed trainer', async () => {
    setSong([0, 1, 2, 3].map((bar) => ({ tracks: [quarters(bar)] })))
    range.startRange(0, 1, 0, 1)
    range.extendRange(0, 2, 0, 2)
    range.applyRangeAsLoop()
    Object.assign(practice.practiceState, {
      metronome: true,
      trainer: true,
      trainerStep: 0.1,
      trainerTarget: 1.2,
    })
    practice.setPlaybackRate(0.8)
    playback.setPlayPosition(0, 1, 0, 1)
    playback.start()
    run(9000)
    env.log.push(`rate ${practice.practiceState.playbackRate}`)
    await expect(snapshot()).toMatchFileSnapshot(file('loop'))
  })

  it('a loop set while playing, then cleared', async () => {
    setSong([0, 1, 2, 3, 4, 5].map((bar) => ({ tracks: [quarters(bar)] })))
    playback.start()
    run(7000, {
      1000: function setLoop() {
        range.startRange(0, 2, 0, 2)
        range.extendRange(0, 2, 0, 3)
        range.applyRangeAsLoop()
      },
      4000: function clearLoop() {
        range.startRange(0, 4, 0, 0)
      },
    })
    await expect(snapshot()).toMatchFileSnapshot(file('loop-while-playing'))
  })

  it('jumps, bar steps, pause and resume', async () => {
    setSong([0, 1, 2, 3, 4, 5].map((bar) => ({ tracks: [quarters(bar)] })))
    playback.start()
    run(6000, {
      600: function jumpToBeat() {
        playback.jumpToBeat(0, 3, 0, 1)
      },
      1500: function backward() {
        playback.stepBackward()
      },
      2200: function forward() {
        playback.stepForward()
      },
      3000: function pause() {
        playback.togglePlayback()
        env.log.push(`position ${JSON.stringify(playback.playPosition)}`)
      },
      3500: function resume() {
        playback.togglePlayback()
      },
    })
    await expect(snapshot()).toMatchFileSnapshot(file('jumps'))
  })

  it('a loop in a bar with triplets', async () => {
    // bar 1: three triplet eighths (one quarter), then quarter 15, half 16; loop over 15–16
    const triplets = [1, 2, 3].map((i) => beat('e', { 0: note(10 + i) }, { tuplet: 3, tupletId: 1 }))
    setSong([
      { tracks: [quarters(0)] },
      { tracks: [[...triplets, beat('q', { 0: note(15) }), beat('h', { 0: note(16) })]] },
      { tracks: [quarters(2)] },
    ])
    range.startRange(0, 1, 0, 3)
    range.extendRange(0, 1, 0, 4)
    range.applyRangeAsLoop()
    playback.setPlayPosition(0, 1, 0, 3)
    playback.start()
    run(5000)
    await expect(snapshot()).toMatchFileSnapshot(file('loop-triplets'))
  })

  it('starts near a bar end with sixteenths (one tick schedules beats of two bars)', async () => {
    const sixteenths = (bar: number) =>
      Array.from({ length: 16 }, (_, i) => beat('s', { 0: note(bar * 20 + i) }))
    setSong([0, 1, 2].map((bar) => ({ tracks: [sixteenths(bar)] })))
    playback.setPlayPosition(0, 0, 0, 14)
    playback.start()
    run(1500)
    await expect(snapshot()).toMatchFileSnapshot(file('bar-end-sixteenths'))
  })

  it('starts mid-bar, preloads, follows a track change', async () => {
    setSong(
      [0, 1, 2].map((bar) => ({ tracks: [quarters(bar), quarters(bar + 5)] })),
      [{}, {}],
    )
    playback.setPlayPosition(0, 1, 0, 2)
    playback.preloadStart()
    playback.start()
    run(3000, {
      1200: function changeTrack() {
        Song.currentTrackId = 1
        playback.followTrackChange()
      },
    })
    env.log.push(
      `current block ${playback.getCurrentBlock()} time ${JSON.stringify(playback.songPosition())}`,
    )
    Song.currentTrackId = 0
    await expect(snapshot()).toMatchFileSnapshot(file('mid-bar'))
  })
})
