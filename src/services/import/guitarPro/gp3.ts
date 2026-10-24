import Song, {
  type BeatEffects,
  type Bend,
  type Chord,
  type Grace,
  type Note,
  type Stroke,
  type TremoloBar,
} from '../../../stores/song'
import type { BeatDuration } from '../../../types/tab'
import { restOf } from '../../../utils/durationUtils'
import { IMPORT_LIMITS, ImportError } from '../../importErrors'
import type { ByteReader } from './byteReader'
import { Gp4Parser } from './gp4'
import { Gp5Parser, STROKE_LENGTHS } from './gp5'
import { addChord, type GuitarProSong } from './guitarProSong'

/** Reads a Guitar Pro 3 file; shares the parts that did not change with GP4 and GP5. */
export class Gp3Parser {
  private readonly gp4: Gp4Parser
  private readonly gp5: Gp5Parser

  constructor(
    private readonly r: ByteReader,
    private readonly song: GuitarProSong,
  ) {
    this.gp4 = new Gp4Parser(r, song)
    this.gp5 = new Gp5Parser(r, song)
  }

  read() {
    const version = this.gp5.readVersion()
    if (!version.startsWith('FICHIER GUITAR PRO v3')) {
      throw new ImportError(
        `Unsupported Guitar Pro version "${version}". Open a Guitar Pro 3 file here.`,
        'gp3',
      )
    }
    this.gp4.readInfo()

    this.r.readByte() // triplet feel
    const tempoValue = this.r.readInt()
    this.song.bpm = tempoValue

    // 0: C 1: G, -1: F
    this.r.readByte() // key signature
    this.r.skipBytes(3)

    this.gp5.readChannels()

    const numMeasures = this.r.readCount(IMPORT_LIMITS.measures, 'bars')
    const numTracks = this.r.readCount(IMPORT_LIMITS.tracks, 'tracks')

    if (numMeasures > 10000 || numTracks > 100 || numMeasures === 0) {
      throw new Error(`Invalid Guitar Pro 3 file (measures=${numMeasures}, tracks=${numTracks})`)
    }

    // Initialize per track
    for (let t = 0; t < numTracks; t += 1) {
      this.song.chords.push(new Map())
    }

    this.song.measureMeta.length = 0
    for (let i = 0; i < numMeasures; i += 1) {
      this.song.measureMeta[i] = Song.defaultMeasureMeta()
    }
    this.song.measureMeta[0].bpm = tempoValue

    this.gp4.readMeasureHeaders(numMeasures)
    this.gp4.readTracks(numTracks)

    // CORRECT up to here
    this.readMeasures(numMeasures, numTracks)
  }

