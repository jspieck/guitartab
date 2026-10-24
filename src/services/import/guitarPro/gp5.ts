import Song, {
  type Bend,
  type BeatEffects,
  type Chord,
  type Grace,
  type Note,
  type Stroke,
  type Track,
  type TremoloBar,
} from '../../../stores/song'
import type { BeatDuration, NoteLengthCode } from '../../../types/tab'
import { restOf } from '../../../utils/durationUtils'
import { IMPORT_LIMITS, ImportError } from '../../importErrors'
import type { ByteReader } from './byteReader'
import { addChord, type GuitarProSong } from './guitarProSong'

const GP5_VERSIONS = ['FICHIER GUITAR PRO v5.00', 'FICHIER GUITAR PRO v5.10']
/** Stroke length by its byte: 1 = 128th … 6 = quarter. */
export const STROKE_LENGTHS = [0, 128, 64, 32, 16, 8, 4]

/** Reads a Guitar Pro 5 file (v5.00 / v5.10) into a GuitarProSong. */
export class Gp5Parser {
  constructor(
    private readonly r: ByteReader,
    private readonly song: GuitarProSong,
  ) {}

  read() {
    const version = this.readVersion()

    const versionIndex = this.isSupportedVersion(version)
    if (versionIndex < 0) {
      throw new ImportError(
        `Unsupported Guitar Pro version "${version}". Open a Guitar Pro 5 file here.`,
        'gp5',
      )
    }
    this.readInfo()
    // lyric track
    this.r.readInt()
    this.readLyrics()

    this.readPageSetup(versionIndex)

    const tempoValue = this.r.readInt()
    this.song.bpm = tempoValue

    // skip one byte
    if (versionIndex > 0) this.r.skipBytes(1)

    this.r.readInt() // key
    this.r.readByte() // octave

    this.readChannels()

    this.r.skipBytes(42)

    const numMeasures = this.r.readCount(IMPORT_LIMITS.measures, 'bars')
    const numTracks = this.r.readCount(IMPORT_LIMITS.tracks, 'tracks')
    for (let t = 0; t < numTracks; t += 1) {
      this.song.chords.push(new Map())
    }
    // create data structure
    this.song.measureMeta.length = 0
    for (let i = 0; i < numMeasures; i += 1) {
      this.song.measureMeta[i] = Song.defaultMeasureMeta()
    }
    this.song.measureMeta[0].bpm = tempoValue

    this.readMeasureHeaders(numMeasures)
    this.readTracks(numTracks, versionIndex)

    // CORRECT BIS HIER ?
    this.readMeasures(numMeasures, numTracks, versionIndex)
  }

  isSupportedVersion(version: string) {
    if (version === GP5_VERSIONS[0]) {
      return 0
    }
    if (version === GP5_VERSIONS[1]) {
      return 1
    }
    return -1
  }

  readVersion() {
    return this.r.readStringByte(30)
  }

  readInfo() {
    this.song.description.title = this.r.readStringByteSizeOfInteger()
    this.song.description.subtitle = this.r.readStringByteSizeOfInteger()
    this.song.description.artist = this.r.readStringByteSizeOfInteger()
    this.song.description.album = this.r.readStringByteSizeOfInteger()
    this.song.description.author = this.r.readStringByteSizeOfInteger()
    this.song.description.music = this.r.readStringByteSizeOfInteger()
    this.song.description.copyright = this.r.readStringByteSizeOfInteger()
    this.song.description.writer = this.r.readStringByteSizeOfInteger()
    this.song.description.instructions = this.r.readStringByteSizeOfInteger()
    this.song.description.comments = []
    const comments = this.r.readCount(IMPORT_LIMITS.comments, 'comment lines')
    for (let i = 0; i < comments; i += 1) {
      this.song.description.comments[i] = this.r.readStringByteSizeOfInteger()
    }
  }

  readLyrics() {
    const from = this.r.readInt()
    const lyr = this.r.readStringInteger()
    for (let i = 0; i < 4; i += 1) {
      this.r.readInt()
      this.r.readStringInteger()
    }
    return { from, lyric: lyr }
  }

  readPageSetup(versionIndex: number) {
    if (versionIndex > 0) {
      this.r.skipBytes(49)
    } else {
      this.r.skipBytes(30)
    }

    for (let i = 0; i < 11; i += 1) {
      this.r.skipBytes(4)
      this.r.readStringByte(0)
    }
  }

