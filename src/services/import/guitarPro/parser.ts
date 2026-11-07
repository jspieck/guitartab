import Song, { type Beat, type MeasureMetaInfo, type Track } from '../../../stores/song'
import { DIRECTION_JUMPS, DIRECTION_TARGETS } from '../../../utils/directions'
import { MAX_LYRIC_VERSES, type LyricLine } from '../../../utils/lyrics'
import { ampFromToneNames } from '../../audio/ampModel'
import { IMPORT_LIMITS, ImportError } from '../../importErrors'
import { GuitarProBeatReader, type GuitarProVersion } from './beatReader'
import type { ByteReader } from './byteReader'
import type { GuitarProSong } from './guitarProSong'

const GP5_VERSIONS = ['FICHIER GUITAR PRO v5.00', 'FICHIER GUITAR PRO v5.10']

/**
 * Reads a Guitar Pro 3, 4 or 5 file into a GuitarProSong. One reader for all
 * three: GP4 adds lyrics and a second byte of effect flags to GP3, GP5 adds
 * page setup, navigation signs, two voices per bar and RSE data. Each
 * `version` check is one such difference.
 */
export class GuitarProParser {
  /** 1 for GP 5.10, which adds a few fields; 0 otherwise. */
  minor = 0
  private beats!: GuitarProBeatReader

  constructor(
    private readonly r: ByteReader,
    private readonly song: GuitarProSong,
    readonly version: GuitarProVersion,
  ) {}

  read() {
    this.readVersion()
    this.beats = new GuitarProBeatReader(this.r, this.song, this.version, this.minor)
    this.readInfo()
    if (this.version < 5) this.r.readByte() // triplet feel
    if (this.version >= 4) this.readLyrics()
    if (this.version === 5) this.readPageSetup()

    const tempoValue = this.r.readInt()
    this.song.bpm = tempoValue
    if (this.minor > 0) this.r.skipBytes(1) // hide tempo
    // The song's key in fifths (1 = G, -1 = F); bar headers change it
    let key: number
    if (this.version === 3) {
      key = this.r.readByte()
      this.r.skipBytes(3)
    } else {
      key = this.r.readInt()
      this.r.readByte() // octave
    }
    this.readChannels()
    let directions: { targets: number[]; jumps: number[] } | undefined
    if (this.version === 5) {
      directions = this.readDirections()
      this.r.readInt() // master reverb
    }

    const numMeasures = this.r.readCount(IMPORT_LIMITS.measures, 'bars')
    const numTracks = this.r.readCount(IMPORT_LIMITS.tracks, 'tracks')
    if (numMeasures === 0) {
      throw new ImportError('The file has no bars.', `gp${this.version}`, { offset: this.r.position })
    }
    for (let t = 0; t < numTracks; t += 1) {
      this.song.chords.push(new Map())
    }
    this.song.measureMeta.length = 0
    for (let i = 0; i < numMeasures; i += 1) {
      this.song.measureMeta[i] = Song.defaultMeasureMeta()
    }
    this.song.measureMeta[0].bpm = tempoValue
    this.song.measureMeta[0].keySignature = Math.max(-7, Math.min(7, key))

    this.readMeasureHeaders(numMeasures)
    if (directions) this.applyDirections(directions)
    this.readTracks(numTracks)
    this.readMeasures(numMeasures, numTracks)
  }

  /** Checks the version string; sets `minor` for GP 5.10. */
  readVersion() {
    const version = this.r.readStringByte(30)
    const supported =
      this.version === 5
        ? GP5_VERSIONS.includes(version)
        : version.startsWith(`FICHIER GUITAR PRO v${this.version}`)
    if (!supported) {
      throw new ImportError(
        `Unsupported Guitar Pro version "${version}". Open a Guitar Pro ${this.version} file here.`,
        `gp${this.version}`,
      )
    }
    this.minor = version === GP5_VERSIONS[1] ? 1 : 0
  }

  readInfo() {
    const d = this.song.description
    d.title = this.r.readStringByteSizeOfInteger()
    d.subtitle = this.r.readStringByteSizeOfInteger()
    d.artist = this.r.readStringByteSizeOfInteger()
    d.album = this.r.readStringByteSizeOfInteger()
    d.author = this.r.readStringByteSizeOfInteger()
    if (this.version === 5) d.music = this.r.readStringByteSizeOfInteger()
    d.copyright = this.r.readStringByteSizeOfInteger()
    d.writer = this.r.readStringByteSizeOfInteger()
    d.instructions = this.r.readStringByteSizeOfInteger()
    d.comments = []
    const comments = this.r.readCount(IMPORT_LIMITS.comments, 'comment lines')
    for (let i = 0; i < comments; i += 1) {
      d.comments[i] = this.r.readStringByteSizeOfInteger()
    }
  }

