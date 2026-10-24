import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs build script without types
import { buildTestSoundFont } from '../scripts/make-test-soundfont.mjs'
import { AudioLog, FakeAudioContext, type FakeNode } from './helpers/fakeAudioContext'

/**
 * The audio engine (`services/audio/`) on a fake AudioContext that logs every node,
 * connection and parameter change: the bus graph, SoundFont notes with each effect, drums,
 * MIDI pitches, the metronome and stopping. The logs are file snapshots: they were recorded
 * from the old `assets/js/audioEngine.ts` before it was split, so a refactor has to keep the
 * graph. (Differences since then: a skipped note no longer creates a source node, and a
 * trill's curve spans the note instead of `start + 2 × duration`.) The effects (chorus,
 * reverb) are stand-ins here; `effects.ts` has its own test.
 */

const audio = vi.hoisted(() => ({ log: null as unknown as AudioLog }))

vi.mock('../src/stores/song', () => {
  const track = (strings: number[], extra: Record<string, unknown> = {}) => ({
    strings,
    capo: 0,
    channel: null,
    primaryChannel: 0,
    program: 25,
    letItRing: false,
    ...extra,
  })
  const song = {
    tracks: [track([40, 45, 50, 55, 59, 64]), track([0, 0, 0, 0, 0, 0], { primaryChannel: 9, program: 0 })],
    playBackInstrument: [
      { volume: 80, balance: 32, chorus: 20, reverb: 40, instrument: 'guitar' },
      { volume: 100, balance: 64, chorus: 0, reverb: 0, instrument: 'drums' },
    ],
    allChannels: [],
    measures: [[], []],
  }
  return { default: song }
})
vi.mock('../src/services/audio/effects', () => {
  class Effect {
    input: FakeNode
    output: FakeNode
    constructor(
      readonly ctx: FakeAudioContext,
      readonly kind: string,
      options: Record<string, number>,
    ) {
      ctx.log.add(`new ${kind}(${JSON.stringify(options)})`)
      this.input = ctx.createGain()
      this.output = ctx.createGain()
      this.input.connect(this.output)
    }
    ensureStarted() {
      this.ctx.log.add(`${this.kind}.ensureStarted()`)
    }
    dispose() {
      this.ctx.log.add(`${this.kind}.dispose()`)
    }
    set wetGain(value: number) {
      this.ctx.log.add(`${this.kind}.wetGain = ${value}`)
    }
    set dry(value: number) {
      this.ctx.log.add(`${this.kind}.dry = ${value}`)
    }
  }
  return {
    Chorus: class extends Effect {
      constructor(ctx: FakeAudioContext, options: Record<string, number>) {
        super(ctx, 'Chorus', options)
      }
    },
    Freeverb: class extends Effect {
      constructor(ctx: FakeAudioContext, options: Record<string, number>) {
        super(ctx, 'Freeverb', options)
      }
    },
  }
})
vi.mock('../src/services/dialogs/modalManager', () => ({
  modalManager: {
    getHandler: (name: string) => ({
      attach: (node: FakeNode) => audio.log.add(`${name}.attach(${node.id})`),
      setAudioContext: () => audio.log.add(`${name}.setAudioContext()`),
      insertBetween: (from: FakeNode, to: FakeNode) => {
        audio.log.add(`${name}.insertBetween(${from.id}, ${to.id})`)
        from.connect(to)
      },
      drawSpectrum: () => {},
    }),
    isModalOpen: () => false,
  },
}))

let graph: (typeof import('../src/services/audio/audioGraph'))['audioGraph']
let player: (typeof import('../src/services/audio/samplePlayer'))['samplePlayer']
let metronome: (typeof import('../src/services/audio/metronome'))['metronome']
let drums: typeof import('../src/services/audio/drumKit')
let synth: (typeof import('../src/services/audio/soundFont/synth'))['synth']
let context: FakeAudioContext