  readMeasures(numMeasures: number, numTracks: number) {
    this.song.measures.length = 0
    for (let j = 0; j < numTracks; j += 1) {
      this.song.measures[j] = []
    }
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < numTracks; j += 1) {
        this.readMeasure(j, i)
      }
    }
  }

  readMeasure(trackId: number, blockId: number) {
    this.song.measures[trackId][blockId] = []
    // only one single voice
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      this.song.measures[trackId][blockId][voiceId] = []
      if (voiceId === 0) {
        const beats = this.r.readCount(IMPORT_LIMITS.beatsPerVoice, 'beats in a bar')
        if (beats > 100) {
          console.error(`Extremely high beat count (${beats}) in measure ${blockId}, aborting measure read.`)
          return
        }
        for (let i = 0; i < beats; i += 1) {
          this.readBeat(trackId, blockId, voiceId, i)
        }
      } else {
        for (let p = 0; p < 8; p += 1) {
          this.song.measures[trackId][blockId][voiceId][p] = Song.defaultMeasure()
        }
      }
    }
  }

  readBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const flags = this.r.readUnsignedByte()
    let empty = false
    if ((flags & 0x40) !== 0) {
      const beatType = this.r.readUnsignedByte()
      empty = (beatType & 0x02) === 0
    }

    const durationObj = this.gp5.readDuration(flags)
    let chord: Chord | undefined
    if ((flags & 0x02) !== 0) {
      chord = this.readChord()
      addChord(this.song, trackId, chord)
    }
    let text: string | undefined
    let effects: BeatEffects = Song.defaultMeasureEffects()
    if ((flags & 0x04) !== 0) {
      text = this.r.readStringByteSizeOfInteger()
    }
    if ((flags & 0x08) !== 0) {
      effects = this.readBeatEffects()
    }
    if ((flags & 0x10) !== 0) {
      this.readMixChange(blockId)
    }
    const stringFlags = this.r.readUnsignedByte()
    const notes = []
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[this.song.tracks[trackId].numStrings + string - 7] = this.readNote()
      }
    }
    let durString: BeatDuration = this.gp5.durationToString(durationObj.value) // s, e, q, w, h
    if (notes.length === 0) {
      durString = restOf(durString)
    }
    this.song.measures[trackId][blockId][voiceId][beatId] = {
      ...Song.defaultMeasure(),
      ...{
        empty,
        chord,
        text,
        duration: durString,
        dotted: durationObj.dotted,
        tuplet: durationObj.tuplet,
        notes,
        effects,
      },
    }
  }

  readChord(): Chord {
    const flag = this.r.readUnsignedByte()
    if ((flag & 0x01) === 0) {
      const name = this.r.readStringByteSizeOfInteger()
      const capo = this.r.readInt()
      const frets: number[] = []
      if (capo !== 0) {
        for (let i = 0; i < 6; i += 1) {
          frets[i] = this.r.readInt()
        }
      }
      return {
        name,
        capo,
        frets,
        chordType: '',
        chordRoot: '',
        fingers: [],
        display: true,
      }
    }
    this.r.skipBytes(25)
    const name: string = this.r.readStringByte(34)
    const capo: number = this.r.readInt()
    const frets: number[] = []
    for (let i = 0; i < 6; i += 1) {
      frets[i] = this.r.readInt()
    }
    this.r.skipBytes(36)
    return {
      name,
      capo,
      frets,
      chordType: '',
      chordRoot: '',
      fingers: [],
      display: true,
    }
  }

  readBeatEffects() {
    const flags = this.r.readUnsignedByte()
    const fadeIn = (flags & 0x10) !== 0 || (flags & 0x02) !== 0
    const vibrato = (flags & 0x02) !== 0
    let tremoloBar: TremoloBar | undefined
    let tap = false
    let slap = false
    let pop = false
    if ((flags & 0x20) !== 0) {
      const type = this.r.readUnsignedByte()
      if (type === 0) {
        // REALLY?
        tremoloBar = this.gp5.readTremoloBar()
      } else {
        tap = type === 1
        slap = type === 2
        pop = type === 3
        this.r.readInt()
      }
    }
    let stroke: Stroke | undefined
    if ((flags & 0x40) !== 0) {
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
    let harmonics = ''
    if ((flags & 0x04) !== 0) {
      harmonics = 'natural'
    }
    let artificialPresent = false
    let artificialStyle = ''
    if ((flags & 0x08) !== 0) {
      artificialPresent = true
      artificialStyle = 'N.H.'
    }
    return {
      fadeIn,
      vibrato,
      tremoloBar,
      tap,
      slap,
      pop,
      stroke,
      harmonics,
      artificialPresent,
      artificialStyle,
    }
  }

  readNote(): Note {
    const flags = this.r.readUnsignedByte()
    const ghost = (flags & 0x04) !== 0
    let tied = false
    let dead = false
    let velocity = 0
    let fret = 0
    if ((flags & 0x20) !== 0) {
      const noteType = this.r.readUnsignedByte()
      tied = noteType === 0x02
      dead = noteType === 0x03
    }
    if ((flags & 0x01) !== 0) {
      this.r.skipBytes(2)
    }
    if ((flags & 0x10) !== 0) {
      velocity = this.r.readByte()
    }
    if ((flags & 0x20) !== 0) {
      fret = this.r.readByte()
    }
    if ((flags & 0x80) !== 0) {
      this.r.skipBytes(2)
    }

    let effects: {
      pullDown: boolean
      slide: boolean
      letRing: boolean
      bendObj?: Bend
      graceObj?: Grace
    } = {
      pullDown: false,
      slide: false,
      letRing: false,
    }
    if ((flags & 0x08) !== 0) {
      effects = this.readNoteEffects()
    }
    const note = {
      ghost,
      tied,
      dead,
      velocity,
      fret,
      ...effects,
    }
    return { ...Song.defaultNote(), ...note }
  }

  readNoteEffects() {
    const flags = this.r.readUnsignedByte()
    const pullDown = (flags & 0x02) !== 0
    const slide = (flags & 0x04) !== 0
    const letRing = (flags & 0x08) !== 0

    let bendObj: Bend | undefined
    if ((flags & 0x01) !== 0) {
      bendObj = this.gp5.readBend()
    }
    let graceObj: Grace | undefined
    if ((flags & 0x10) !== 0) {
      graceObj = this.gp4.readGrace()
    }
    return {
      pullDown,
      slide,
      letRing,
      ...(bendObj ? { bendObj } : {}),
      ...(graceObj ? { graceObj } : {}),
    }
  }

  readMixChange(blockId: number) {
    this.r.readByte() // instrument
    const volume = this.r.readByte()
    const pan = this.r.readByte()
    const chorus = this.r.readByte()
    const reverb = this.r.readByte()
    const phaser = this.r.readByte()
    const tremolo = this.r.readByte()
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
      this.r.readByte()
    }
  }
}