  /** The lyric track (1-based, 0 = none) and five lines, each a start bar (1-based) and text (GP4 and GP5). */
  readLyrics() {
    const track = this.r.readInt() - 1
    const lines: LyricLine[] = []
    for (let i = 0; i < MAX_LYRIC_VERSES; i += 1) {
      const startBar = this.r.readInt() - 1
      lines.push({ startBar, text: this.r.readStringInteger() })
    }
    this.song.lyrics = { track, lines }
  }

  /** GP5: page size and margins, then 11 header/footer lines. */
  readPageSetup() {
    this.r.skipBytes(this.minor > 0 ? 49 : 30)
    for (let i = 0; i < 11; i += 1) {
      this.r.skipBytes(4)
      this.r.readStringByte(0)
    }
  }

  readChannels() {
    const to127 = (value: number) => Math.max(value * 8 - 1, 0)
    this.song.channels.length = 0
    for (let i = 0; i < 64; i += 1) {
      const cInstrument = this.r.readInt()
      const volume = to127(this.r.readByte())
      const balance = to127(this.r.readByte())
      const chorus = to127(this.r.readByte())
      const reverb = to127(this.r.readByte())
      const phaser = to127(this.r.readByte())
      const tremolo = to127(this.r.readByte())
      this.r.skipBytes(2)
      this.song.channels[i] = { cInstrument, volume, balance, chorus, reverb, phaser, tremolo }
    }
    return this.song.channels
  }

  /** GP5: the bar (0-based, -1 = none) of each sign and jump, in `DIRECTION_TARGETS`/`DIRECTION_JUMPS` order. */
  readDirections(): { targets: number[]; jumps: number[] } {
    const targets = DIRECTION_TARGETS.map(() => this.r.readShort() - 1)
    const jumps = DIRECTION_JUMPS.map(() => this.r.readShort() - 1)
    return { targets, jumps }
  }

  applyDirections({ targets, jumps }: { targets: number[]; jumps: number[] }) {
    const bars = this.song.measureMeta
    targets.forEach((blockId, i) => {
      if (bars[blockId] != null) (bars[blockId].directionTargets ??= []).push(DIRECTION_TARGETS[i])
    })
    jumps.forEach((blockId, i) => {
      if (bars[blockId] != null) (bars[blockId].directionJumps ??= []).push(DIRECTION_JUMPS[i])
    })
  }

  readMeasureHeaders(numMeasures: number) {
    for (let i = 0; i < numMeasures; i += 1) {
      if (this.version === 5 && i > 0) this.r.skipBytes(1)
      this.readMeasureHeader(i)
    }
  }

  readMeasureHeader(index: number) {
    const v = this.version
    const meta = this.song.measureMeta[index]
    const flags = this.r.readUnsignedByte()
    // A bar only stores its time signature when it changes; otherwise it keeps the previous one.
    const previous = this.song.measureMeta[index - 1]
    if (previous != null) {
      meta.numerator = previous.numerator
      meta.denominator = previous.denominator
      meta.keySignature = previous.keySignature
      if (previous.keyMinor) meta.keyMinor = true
    }
    meta.repeatOpen = (flags & 0x04) !== 0
    if ((flags & 0x01) !== 0) {
      meta.numerator = this.r.readByte()
      meta.timeMeterPresent = true
    }
    if ((flags & 0x02) !== 0) {
      meta.denominator = this.r.readByte()
      meta.timeMeterPresent = true
    }
    this.readRepeatsAndMarker(flags, meta)
    if ((flags & 0x40) !== 0) this.readKeyChange(meta)
    if (v === 5) {
      if ((flags & 0x01) !== 0 || (flags & 0x02) !== 0) this.r.skipBytes(4) // beam groups
      if ((flags & 0x10) === 0) this.r.skipBytes(1)
      this.r.readByte() // triplet feel
    }
  }

