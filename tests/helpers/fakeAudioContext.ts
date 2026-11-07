/**
 * A Web Audio stand-in that records what the audio code does: every node it creates, every
 * connection and every parameter change, as lines of text (`gain#3.gain.setValueAtTime(0, 1)`).
 * Tests compare that log against a snapshot, so a refactor that changes the graph shows up.
 */

const round = (value: unknown): unknown => (typeof value === 'number' ? Number(value.toPrecision(10)) : value)

export class AudioLog {
  lines: string[] = []
  private counters = new Map<string, number>()

  add(line: string): void {
    this.lines.push(line)
  }

  nextId(kind: string): string {
    const count = (this.counters.get(kind) ?? 0) + 1
    this.counters.set(kind, count)
    return `${kind}#${count}`
  }

  call(target: string, method: string, args: unknown[]): void {
    const text = args
      .map((arg) => {
        if (arg instanceof FakeNode || arg instanceof FakeParam) return arg.id
        if (arg instanceof Float32Array) return `Float32Array(${arg.length})`
        return JSON.stringify(round(arg))
      })
      .join(', ')
    this.add(`${target}.${method}(${text})`)
  }

  take(): string[] {
    const { lines } = this
    this.lines = []
    return lines
  }
}

export class FakeParam {
  private current: number

  constructor(
    private readonly log: AudioLog,
    readonly id: string,
    initial: number,
  ) {
    this.current = initial
  }

  get value(): number {
    return this.current
  }

  set value(value: number) {
    this.current = value
    this.log.add(`${this.id}.value = ${String(round(value))}`)
  }

  setValueAtTime(...args: unknown[]): this {
    this.log.call(this.id, 'setValueAtTime', args)
    return this
  }

  linearRampToValueAtTime(...args: unknown[]): this {
    this.log.call(this.id, 'linearRampToValueAtTime', args)
    return this
  }

  exponentialRampToValueAtTime(...args: unknown[]): this {
    this.log.call(this.id, 'exponentialRampToValueAtTime', args)
    return this
  }

  setValueCurveAtTime(...args: unknown[]): this {
    this.log.call(this.id, 'setValueCurveAtTime', args)
    return this
  }

  setTargetAtTime(...args: unknown[]): this {
    this.log.call(this.id, 'setTargetAtTime', args)
    return this
  }

  cancelScheduledValues(...args: unknown[]): this {
    this.log.call(this.id, 'cancelScheduledValues', args)
    return this
  }
}

export class FakeNode {
  readonly id: string
  listeners = new Map<string, (event: Event) => void>()
  onended: (() => void) | null = null

  constructor(
    protected readonly log: AudioLog,
    kind: string,
    params: Record<string, number> = {},
    props: Record<string, unknown> = {},
  ) {
    this.id = log.nextId(kind)
    log.add(`create ${this.id}`)
    for (const [name, initial] of Object.entries(params)) {
      ;(this as unknown as Record<string, FakeParam>)[name] = new FakeParam(
        log,
        `${this.id}.${name}`,
        initial,
      )
    }
    // plain properties log their assignments too (buffer, loop, fftSize…)
    for (const [name, initial] of Object.entries(props)) {
      let current = initial
      Object.defineProperty(this, name, {
        get: () => current,
        set: (value: unknown) => {
          current = value
          const shown = value instanceof FakeBuffer ? value.id : JSON.stringify(round(value))
          log.add(`${this.id}.${name} = ${shown}`)
        },
      })
    }
  }

  connect(target: FakeNode | FakeParam, ...rest: unknown[]): FakeNode | FakeParam {
    this.log.call(this.id, 'connect', [target, ...rest])
    return target
  }

  disconnect(...args: unknown[]): void {
    this.log.call(this.id, 'disconnect', args)
  }

  start(...args: unknown[]): void {
    this.log.call(this.id, 'start', args)
  }

  stop(...args: unknown[]): void {
    this.log.call(this.id, 'stop', args)
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.log.add(`${this.id}.addEventListener(${type})`)
    this.listeners.set(type, listener)
  }

  removeEventListener(type: string): void {
    this.log.add(`${this.id}.removeEventListener(${type})`)
    this.listeners.delete(type)
  }

  get frequencyBinCount(): number {
    return ((this as unknown as { fftSize?: number }).fftSize ?? 2048) / 2
  }

  getByteFrequencyData(array: Uint8Array): void {
    array.fill(0)
  }
}

export class FakeBuffer {
  readonly id: string
  private readonly channels: Float32Array[]

  constructor(
    log: AudioLog,
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.id = log.nextId('buffer')
    log.add(`create ${this.id}(${numberOfChannels}, ${length}, ${sampleRate})`)
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel]
  }
}

export class FakeAudioContext {
  readonly log: AudioLog
  currentTime = 0
  state: AudioContextState = 'running'
  readonly destination: FakeNode

  constructor(log = new AudioLog()) {
    this.log = log
    this.destination = new FakeNode(log, 'destination')
  }

  resume(): Promise<void> {
    this.log.add('context.resume()')
    this.state = 'running'
    return Promise.resolve()
  }

  createGain(): FakeNode {
    return new FakeNode(this.log, 'gain', { gain: 1 })
  }

  createStereoPanner(): FakeNode {
    return new FakeNode(this.log, 'pan', { pan: 0 })
  }

  createAnalyser(): FakeNode {
    return new FakeNode(this.log, 'analyser', {}, { fftSize: 2048, smoothingTimeConstant: 0.8 })
  }

  createDynamicsCompressor(): FakeNode {
    return new FakeNode(this.log, 'compressor', {
      threshold: -24,
      knee: 30,
      ratio: 12,
      attack: 0.003,
      release: 0.25,
    })
  }

  createBufferSource(): FakeNode {
    return new FakeNode(
      this.log,
      'source',
      { playbackRate: 1, detune: 0 },
      { buffer: null, loop: false, loopStart: 0, loopEnd: 0 },
    )
  }

  createOscillator(): FakeNode {
    return new FakeNode(this.log, 'oscillator', { frequency: 440, detune: 0 }, { type: 'sine' })
  }

  createBiquadFilter(): FakeNode {
    return new FakeNode(this.log, 'biquad', { frequency: 350, Q: 1, gain: 0, detune: 0 }, { type: 'lowpass' })
  }

  createConvolver(): FakeNode {
    return new FakeNode(this.log, 'convolver', {}, { buffer: null })
  }

  createWaveShaper(): FakeNode {
    return new FakeNode(this.log, 'waveshaper', {}, { curve: null })
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(this.log, numberOfChannels, length, sampleRate)
  }
}
