import Song, { type Chord, type Grace, type Note, type Track } from '../../../stores/song'
import type { BeatDuration } from '../../../types/tab'
import { restOf } from '../../../utils/durationUtils'
import { IMPORT_LIMITS, ImportError } from '../../importErrors'
import type { ByteReader } from './byteReader'
import { Gp5Parser } from './gp5'
import { addChord, type GuitarProSong } from './guitarProSong'

/** Reads a Guitar Pro 4 file; shares the parts that did not change with GP5. */
export class Gp4Parser {
  private readonly gp5: Gp5Parser

  constructor(
    private readonly r: ByteReader,
    private readonly song: GuitarProSong,
  ) {
    this.gp5 = new Gp5Parser(r, song)
  }

  read() {
    const version = this.gp5.readVersion()
    if (!version.startsWith('FICHIER GUITAR PRO v4')) {
      throw new ImportError(
        `Unsupported Guitar Pro version "${version}". Open a Guitar Pro 4 file here.`,
        'gp4',
      )
    }
    this.readInfo()

    this.r.readByte() // triplet feel
    this.r.readInt() // lyric track
    this.gp5.readLyrics()

    const tempoValue = this.r.readInt()
    this.song.bpm = tempoValue

    this.r.readInt() // key
    this.r.readByte() // octave

    this.gp5.readChannels()

    const numMeasures = this.r.readCount(IMPORT_LIMITS.measures, 'bars')
    const numTracks = this.r.readCount(IMPORT_LIMITS.tracks, 'tracks')
    for (let t = 0; t < numTracks; t += 1) {
      this.song.chords.push(new Map())
    }
    this.song.measureMeta.length = 0
    for (let i = 0; i < numMeasures; i += 1) {
      this.song.measureMeta[i] = Song.defaultMeasureMeta()
    }
    this.song.measureMeta[0].bpm = tempoValue

    this.readMeasureHeaders(numMeasures)
    this.readTracks(numTracks)

    this.readMeasures(numMeasures, numTracks)
    return true
  }

  readInfo() {
    this.song.description.title = this.r.readStringByteSizeOfInteger()
    this.song.description.subtitle = this.r.readStringByteSizeOfInteger()
    this.song.description.artist = this.r.readStringByteSizeOfInteger()
    this.song.description.album = this.r.readStringByteSizeOfInteger()
    this.song.description.author = this.r.readStringByteSizeOfInteger()
    this.song.description.copyright = this.r.readStringByteSizeOfInteger()
    this.song.description.writer = this.r.readStringByteSizeOfInteger()
    this.song.description.instructions = this.r.readStringByteSizeOfInteger()
    this.song.description.comments = []
    const comments = this.r.readCount(IMPORT_LIMITS.comments, 'comment lines')
    for (let i = 0; i < comments; i += 1) {
      this.song.description.comments[i] = this.r.readStringByteSizeOfInteger()
    }
  }

  readMeasureHeaders(numMeasures: number) {
    for (let i = 0; i < numMeasures; i += 1) {
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
      this.song.measureMeta[index].repeatClose = this.r.readByte()
    }
    if ((flags & 0x10) !== 0) {
      this.song.measureMeta[index].repeatAlternative = this.r.readUnsignedByte()
    }
    if ((flags & 0x20) !== 0) {
      this.song.measureMeta[index].marker = this.gp5.readMarker()
    }
    if ((flags & 0x40) !== 0) {
      this.song.measureMeta[index].keySignature = this.r.readByte()
      this.r.readByte()
    }
  }

  readTracks(numTracks: number) {
    this.song.tracks.length = 0
    for (let i = 1; i <= numTracks; i += 1) {
      this.song.tracks[i - 1] = this.readTrack()
    }
  }