  /** Repeat end, volta and marker of a bar header. */
  readRepeatsAndMarker(flags: number, meta: MeasureMetaInfo) {
    const v = this.version
    // GP5 stores the number of plays + 1
    if ((flags & 0x08) !== 0) meta.repeatClose = v === 5 ? this.r.readUnsignedByte() - 1 : this.r.readByte()
    // GP3/4 store the volta before the marker, GP5 after it
    if (v < 5 && (flags & 0x10) !== 0) meta.repeatAlternative = this.r.readUnsignedByte()
    if ((flags & 0x20) !== 0) meta.marker = this.readMarker()
    if (v === 5 && (flags & 0x10) !== 0) meta.repeatAlternative = this.r.readUnsignedByte()
  }

  /** Fifths, then 1 for minor. */
  readKeyChange(meta: MeasureMetaInfo) {
    meta.keySignature = Math.max(-7, Math.min(7, this.r.readByte()))
    if (this.r.readByte() === 1) meta.keyMinor = true
    else delete meta.keyMinor
  }

  readMarker() {
    const text = this.r.readStringByteSizeOfInteger()
    const color = this.readColor()
    return { text, color }
  }

  readColor() {
    const red = this.r.readUnsignedByte()
    const green = this.r.readUnsignedByte()
    const blue = this.r.readUnsignedByte()
    this.r.skipBytes(1)
    return { red, green, blue }
  }

  readTracks(numTracks: number) {
    this.song.tracks.length = 0
    for (let i = 0; i < numTracks; i += 1) {
      this.song.tracks[i] = this.readTrack(i + 1)
    }
    if (this.version === 5) this.r.skipBytes(this.minor === 0 ? 2 : 1)
  }

  readTrack(index: number): Track {
    const v = this.version
    this.r.readUnsignedByte() // flags
    if (v === 5 && (index === 1 || this.minor === 0)) this.r.skipBytes(1)
    const name = this.r.readStringByte(40)
    const strings = []
    const stringCount = this.r.readInt()
    for (let i = 0; i < 7; i += 1) {
      const tuning = this.r.readInt()
      if (stringCount > i) strings[stringCount - 1 - i] = tuning
    }
    this.r.readInt() // port
    const channel = this.readChannel()
    this.r.readInt() // frets
    const capo = this.r.readInt()
    const color = this.readColor()
    // The instrument is the channel's, not a program of the track.
    const track = { name, strings, numStrings: stringCount, letItRing: false, channel, capo, color }
    if (v < 5) return { ...Song.defaultTrack(), ...track, program: -1, primaryChannel: -1 }

    this.r.skipBytes(this.minor > 0 ? 49 : 44)
    // GP5.1 names the track's RSE tone, e.g. "Hard Rock - Default" / "Distortion Tones"
    const amp =
      this.minor > 0
        ? ampFromToneNames([this.r.readStringByteSizeOfInteger(), this.r.readStringByteSizeOfInteger()])
        : null
    return {
      ...(amp ? { amp } : {}),
      ...track,
      volume: 0,
      balance: 0,
      reverb: 0,
      program: -1,
      primaryChannel: -1,
    }
  }

  readChannel() {
    const index = this.r.readInt() - 1
    const effectChannel = this.r.readInt() - 1
    return { index, effectChannel }
  }

  readMeasures(numMeasures: number, numTracks: number) {
    this.song.measures.length = 0
    for (let j = 0; j < numTracks; j += 1) {
      this.song.measures[j] = []
    }
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < numTracks; j += 1) {
        this.readMeasure(j, i)
        if (this.version < 5) continue
        // Line-break byte after each bar; some writers leave it off after the last one.
        const last = i === numMeasures - 1 && j === numTracks - 1
        if (!last || this.r.bytesLeft() > 0) this.r.skipBytes(1)
      }
    }
  }

  /** GP3/4 bars have one voice; voice 2 gets eight empty beats, as the editor expects. */
  readMeasure(trackId: number, blockId: number) {
    const bar: Beat[][] = []
    this.song.measures[trackId][blockId] = bar
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      const voice: Beat[] = []
      bar[voiceId] = voice
      if (this.version < 5 && voiceId === 1) {
        for (let p = 0; p < 8; p += 1) voice[p] = Song.defaultMeasure()
        continue
      }
      const beats = this.r.readCount(IMPORT_LIMITS.beatsPerVoice, 'beats in a bar')
      for (let i = 0; i < beats; i += 1) {
        voice[i] = this.beats.readBeat(trackId, blockId)
      }
    }
  }
}
