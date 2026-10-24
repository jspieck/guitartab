// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Drives the real playback scheduler (`services/playback/scheduler.ts`) on a fake clock: Vitest's
 * fake timers stand in for the timer worker's 25 ms ticks, and the audio clock reads the same
 * fake time. `notePlayback.playBeat` is recorded instead of played, so the test sees exactly when every
 * beat is scheduled.
 */

const clock = vi.hoisted(() => ({ startMs: 0 }))

// Every audio call not listed (buses, synthesis) is a no-op here.
const { noOpProxy } = vi.hoisted(() => ({
  noOpProxy: (known: Record<string | symbol, unknown>) =>
    new Proxy(known, {
      get: (target, key) => {
        if (!(key in target)) target[key] = vi.fn()
        return target[key]
      },
    }),
}))
vi.mock('../src/services/audio/audioGraph', () => ({
  audioGraph: noOpProxy({
    getCurrentTime: () => (Date.now() - clock.startMs) / 1000,
    ensureContextRunning: () => Promise.resolve(),
  }),
}))
vi.mock('../src/services/audio/samplePlayer', () => ({ samplePlayer: noOpProxy({}) }))
vi.mock('../src/services/audio/meters', () => ({ drawMeters: vi.fn() }))
vi.mock('../src/services/audio/metronome', () => ({ metronome: { playClick: vi.fn() } }))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

type SongModule = typeof import('../src/stores/song')

let playback: (typeof import('../src/services/playback'))['default']
let scheduler: (typeof import('../src/services/playback/scheduler'))['scheduler']
let notePlayback: (typeof import('../src/services/playback/notePlayback'))['notePlayback']
let Song: SongModule['default']
let metronome: { playClick: ReturnType<typeof vi.fn> }
let practice: typeof import('../src/stores/practiceState')
let tempo: typeof import('../src/stores/tempoState')
let Settings: (typeof import('../src/stores/settingsState'))['default']
const scheduled: {
  track: number
  voice: number
  block: number
  beat: number
  start: number
  duration: number
}[] = []

const TICK_MS = 25

beforeAll(async () => {
  playback = (await import('../src/services/playback')).default
  scheduler = (await import('../src/services/playback/scheduler')).scheduler
  notePlayback = (await import('../src/services/playback/notePlayback')).notePlayback
  Song = (await import('../src/stores/song')).default
  metronome = (await import('../src/services/audio/metronome')).metronome as never
  practice = await import('../src/stores/practiceState')
  tempo = await import('../src/stores/tempoState')
  Settings = (await import('../src/stores/settingsState')).default
})

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'Date',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  })
  clock.startMs = Date.now()
  scheduled.length = 0
  metronome.playClick.mockClear()

  // The timer worker, on fake timers: 'start' ticks the scheduler every 25 ms, 'stop' ends it.
  let timer: ReturnType<typeof setInterval> | null = null
  scheduler.timerWorker = {
    postMessage: (message: unknown) => {
      if (message === 'start') timer = setInterval(() => scheduler.tick(), TICK_MS)
      if (message === 'stop' && timer != null) clearInterval(timer)
    },
  } as unknown as Worker

  vi.spyOn(notePlayback, 'playBeat').mockImplementation((...args: unknown[]) => {
    const [track, block, voice, beat, duration, start] = args as number[]
    scheduled.push({ track, voice, block, beat, start, duration })
  })

  Song.initEmptySong()
  practice.setPlaybackRate(1)
  practice.practiceState.metronome = false
  practice.practiceState.countIn = false
  practice.practiceState.trainer = false
  playback.resetPosition()
})