  convertTo127(value: number) {
    return Math.max(value * 8 - 1, 0)
  }

  readChannels() {
    this.song.channels.length = 0
    for (let i = 0; i < 64; i += 1) {
      const cInstrument = this.r.readInt()
      const volume = this.convertTo127(this.r.readByte())
      const balance = this.convertTo127(this.r.readByte())
      const chorus = this.convertTo127(this.r.readByte())
      const reverb = this.convertTo127(this.r.readByte())
      const phaser = this.convertTo127(this.r.readByte())
      const tremolo = this.convertTo127(this.r.readByte())
      this.r.skipBytes(2)
      const channelSetting = {
        cInstrument,
        volume,
        balance,
        chorus,
        reverb,
        phaser,
        tremolo,
      }
      this.song.channels[i] = channelSetting
    }
    return this.song.channels
  }

  readMeasureHeaders(numMeasures: number) {
    for (let i = 0; i < numMeasures; i += 1) {
      if (i > 0) {
        this.r.skipBytes(1)
      }
      this.readMeasureHeader(i)
    }
  }

  readMeasureHeader(index: number) {
    const flags = this.r.readUnsignedByte()
    // A bar only stores its time signature when it changes; otherwise it keeps the previous one.
    const previous = this.song.measureMeta[index - 1]
    if (previous != null) {
      this.song.measureMeta[index].numerator = previous.numerator
      this.song.measureMeta[index].denominator = previous.denominator
    }

    this.song.measureMeta[index].repeatOpen = (flags & 0x04) !== 0
    if ((flags & 0x01) !== 0) {
      const numerator = this.r.readByte()
      this.song.measureMeta[index].numerator = numerator
      this.song.measureMeta[index].timeMeterPresent = true
    }
    if ((flags & 0x02) !== 0) {
      const denominator = this.r.readByte()
      this.song.measureMeta[index].denominator = denominator
      this.song.measureMeta[index].timeMeterPresent = true
    }
    if ((flags & 0x08) !== 0) {
      this.song.measureMeta[index].repeatClose = (this.r.readByte() & 0xff) - 1
    }
    if ((flags & 0x20) !== 0) {
      this.song.measureMeta[index].marker = this.readMarker()
    }
    if ((flags & 0x10) !== 0) {
      this.song.measureMeta[index].repeatAlternative = this.r.readUnsignedByte()
    }
    if ((flags & 0x40) !== 0) {
      this.r.readByte()
      this.r.readByte()
    }
    if ((flags & 0x01) !== 0 || (flags & 0x02) !== 0) {
      this.r.skipBytes(4)
    }
    if ((flags & 0x10) === 0) {
      this.r.skipBytes(1)
    }
    // ignore triplet feel
    this.r.readByte()
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

  readTracks(numTracks: number, versionIndex: number) {
    this.song.tracks.length = 0
    for (let i = 0; i < numTracks; i += 1) {
      this.song.tracks[i] = this.readTrack(i + 1, versionIndex)
    }
    this.r.skipBytes(versionIndex === 0 ? 2 : 1)
  }

  readTrack(index: number, versionIndex: number): Track {
    this.r.readUnsignedByte()
    if (index === 1 || versionIndex === 0) {
      this.r.skipBytes(1)
    }
    const name = this.r.readStringByte(40)

    const strings = []
    const stringCount = this.r.readInt()
    for (let i = 0; i < 7; i += 1) {
      const tuning = this.r.readInt()
      if (stringCount > i) {
        strings[stringCount - 1 - i] = tuning
      }
    }
    const numStrings = stringCount
    const letItRing = false
    this.r.readInt()
    const channel = this.readChannel()
    this.r.readInt()

    const capo = this.r.readInt()
    const color = this.readColor()
    this.r.skipBytes(versionIndex > 0 ? 49 : 44)
    if (versionIndex > 0) {
      this.r.readStringByteSizeOfInteger()
      this.r.readStringByteSizeOfInteger()
    }
    return {
      name,
      strings,
      numStrings,
      letItRing,
      channel,
      capo,
      color,
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
    return {
      index,
      effectChannel,
    }
  }

  readMeasures(numMeasures: number, tracks: number, versionIndex: number) {
    this.song.measures.length = 0
    for (let j = 0; j < tracks; j += 1) {
      this.song.measures[j] = []
    }
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < tracks; j += 1) {
        this.readMeasure(j, i, versionIndex)
        // Line-break byte after each bar; some writers leave it off after the last one.
        const last = i === numMeasures - 1 && j === tracks - 1
        if (!last || this.r.bytesLeft() > 0) this.r.skipBytes(1)
      }
    }
  }