beforeAll(async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  audio.log = new AudioLog()
  const { FakeAudioContext: Context } = await import('./helpers/fakeAudioContext')
  ;(globalThis as Record<string, unknown>).AudioContext = class extends Context {
    constructor() {
      super(audio.log)
    }
  }
  graph = (await import('../src/services/audio/audioGraph')).audioGraph
  player = (await import('../src/services/audio/samplePlayer')).samplePlayer
  metronome = (await import('../src/services/audio/metronome')).metronome
  drums = await import('../src/services/audio/drumKit')
  synth = (await import('../src/services/audio/soundFont/synth')).synth
  context = graph.context as unknown as FakeAudioContext
  ;(await import('../src/services/audio/soundFont/loader')).loadSoundFontBytes(buildTestSoundFont())
})

afterAll(() => {
  vi.restoreAllMocks()
})

const beat = (extra: Record<string, unknown> = {}) => ({ dynamic: null, effects: null, ...extra }) as never
const note = (extra: Record<string, unknown> = {}) => ({ fret: 3, ...extra }) as never

/** The log with node ids numbered from 1 per kind, so one extra node elsewhere doesn't shift them all. */
function snapshotOf(lines: string[]): string {
  const ids = new Map<string, string>()
  const counts = new Map<string, number>()
  const text = lines.join('\n').replace(/([a-z]+)#\d+/g, (id, kind: string) => {
    if (!ids.has(id)) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
      ids.set(id, `${kind}#${counts.get(kind)}`)
    }
    return ids.get(id)!
  })
  return `${text}\n`
}

describe('audio engine graph', () => {
  it('builds the master chain and one bus per drum piece', async () => {
    graph.createBusses()
    await expect(snapshotOf(audio.log.take())).toMatchFileSnapshot('__snapshots__/audio/createBusses.txt')
  })

  it('builds a bus per track and disposes the old ones on rebuild', async () => {
    const channels = [
      { balance: 32, chorus: 20, reverb: 40 },
      { balance: 64, chorus: 0, reverb: 0 },
    ] as never
    graph.updateBusses(channels)
    graph.updateBusses(channels)
    await expect(snapshotOf(audio.log.take())).toMatchFileSnapshot('__snapshots__/audio/updateBusses.txt')
  })

  it('sets mixer values on the buses', async () => {
    graph.setEffectGain(0, 64, 'reverb')
    graph.setEffectGain(0, 32, 'chorus')
    graph.setEffectGain(0, 127, 'pan')
    graph.setMasterGain(0.5)
    context.state = 'suspended'
    await graph.ensureContextRunning()
    await expect(snapshotOf(audio.log.take())).toMatchFileSnapshot('__snapshots__/audio/mixer.txt')
  })
})

