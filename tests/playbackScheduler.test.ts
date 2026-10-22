// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Drives the real playback scheduler (`playbackEngine.scheduler`) on a fake clock: Vitest's
 * fake timers stand in for the timer worker's 25 ms ticks, and the audio clock reads the same
 * fake time. `playChord` is recorded instead of played, so the test sees exactly when every
 * beat is scheduled.
 */

const clock = vi.hoisted(() => ({ startMs: 0 }))

vi.mock('../src/assets/js/audioEngine', () => {
  const audioEngine: Record<string | symbol, unknown> = {
    getCurrentTime: () => (Date.now() - clock.startMs) / 1000,
    ensureContextRunning: () => Promise.resolve(),
    playMetronomeNote: vi.fn(),
    noteToDrum: new Map(),
  }
  // Every other engine call (meters, busses, synthesis) is a no-op here.
  const engine = new Proxy(audioEngine, {
    get: (target, key) => {
      if (!(key in target)) target[key] = vi.fn()
      return target[key]
    },
  })
  return { audioEngine: engine, default: engine }
})
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

type PlaybackModule = typeof import('../src/assets/js/playbackEngine')
type SongModule = typeof import('../src/assets/js/songData')

let playback: PlaybackModule['default']
let Song: SongModule['default']
let audioEngine: { playMetronomeNote: ReturnType<typeof vi.fn> }
let practice: typeof import('../src/stores/practiceState')
let tempo: typeof import('../src/stores/tempoState')
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
  playback = (await import('../src/assets/js/playbackEngine')).default
  Song = (await import('../src/assets/js/songData')).default
  audioEngine = (await import('../src/assets/js/audioEngine')).audioEngine as never
  practice = await import('../src/stores/practiceState')
  tempo = await import('../src/stores/tempoState')
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
  audioEngine.playMetronomeNote.mockClear()

  // The timer worker, on fake timers: 'start' ticks the scheduler every 25 ms, 'stop' ends it.
  let timer: ReturnType<typeof setInterval> | null = null
  playback.timerWorker = {
    postMessage: (message: unknown) => {
      if (message === 'start') timer = setInterval(() => playback.scheduler(), TICK_MS)
      if (message === 'stop' && timer != null) clearInterval(timer)
    },
  } as unknown as Worker

  const PlayBackLogic = playback.constructor as unknown as { playChord: (...args: unknown[]) => void }
  vi.spyOn(PlayBackLogic, 'playChord').mockImplementation((...args: unknown[]) => {
    const [track, block, voice, beat, duration, start] = args as number[]
    scheduled.push({ track, voice, block, beat, start, duration })
  })

  Song.initEmptySong()
  practice.setPlaybackRate(1)
  practice.practiceState.metronome = false
  practice.practiceState.countIn = false
  practice.practiceState.trainer = false
  playback.resetPlayBack()
})

afterEach(() => {
  if (playback.timerWorker) playback.stopSong()
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
    playback.startPlayback()
    const first = playback.playStartAudioTime

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
    const PlayBackLogic = playback.constructor as unknown as { playChord: (...args: unknown[]) => void }
    vi.mocked(PlayBackLogic.playChord).mockImplementation((...args: unknown[]) => {
      if (args[0] !== 0 || args[2] !== 0) return
      const start = args[5] as number
      lateness.push(start - (Date.now() - clock.startMs) / 1000)
    })
    playback.startPlayback()
    vi.advanceTimersByTime(4000)

    expect(lateness.length).toBeGreaterThanOrEqual(2)
    for (const lead of lateness) {
      expect(lead).toBeGreaterThanOrEqual(-0.001)
      // The look-ahead plus one tick of the timer.
      expect(lead).toBeLessThanOrEqual(playback.scheduleAhead + TICK_MS / 1000 + 0.01)
    }
  })

  it('stretches the timing with the practice speed, not the written tempo', () => {
    fillQuarters(2, 120)
    practice.setPlaybackRate(0.5)
    playback.startPlayback()
    const first = playback.playStartAudioTime
    vi.advanceTimersByTime(5000)

    const bar1 = startTimesOf(0)
    expect(bar1).toHaveLength(4)
    bar1.forEach((start, index) => expect(start).toBeCloseTo(first + index * 1, 2))
    expect(Song.bpm).toBe(120)
  })

  it('clicks the metronome on every beat when it is on', () => {
    fillQuarters(2, 120)
    practice.practiceState.metronome = true
    playback.startPlayback()
    const first = playback.playStartAudioTime
    vi.advanceTimersByTime(2200)

    const clicks = audioEngine.playMetronomeNote.mock.calls
      .map(([time, accent]) => ({ time: time as number, accent: accent as boolean }))
      .filter((click) => click.time < first + 2 - 0.01)
    expect(clicks.map((click) => click.accent)).toEqual([true, false, false, false])
    clicks.forEach((click, index) => expect(click.time).toBeCloseTo(first + index * 0.5, 2))
  })

  it('stops after the last bar', () => {
    fillQuarters(12, 240)
    playback.startPlayback()
    // 12 bars of 4/4 at 240 BPM take 12 s.
    vi.advanceTimersByTime(13_000)
    expect(new Set(melody().map((entry) => entry.block)).size).toBe(12)
    const count = scheduled.length
    vi.advanceTimersByTime(2000)
    expect(scheduled.length).toBe(count)
  })
})