  readTrack(): Track {
    this.r.readUnsignedByte() // track flags
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
    const channel = this.gp5.readChannel()
    this.r.readInt()

    const capo = this.r.readInt()
    const color = this.gp5.readColor()
    const trackGp4 = {
      name,
      strings,
      numStrings,
      letItRing,
      channel,
      capo,
      color,
    }
    return { ...Song.defaultTrack(), ...trackGp4 }
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
    if ((flags & 0x04) !== 0) {
      text = this.r.readStringByteSizeOfInteger()
    }
    let effects = Song.defaultMeasureEffects()
    if ((flags & 0x08) !== 0) {
      effects = this.gp5.readBeatEffects()
    }
    if ((flags & 0x10) !== 0) {
      this.readMixChange(blockId)
    }
    const stringFlags = this.r.readUnsignedByte()
    const notes: Note[] = []
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[this.song.tracks[trackId].numStrings + string - 7] = this.readNote()
      }
    }
    let durString: BeatDuration = this.gp5.durationToString(durationObj.value) // s, e, q, w, h
    if (notes.length === 0) {
      durString = restOf(durString)
    }
    const { dotted } = durationObj
    const { tuplet } = durationObj
    const beatMeta = {
      empty,
      duration: durString,
      dotted,
      tuplet,
      notes,
      text,
      chord,
      effects,
    }
    this.song.measures[trackId][blockId][voiceId][beatId] = {
      ...Song.defaultMeasure(),
      ...beatMeta,
    }
  }

  readChord(): Chord {
    const flag = this.r.readUnsignedByte()
    let name: string
    let capo: number
    const frets = []
    if ((flag & 0x01) === 0) {
      name = this.r.readStringByteSizeOfInteger()
      capo = this.r.readInt()
      if (capo !== 0) {
        for (let i = 0; i < 6; i += 1) {
          frets[i] = this.r.readInt()
        }
      }
    } else {
      this.r.skipBytes(16)
      name = this.r.readStringByte(21)
      this.r.skipBytes(4)
      capo = this.r.readInt()
      for (let i = 0; i < 7; i += 1) {
        frets[i] = this.r.readInt()
      }
      this.r.skipBytes(32)
    }
    const chord = {
      name,
      capo,
      frets,
      fingers: [],
      chordType: '',
      chordRoot: '',
      display: true,
    }
    return chord
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
    this.r.readByte()
  }

  readNote() {
    const flags = this.r.readUnsignedByte()
    const ghost = (flags & 0x04) !== 0
    let tied = false
    let dead = false
    let fret = 0
    if ((flags & 0x20) !== 0) {
      const noteType = this.r.readUnsignedByte()
      if (noteType === 0x02) {
        tied = true
      }
      if (noteType === 0x03) {
        dead = true
      }
    }
    if ((flags & 0x01) !== 0) {
      this.r.skipBytes(2)
    }
    if ((flags & 0x10) !== 0) {
      this.r.readByte() // velocity
    }
    if ((flags & 0x20) !== 0) {
      fret = this.r.readByte()
    }
    if ((flags & 0x80) !== 0) {
      this.r.skipBytes(2)
    }
    const note = {
      ...Song.defaultNote(),
      ...{
        ghost,
        dead,
        fret,
        tied,
      },
    }
    if ((flags & 0x08) !== 0) {
      this.readNoteEffects(note)
    }
    return note
  }

  readNoteEffects(noteIn: Note) {
    const note = noteIn
    const flags1 = this.r.readUnsignedByte()
    const flags2 = this.r.readUnsignedByte()
    if ((flags1 & 0x01) !== 0) {
      note.bendObj = this.gp5.readBend()
    }
    if ((flags1 & 0x10) !== 0) {
      note.graceObj = this.readGrace()
    }
    if ((flags2 & 0x04) !== 0) {
      note.tremoloPicking = true
      note.tremoloPickingLength = this.gp5.readTremoloPicking()
    }
    if ((flags2 & 0x08) !== 0) {
      note.slide = true
      this.r.readByte()
    }
    if ((flags2 & 0x10) !== 0) {
      note.artificialStyle = this.gp5.readArtificialHarmonic()
    }
    if ((flags2 & 0x20) !== 0) {
      note.trill = this.gp5.readTrill()
    }
    note.letRing = (flags1 & 0x08) !== 0
    note.pullDown = (flags1 & 0x02) !== 0
    note.vibrato = (flags2 & 0x40) !== 0
    note.palmMute = (flags2 & 0x02) !== 0
    note.stacatto = (flags2 & 0x01) !== 0
  }

  readGrace(): Grace {
    const setOnBeat = 'before'
    const fret = this.r.readUnsignedByte()
    const dead = fret === 255
    const dynamic = this.r.readUnsignedByte()
    this.r.readUnsignedByte() // const transition =
    const durationByte = this.r.readUnsignedByte()
    const duration = this.gp5.graceDurationFromByte(durationByte)
    const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
    return {
      setOnBeat,
      fret,
      dead,
      dynamic: byteToDynamic[dynamic],
      transition: 'none',
      duration,
      string: 0,
      height: 0,
    }
  }
}