describe('audio engine notes', () => {
  const cases: [string, () => unknown][] = [
    ['plain', () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note(), 'guitar', null)],
    ['no note effects', () => player.playFret(0, 0, 2, 5, 1, 1, 0.5, beat(), null, 'guitar', null)],
    [
      'dynamic ff',
      () => player.playFret(0, 0, 1, 2, 0.8, 2, 0.25, beat({ dynamic: 'ff' }), note(), 'guitar', null),
    ],
    [
      'let ring',
      () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ letRing: true }), 'guitar', null),
    ],
    ['dead', () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ dead: true }), 'guitar', null)],
    ['slap', () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ slap: true }), 'guitar', null)],
    [
      'harmonic',
      () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ artificialStyle: 0 }), 'guitar', null),
    ],
    [
      'trill',
      () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ trill: { fret: 5 } }), 'guitar', null),
    ],
    [
      'bend',
      () =>
        player.playFret(
          0,
          0,
          0,
          3,
          1,
          1,
          0.5,
          beat(),
          note({
            bendObj: [
              { bendPosition: 0, bendValue: 0 },
              { bendPosition: 6, bendValue: 100 },
              { bendPosition: 12, bendValue: 100 },
            ],
          }),
          'guitar',
          null,
        ),
    ],
    ['slide', () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ slide: true }), 'guitar', 5)],
    [
      'vibrato',
      () => player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note({ vibrato: true }), 'guitar', null),
    ],
    ['drum', () => player.playFret(1, 0, 0, 38, 1, 1, 0.5, beat(), null, 'drums', null)],
    [
      'muted drum',
      () => {
        drums.noteToDrum.get(38)![4] = false
        const gain = player.playFret(1, 0, 0, 38, 1, 1, 0.5, beat(), null, 'drums', null)
        drums.noteToDrum.get(38)![4] = true
        return gain
      },
    ],
    [
      'drum solo',
      () => {
        drums.drumSolo.add(36)
        const gains = [38, 36].map((fret) =>
          player.playFret(1, 0, 0, fret, 1, 1, 0.5, beat(), null, 'drums', null),
        )
        drums.drumSolo.clear()
        return gains.map((gain) => gain != null)
      },
    ],
    ['preload', () => player.preloadFret(0, 3, 7)],
    ['metronome accent', () => metronome.playClick(0.5, true)],
    ['metronome', () => metronome.playClick(1, false)],
    // MIDI pitches (live keys, recorded notes that fit no string): E4 on the guitar
    // (string 0 is E2 = 40, so fret 24 on it), and the snare on the drum track
    ['pitch', () => player.playPitch(0, 0, 64, 1, 1, 0.5, beat(), null)],
    ['pitch drum', () => player.playPitch(1, 0, 38, 1, 1, 0.5, beat(), null)],
  ]

  it.each(cases)('%s', async (name, play) => {
    const result = play() as { id?: string } | null | undefined
    const lines = audio.log.take()
    lines.push(`=> ${result == null ? String(result) : (result.id ?? JSON.stringify(result))}`)
    await expect(snapshotOf(lines)).toMatchFileSnapshot(
      `__snapshots__/audio/note-${name.replace(/ /g, '-')}.txt`,
    )
  })

  it('stops the sources of one voice, then all', async () => {
    player.stopAll()
    audio.log.take()
    player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note(), 'guitar', null)
    player.playFret(0, 1, 0, 5, 1, 1, 0.5, beat(), note(), 'guitar', null)
    player.playFret(1, 0, 0, 36, 1, 1, 0.5, beat(), null, 'drums', null)
    audio.log.take()
    context.currentTime = 1.2
    player.stopVoice(0, 1)
    const afterVoice = player.playing.size
    player.stopAll()
    const lines = [...audio.log.take(), `playing after voice stop: ${afterVoice}`]
    lines.push(`playing after stop all: ${player.playing.size}`)
    await expect(snapshotOf(lines)).toMatchFileSnapshot('__snapshots__/audio/stop.txt')
  })

  it('forgets a source when it ends', () => {
    player.stopAll()
    player.playFret(0, 0, 0, 3, 1, 1, 0.5, beat(), note(), 'guitar', null)
    const [playing] = player.playing
    const source = playing.source as unknown as FakeNode
    source.listeners.get('ended')!({ target: source } as never)
    expect(player.playing.size).toBe(0)
    expect(audio.log.take()).toEqual(
      expect.arrayContaining([`${source.id}.disconnect()`, `${source.id}.removeEventListener(ended)`]),
    )
  })

  it('converts a SoundFont sample to floats once per key', () => {
    const first = synth.noteOn(25, 64, 100, 0)!
    const again = synth.noteOn(25, 64, 100, 0)!
    const drum = synth.noteOn(9, 38, 100, 9)!
    expect(again.buffer).toBe(first.buffer)
    const data = Array.from((first.buffer as AudioBuffer).getChannelData(0))
    expect({ length: data.length, sum: Number(data.reduce((a, b) => a + Math.abs(b), 0).toFixed(6)) })
      .toMatchInlineSnapshot(`
      {
        "length": 100,
        "sum": 23.306497,
      }
    `)
    expect({ ...first, buffer: undefined }).toMatchInlineSnapshot(`
      {
        "buffer": undefined,
        "loop": true,
        "loopEnd": 0.0022675736961451248,
        "loopStart": 0,
        "playBackRate": 0.7491535384383405,
        "volAttack": 0.0009765625,
        "volDecay": 0.001953125,
        "volRelease": 0.0009765625,
        "volSustain": 0,
      }
    `)
    expect([drum.loop, synth.noteOn(3, 200, 100, 0)]).toMatchInlineSnapshot(`
      [
        false,
        null,
      ]
    `)
  })
})