  readMeasure(trackId: number, blockId: number, versionIndex: number) {
    this.song.measures[trackId][blockId] = []
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      this.song.measures[trackId][blockId][voiceId] = []
      const beats = this.r.readCount(IMPORT_LIMITS.beatsPerVoice, 'beats in a bar')
      for (let i = 0; i < beats; i += 1) {
        this.readBeat(trackId, blockId, voiceId, i, versionIndex)
      }
    }
  }

  readDuration(flags: number) {
    const value = this.r.readByte()
    const dotted = (flags & 0x01) !== 0
    let tuplet = 0
    if ((flags & 0x20) !== 0) {
      tuplet = this.r.readInt()
    }
    return {
      value,
      dotted,
      tuplet,
    }
  }

  readBeat(trackId: number, blockId: number, voiceId: number, beatId: number, versionIndex: number) {
    let empty = false
    let chord: Chord | undefined
    let text: string | undefined
    let effects = Song.defaultMeasureEffects()
    const notes: Note[] = []
    let duration: BeatDuration
    let tuplet = 0
    const flags = this.r.readUnsignedByte()
    if ((flags & 0x40) !== 0) {
      const beatType = this.r.readUnsignedByte()
      empty = (beatType & 0x02) === 0
    }
    const durationValue = this.r.readByte()
    duration = this.durationToString(durationValue) // s, e, q, w,
    const dotted = (flags & 0x01) !== 0
    if ((flags & 0x20) !== 0) {
      tuplet = this.r.readInt()
    }
    if ((flags & 0x02) !== 0) {
      chord = this.readChord()
      addChord(this.song, trackId, chord)
    }
    if ((flags & 0x04) !== 0) {
      text = this.r.readStringByteSizeOfInteger()
    }
    if ((flags & 0x08) !== 0) {
      effects = this.readBeatEffects()
    }
    if ((flags & 0x10) !== 0) {
      this.readMixChange(blockId, versionIndex)
    }
    const stringFlags = this.r.readUnsignedByte()
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[this.song.tracks[trackId].numStrings + string - 7] = this.readNote()
      }
    }
    if (notes.length === 0) {
      duration = restOf(duration)
    }
    const measure = {
      empty,
      chord,
      text,
      effects,
      notes,
      duration,
      dotted,
      tuplet,
    }
    this.song.measures[trackId][blockId][voiceId][beatId] = { ...Song.defaultMeasure(), ...measure }

    this.r.skipBytes(1)
    const read = this.r.readByte()
    if ((read & 0x08) !== 0) {
      this.r.skipBytes(1)
    }
  }

  // -2:whole, -1:half, 0:quarter, 1:eighth, 2:sixteenth, ...
  durationToString(duration: number): NoteLengthCode {
    // only up to 256 = 2, o = 128, z=64
    // '2' (256th) has no NoteLengthCode; the app can't play it either.
    const durationArray = ['w', 'h', 'q', 'e', 's', 't', 'z', 'o', '2'] as NoteLengthCode[]
    if (duration + 2 > durationArray.length) {
      return '' as NoteLengthCode
    }
    return durationArray[duration + 2]
  }

  readChord(): Chord {
    this.r.skipBytes(17)
    const name = this.r.readStringByte(21)
    this.r.skipBytes(4)
    const capo = this.r.readInt()
    const frets = []
    for (let i = 0; i < 7; i += 1) {
      frets[i] = this.r.readInt()
    }
    this.r.skipBytes(32)
    return {
      name,
      capo,
      frets,
      chordType: '',
      chordRoot: '',
      display: true,
      fingers: [],
    }
  }

  readBeatEffects(): BeatEffects {
    const flags1 = this.r.readUnsignedByte()
    const flags2 = this.r.readUnsignedByte()
    const fadeIn = (flags1 & 0x10) !== 0
    const vibrato = (flags1 & 0x02) !== 0
    let tap = false
    let slap = false
    let pop = false
    if ((flags1 & 0x20) !== 0) {
      const tapEffect = this.r.readUnsignedByte()
      tap = tapEffect === 1
      slap = tapEffect === 2
      pop = tapEffect === 3
    }
    let tremoloBar: TremoloBar | undefined
    if ((flags2 & 0x04) !== 0) {
      tremoloBar = this.readTremoloBar()
    }
    let stroke: Stroke | undefined
    if ((flags1 & 0x40) !== 0) {
      // 0: none, 1: 128th, 2: 64th, 3: 32th, 4: 16th, 5: 8th, 6 4th
      const strokeUp = this.r.readByte()
      const strokeDown = this.r.readByte()
      if (strokeUp > 0) {
        stroke = {
          strokeType: 'up',
          strokeLength: STROKE_LENGTHS[strokeUp],
        }
      } else if (strokeDown > 0) {
        stroke = {
          strokeType: 'down',
          strokeLength: STROKE_LENGTHS[strokeDown],
        }
      }
    }
    if ((flags2 & 0x02) !== 0) {
      this.r.readByte()
    }
    return {
      fadeIn,
      vibrato,
      tap,
      slap,
      pop,
      tremoloBar,
      stroke,
    }
  }

  readTremoloBar() {
    const tremoloBar = []
    this.r.skipBytes(5)
    const numPoints = this.r.readCount(IMPORT_LIMITS.points, 'curve points')
    for (let i = 0; i < numPoints; i += 1) {
      const position = this.r.readInt()
      const value = this.r.readInt()
      tremoloBar[i] = {
        position,
        value,
        vibrato: 0,
      }
      this.r.readByte() // vibrato
    }
    return tremoloBar
  }

  readMixChange(blockId: number, versionIndex: number) {
    this.r.readByte() // instrument
    this.r.skipBytes(16)
    const volume = this.r.readByte()
    const pan = this.r.readByte()
    const chorus = this.r.readByte()
    const reverb = this.r.readByte()
    const phaser = this.r.readByte()
    const tremolo = this.r.readByte()
    this.r.readStringByteSizeOfInteger() // tempoName
    const tempoValue = this.r.readInt()
    if (volume >= 0) {
      this.r.readByte()
    }
    if (pan >= 0) {
      this.r.readByte()
    }
    if (chorus >= 0) {
      this.r.readByte()
    }
    if (reverb >= 0) {
      this.r.readByte()
    }
    if (phaser >= 0) {
      this.r.readByte()
    }
    if (tremolo >= 0) {
      this.r.readByte()
    }
    if (tempoValue >= 0) {
      this.song.measureMeta[blockId].bpm = tempoValue
      this.r.skipBytes(1)
      if (versionIndex > 0) {
        this.r.skipBytes(1)
      }
    }
    this.r.readByte()
    this.r.skipBytes(1)
    if (versionIndex > 0) {
      this.r.readStringByteSizeOfInteger()
      this.r.readStringByteSizeOfInteger()
    }
  }

  readNote(): Note {
    const flags = this.r.readUnsignedByte()
    const accentuated = (flags & 0x40) !== 0
    const heavyAccentuated = (flags & 0x02) !== 0
    const ghost = (flags & 0x04) !== 0
    let tied = false
    let dead = false
    let dynamic = ''
    let fret = 0
    if ((flags & 0x20) !== 0) {
      const noteType = this.r.readUnsignedByte()
      if (noteType === 0x02) tied = true
      if (noteType === 0x03) dead = true
    }
    if ((flags & 0x10) !== 0) {
      const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
      dynamic = byteToDynamic[this.r.readByte()]
    }
    if ((flags & 0x20) !== 0) {
      fret = this.r.readByte()
    }
    if ((flags & 0x80) !== 0) {
      this.r.skipBytes(2)
    }
    if ((flags & 0x01) !== 0) {
      this.r.skipBytes(8)
    }
    this.r.skipBytes(1)
    let noteEffects = {}
    if ((flags & 0x08) !== 0) {
      noteEffects = this.readNoteEffects()
    }
    const gp5Note = {
      fret,
      accentuated,
      heavyAccentuated,
      ghost,
      tied,
      dead,
      dynamic,
      ...noteEffects,
    }
    return { ...Song.defaultNote(), ...gp5Note }
  }

  readNoteEffects() {
    const flags1 = this.r.readUnsignedByte()
    const flags2 = this.r.readUnsignedByte()
    let bendObj: Bend | undefined
    let graceObj: Grace | undefined
    let tremoloPicking = false
    let tremoloPickingLength = ''
    let slide = false
    let artificialStyle: string | undefined
    let trill: { fret: number; period: number } | undefined

    if ((flags1 & 0x01) !== 0) {
      bendObj = this.readBend()
    }
    if ((flags1 & 0x10) !== 0) {
      graceObj = this.readGrace()
    }
    if ((flags2 & 0x04) !== 0) {
      tremoloPicking = true
      tremoloPickingLength = this.readTremoloPicking()
    }
    if ((flags2 & 0x08) !== 0) {
      slide = true
      this.r.readByte()
    }
    if ((flags2 & 0x10) !== 0) {
      artificialStyle = this.readArtificialHarmonic()
    }
    if ((flags2 & 0x20) !== 0) {
      // (This was stored as `trillObj`, a field Note doesn't have, so trills lost their data.)
      trill = this.readTrill()
    }
    const letRing = (flags1 & 0x08) !== 0
    const pullDown = (flags1 & 0x02) !== 0
    const vibrato = (flags2 & 0x40) !== 0
    const palmMute = (flags2 & 0x02) !== 0
    const stacatto = (flags2 & 0x01) !== 0
    return {
      ...(trill ? { trill } : {}),
      ...(graceObj ? { graceObj } : {}),
      ...(bendObj ? { bendObj } : {}),
      tremoloPicking,
      tremoloPickingLength,
      slide,
      ...(artificialStyle != null ? { artificialStyle } : {}),
      letRing,
      pullDown,
      vibrato,
      palmMute,
      stacatto,
    }
  }

  readBend(): Bend {
    const bend = []
    this.r.skipBytes(5)
    const numPoints = this.r.readCount(IMPORT_LIMITS.points, 'curve points')
    for (let i = 0; i < numPoints; i += 1) {
      const bendPosition = this.r.readInt()
      const bendValue = this.r.readInt()
      const vibrato = this.r.readByte() // vibrato
      bend[i] = {
        bendPosition,
        bendValue,
        vibrato,
      }
    }
    return bend
  }

  /**
   * Grace-note length as stored by Guitar Pro 3-5: 1 = 64th, 2 = 32nd, 3 = 16th.
   * (GP5 read this one step too short and GP4 one step too long.)
   */
  graceDurationFromByte(durationByte: number): string {
    if (durationByte === 1) return 'z'
    if (durationByte === 2) return 't'
    return 's'
  }

  readGrace(): Grace {
    const fret = this.r.readUnsignedByte()
    const dynamic = this.r.readUnsignedByte()
    this.r.readByte() // const transition =
    const durationByte = this.r.readUnsignedByte()
    const duration = this.graceDurationFromByte(durationByte)
    const flags = this.r.readUnsignedByte()
    const dead = (flags & 0x01) !== 0
    const setOnBeat = (flags & 0x02) !== 0 ? 'before' : 'width'
    const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
    return {
      fret,
      dynamic: byteToDynamic[dynamic],
      transition: 'none',
      duration,
      dead,
      setOnBeat,
      string: 0,
      height: 0,
    }
  }

  readTremoloPicking() {
    const value = this.r.readUnsignedByte()
    if (value === 1) return 'e'
    if (value === 2) return 's'
    if (value === 3) return 't'
    return ''
  }

  readArtificialHarmonic() {
    const type = this.r.readByte()
    if (type === 1) {
      return 'N.H.' // natural
    }
    if (type === 2) {
      this.r.skipBytes(3)
      return 'A.H.' // artificial
    }
    if (type === 3) {
      this.r.skipBytes(1)
      return 'T.H.' // tapped
    }
    if (type === 4) {
      return 'P.H.' // pinch
    }
    if (type === 5) {
      return 'S.H.' // semi
    }
    return ''
  }

  readTrill() {
    const fret = this.r.readByte()
    const period = this.r.readByte() // TODO: period: 1:s, 2:t, 3:64th
    return {
      fret,
      period,
    }
  }
}