afterEach(() => {
  if (Settings.songPlaying) playback.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Bars of four quarter notes on the open low E. */
function fillQuarters(bars: number, bpm: number): void {
  tempo.setTempoState(bpm)
  for (let block = 0; block < bars; block += 1) {
    Song.measureMeta[block].bpm = bpm
    Song.measures[0][block][0] = Array.from({ length: 4 }, () => {
      const beat = Song.defaultMeasure()
      beat.duration = 'q'
      beat.notes = [{ ...Song.defaultNote(), fret: 0 }]
      return beat
    })
  }
}

/** The quarter notes of track 1, voice 1 (voice 2 of the empty song holds rests). */
function melody() {
  return scheduled.filter((entry) => entry.track === 0 && entry.voice === 0)
}

function startTimesOf(block: number): number[] {
  return melody()
    .filter((entry) => entry.block === block)
    .map((entry) => entry.start)
}

describe('playback scheduler', () => {
  it('schedules quarter notes half a second apart at 120 BPM, bar after bar', () => {
    fillQuarters(3, 120)
    playback.start()
    const first = scheduler.playStartAudioTime

    vi.advanceTimersByTime(3500)

    const bar1 = startTimesOf(0)
    const bar2 = startTimesOf(1)
    expect(bar1).toHaveLength(4)
    expect(bar2).toHaveLength(4)
    bar1.forEach((start, index) => expect(start).toBeCloseTo(first + index * 0.5, 2))
    bar2.forEach((start, index) => expect(start).toBeCloseTo(first + 2 + index * 0.5, 2))
    for (const entry of melody()) expect(entry.duration).toBeCloseTo(0.5, 3)
  })

  it.each([
    [120, 1],
    [60, 1],
    [120, 0.5],
  ])('at %i BPM and speed %f, schedules ahead of the clock: never late, at most 0.4 s early', (bpm, rate) => {
    fillQuarters(2, bpm)
    practice.setPlaybackRate(rate)
    const lateness: number[] = []
    vi.mocked(notePlayback.playBeat).mockImplementation((...args: unknown[]) => {
      if (args[0] !== 0 || args[2] !== 0) return
      const start = args[5] as number
      lateness.push(start - (Date.now() - clock.startMs) / 1000)
    })
    playback.start()
    vi.advanceTimersByTime(4000)

    expect(lateness.length).toBeGreaterThanOrEqual(2)
    for (const lead of lateness) {
      expect(lead).toBeGreaterThanOrEqual(-0.001)
      // The look-ahead plus one tick of the timer.
      expect(lead).toBeLessThanOrEqual(scheduler.scheduleAhead + TICK_MS / 1000 + 0.01)
    }
  })

  it('stretches the timing with the practice speed, not the written tempo', () => {
    fillQuarters(2, 120)
    practice.setPlaybackRate(0.5)
    playback.start()
    const first = scheduler.playStartAudioTime
    vi.advanceTimersByTime(5000)

    const bar1 = startTimesOf(0)
    expect(bar1).toHaveLength(4)
    bar1.forEach((start, index) => expect(start).toBeCloseTo(first + index * 1, 2))
    expect(Song.bpm).toBe(120)
  })

  it('clicks the metronome on every beat when it is on', () => {
    fillQuarters(2, 120)
    practice.practiceState.metronome = true
    playback.start()
    const first = scheduler.playStartAudioTime
    vi.advanceTimersByTime(2200)

    const clicks = metronome.playClick.mock.calls
      .map(([time, accent]) => ({ time: time as number, accent: accent as boolean }))
      .filter((click) => click.time < first + 2 - 0.01)
    expect(clicks.map((click) => click.accent)).toEqual([true, false, false, false])
    clicks.forEach((click, index) => expect(click.time).toBeCloseTo(first + index * 0.5, 2))
  })

  it('stops after the last bar', () => {
    fillQuarters(12, 240)
    playback.start()
    // 12 bars of 4/4 at 240 BPM take 12 s.
    vi.advanceTimersByTime(13_000)
    expect(new Set(melody().map((entry) => entry.block)).size).toBe(12)
    const count = scheduled.length
    vi.advanceTimersByTime(2000)
    expect(scheduled.length).toBe(count)
  })

  it('plays a song with more tracks than bars', () => {
    // Play used to throw here: it counted bars with the number of tracks.
    fillQuarters(1, 120)
    Song.measures.length = 1
    Song.measureMeta.length = 1
    for (let track = 1; track < 3; track += 1) {
      Song.tracks.push({ ...Song.tracks[0] })
      Song.playBackInstrument.push({ ...Song.playBackInstrument[0] })
      Song.measures.push(
        Song.measures[0].map((voices) => voices.map((voice) => voice.map((beat) => ({ ...beat })))),
      )
    }
    expect(() => playback.start()).not.toThrow()
    vi.advanceTimersByTime(1000)
    expect(new Set(scheduled.map((entry) => entry.track))).toEqual(new Set([0, 1, 2]))
  })
})
