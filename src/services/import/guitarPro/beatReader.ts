import Song, {
  type BeatEffects,
  type Bend,
  type Chord,
  type Grace,
  type Beat,
  type Note,
  type Stroke,
  type TremoloBar,
} from '../../../stores/song'
import type { BeatDuration, NoteLengthCode } from '../../../types/tab'
import { restOf } from '../../../utils/durationUtils'
import { IMPORT_LIMITS } from '../../importErrors'
import type { ByteReader } from './byteReader'
import { addChord, type GuitarProSong } from './guitarProSong'

/** Major file version: what changes the binary layout of beats and notes. */
export type GuitarProVersion = 3 | 4 | 5

/** Stroke length by its byte: 1 = 128th … 6 = quarter. */
export const STROKE_LENGTHS = [0, 128, 64, 32, 16, 8, 4]

const GP4_HARMONICS: Record<number, string> = {
  1: 'N.H.',
  3: 'T.H.',
  4: 'P.H.',
  5: 'S.H.',
  15: 'A.H.',
  17: 'A.H.',
  22: 'A.H.',
}
const DYNAMIC_BY_BYTE = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
// -2: whole, -1: half, 0: quarter, 1: eighth, … ; '2' (256th) has no NoteLengthCode, the app can't play it either.
const DURATION_BY_BYTE = ['w', 'h', 'q', 'e', 's', 't', 'z', 'o', '2'] as NoteLengthCode[]

/**
 * Reads the beats of a bar in Guitar Pro 3, 4 and 5 files. The layouts are
 * the same record with more fields per version; each version check below is
 * one of those deltas.
 */
/** GP3 keeps harmonics on the beat; the song (like GP4/5) on each note. */
function setHarmonic(notes: (Note | null | undefined)[], harmonic: string): void {
  if (harmonic === '') return
  for (const note of notes) if (note != null) note.artificialStyle = harmonic
}

export class GuitarProBeatReader {
  constructor(
    private readonly r: ByteReader,
    private readonly song: GuitarProSong,
    private readonly version: GuitarProVersion,
    /** 1 for GP 5.10, which adds a few fields; 0 otherwise. */
    private readonly minor: number,
  ) {}

  readBeat(trackId: number, blockId: number): Beat {
    const v = this.version
    const flags = this.r.readUnsignedByte()
    let empty = false
    if ((flags & 0x40) !== 0) {
      const beatType = this.r.readUnsignedByte()
      empty = (beatType & 0x02) === 0
    }
    let duration: BeatDuration = durationToString(this.r.readByte())
    const dotted = (flags & 0x01) !== 0
    const tuplet = (flags & 0x20) !== 0 ? this.r.readInt() : 0
    let chord: Chord | undefined
    if ((flags & 0x02) !== 0) {
      chord = this.readChord()
      addChord(this.song, trackId, chord)
    }
    const text = (flags & 0x04) !== 0 ? this.r.readStringByteSizeOfInteger() : undefined
    let effects: BeatEffects = Song.defaultMeasureEffects()
    // GP3 keeps harmonics on the beat; the song (like GP4/5) on each note.
    let harmonic = ''
    if ((flags & 0x08) !== 0) {
      if (v === 3) ({ effects, harmonic } = this.readGp3BeatEffects())
      else effects = this.readBeatEffects()
    }
    if ((flags & 0x10) !== 0) this.readMixChange(blockId)
    const stringFlags = this.r.readUnsignedByte()
    const notes: Note[] = []
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[this.song.tracks[trackId].numStrings + string - 7] = this.readNote()
      }
    }
    setHarmonic(notes, harmonic)
    if (notes.length === 0) duration = restOf(duration)
    if (v === 5) {
      this.r.skipBytes(1)
      // GP5 beat flags 2: 0x08 = a break-secondary-beams value follows
      if ((this.r.readByte() & 0x08) !== 0) this.r.skipBytes(1)
    }
    return {
      ...Song.defaultMeasure(),
      empty,
      chord,
      text,
      effects,
      notes,
      duration,
      dotted,
      // (0 when the beat isn't a tuplet; the song model says null)
      tuplet: tuplet > 1 ? tuplet : null,
    }
  }

  /** The new chord format (flag 0x01) since GP4 also carries a seventh string; GP3's is shorter. */
  readChord(): Chord {
    const chord: Chord = {
      name: '',
      capo: 0,
      frets: [],
      chordType: '',
      chordRoot: '',
      display: true,
      fingers: [],
    }
    // GP5 always writes the new format, without the flag byte's meaning
    const newFormat = this.version === 5 || (this.r.readUnsignedByte() & 0x01) !== 0
    if (!newFormat) {
      chord.name = this.r.readStringByteSizeOfInteger()
      chord.capo = this.r.readInt()
      if (chord.capo !== 0) {
        for (let i = 0; i < 6; i += 1) chord.frets[i] = this.r.readInt()
      }
      return chord
    }
    if (this.version === 3) {
      this.r.skipBytes(25)
      chord.name = this.r.readStringByte(34)
      chord.capo = this.r.readInt()
      for (let i = 0; i < 6; i += 1) chord.frets[i] = this.r.readInt()
      this.r.skipBytes(36)
      return chord
    }
    this.r.skipBytes(this.version === 5 ? 17 : 16)
    chord.name = this.r.readStringByte(21)
    this.r.skipBytes(4)
    chord.capo = this.r.readInt()
    for (let i = 0; i < 7; i += 1) chord.frets[i] = this.r.readInt()
    this.r.skipBytes(32)
    return chord
  }

  /** GP4 and GP5: two flag bytes. */
  readBeatEffects(): BeatEffects {
    const flags1 = this.r.readUnsignedByte()
    const flags2 = this.r.readUnsignedByte()
    let tapEffect = 0
    if ((flags1 & 0x20) !== 0) tapEffect = this.r.readUnsignedByte()
    let tremoloBar: TremoloBar | undefined
    if ((flags2 & 0x04) !== 0) tremoloBar = this.readTremoloBar()
    const stroke = (flags1 & 0x40) !== 0 ? this.readStroke() : undefined
    if ((flags2 & 0x02) !== 0) this.r.readByte() // pick stroke
    return {
      fadeIn: (flags1 & 0x10) !== 0,
      vibrato: (flags1 & 0x02) !== 0,
      tap: tapEffect === 1,
      slap: tapEffect === 2,
      pop: tapEffect === 3,
      tremoloBar,
      stroke,
    }
  }

  /** GP3: one flag byte; tap/slap/pop share a byte with the tremolo bar. */
  readGp3BeatEffects(): { effects: BeatEffects; harmonic: string } {
    const flags = this.r.readUnsignedByte()
    let tremoloBar: TremoloBar | undefined
    let tapEffect = 0
    if ((flags & 0x20) !== 0) {
      tapEffect = this.r.readUnsignedByte()
      // Always an int; with effect 0 it is the tremolo bar: a dip of that depth, not a curve
      // as in GP4/5 (GP3 counts in half the GP4/5 steps).
      const dip = this.r.readInt()
      if (tapEffect === 0 && dip !== 0) {
        tremoloBar = [
          { position: 0, value: 0, vibrato: 0 },
          { position: 30, value: -Math.round(Math.abs(dip) / 2), vibrato: 0 },
          { position: 60, value: 0, vibrato: 0 },
        ]
      }
    }
    const stroke = (flags & 0x40) !== 0 ? this.readStroke() : undefined
    const effects = {
      ...Song.defaultMeasureEffects(),
      fadeIn: (flags & 0x10) !== 0 || (flags & 0x02) !== 0,
      vibrato: (flags & 0x02) !== 0,
      tremoloBar,
      tap: tapEffect === 1,
      slap: tapEffect === 2,
      pop: tapEffect === 3,
      stroke,
    }
    // 0x04 natural, 0x08 artificial harmonic (as alphaTab and PyGuitarPro read them).
    const harmonic = (flags & 0x04) !== 0 ? 'N.H.' : (flags & 0x08) !== 0 ? 'A.H.' : ''
    return { effects, harmonic }
  }

  /** Up and down stroke speeds; 0 = none. */
  readStroke(): Stroke | undefined {
    const strokeUp = this.r.readByte()
    const strokeDown = this.r.readByte()
    if (strokeUp > 0) return { strokeType: 'up', strokeLength: STROKE_LENGTHS[strokeUp] }
    if (strokeDown > 0) return { strokeType: 'down', strokeLength: STROKE_LENGTHS[strokeDown] }
    return undefined
  }

  readTremoloBar(): TremoloBar {
    const tremoloBar: TremoloBar = []
    this.r.skipBytes(5)
    const numPoints = this.r.readCount(IMPORT_LIMITS.points, 'curve points')
    for (let i = 0; i < numPoints; i += 1) {
      const position = this.r.readInt()
      const value = this.r.readInt()
      this.r.readByte() // vibrato
      tremoloBar[i] = { position, value, vibrato: 0 }
    }
    return tremoloBar
  }

  readBend(): Bend {
    const bend: Bend = []
    this.r.skipBytes(5)
    const numPoints = this.r.readCount(IMPORT_LIMITS.points, 'curve points')
    for (let i = 0; i < numPoints; i += 1) {
      const bendPosition = this.r.readInt()
      const bendValue = this.r.readInt()
      const vibrato = this.r.readByte()
      bend[i] = { bendPosition, bendValue, vibrato }
    }
    return bend
  }

  /** Mixer changes; only the tempo is kept. */
  readMixChange(blockId: number) {
    const v = this.version
    this.r.readByte() // instrument
    if (v === 5) this.r.skipBytes(16) // RSE instrument
    const changes = [0, 1, 2, 3, 4, 5].map(() => this.r.readByte()) // volume, pan, chorus, reverb, phaser, tremolo
    if (v === 5) this.r.readStringByteSizeOfInteger() // tempo name
    const tempoValue = this.r.readInt()
    for (const value of changes) {
      if (value >= 0) this.r.readByte() // transition length
    }
    if (tempoValue >= 0) {
      this.song.measureMeta[blockId].bpm = tempoValue
      this.r.skipBytes(v === 5 && this.minor > 0 ? 2 : 1) // transition length (+ "hide tempo" in 5.10)
    }
    if (v >= 4) this.r.readByte() // apply to all tracks
    if (v === 5) {
      this.r.skipBytes(1) // wah
      if (this.minor > 0) {
        this.r.readStringByteSizeOfInteger() // RSE effect names
        this.r.readStringByteSizeOfInteger()
      }
    }
  }

  readNote(): Note {
    const v = this.version
    const flags = this.r.readUnsignedByte()
    // (`dynamic` isn't part of the Note type; liftNoteDynamics moves it to the beat.)
    const note: Note & { dynamic: string } = {
      ...Song.defaultNote(),
      ghost: (flags & 0x04) !== 0,
      dynamic: '',
    }
    // The same accent flags in every version (checked against Guitar Pro 3 files).
    note.accentuated = (flags & 0x40) !== 0
    note.heavyAccentuated = (flags & 0x02) !== 0
    if ((flags & 0x20) !== 0) {
      const noteType = this.r.readUnsignedByte()
      note.tied = noteType === 0x02
      note.dead = noteType === 0x03
    }
    if (v < 5 && (flags & 0x01) !== 0) this.r.skipBytes(2) // time-independent duration
    // The same dynamic index (1 = ppp … 8 = fff) in every version
    if ((flags & 0x10) !== 0) note.dynamic = DYNAMIC_BY_BYTE[this.r.readByte()]
    if ((flags & 0x20) !== 0) note.fret = this.r.readByte()
    if ((flags & 0x80) !== 0) this.r.skipBytes(2) // fingering
    if (v === 5) {
      if ((flags & 0x01) !== 0) this.r.skipBytes(8) // duration percent
      this.r.skipBytes(1) // swap accidentals
    }
    if ((flags & 0x08) !== 0) {
      Object.assign(note, v === 3 ? this.readGp3NoteEffects() : this.readNoteEffects())
    }
    return note
  }

  /** GP3: one flag byte (bend, hammer-on/pull-off, slide, let ring, grace). */
  readGp3NoteEffects(): Partial<Note> {
    const flags = this.r.readUnsignedByte()
    const effects: Partial<Note> = {
      pullDown: (flags & 0x02) !== 0,
      slide: (flags & 0x04) !== 0,
      letRing: (flags & 0x08) !== 0,
    }
    if ((flags & 0x01) !== 0) effects.bendObj = this.readBend()
    if ((flags & 0x10) !== 0) effects.graceObj = this.readGrace()
    return effects
  }

  /** GP4 and GP5: two flag bytes. */
  readNoteEffects(): Partial<Note> {
    const flags1 = this.r.readUnsignedByte()
    const flags2 = this.r.readUnsignedByte()
    const effects: Partial<Note> = {}
    if ((flags1 & 0x01) !== 0) effects.bendObj = this.readBend()
    if ((flags1 & 0x10) !== 0) effects.graceObj = this.readGrace()
    if ((flags2 & 0x04) !== 0) {
      effects.tremoloPicking = true
      effects.tremoloPickingLength = this.readTremoloPicking()
    }
    if ((flags2 & 0x08) !== 0) {
      effects.slide = true
      this.r.readByte() // slide type
    }
    if ((flags2 & 0x10) !== 0) effects.artificialStyle = this.readArtificialHarmonic()
    if ((flags2 & 0x20) !== 0) effects.trill = this.readTrill()
    effects.letRing = (flags1 & 0x08) !== 0
    effects.pullDown = (flags1 & 0x02) !== 0
    effects.vibrato = (flags2 & 0x40) !== 0
    effects.palmMute = (flags2 & 0x02) !== 0
    effects.stacatto = (flags2 & 0x01) !== 0
    return effects
  }

  /** GP5 adds a flag byte (dead, on the beat); before, a dead grace note had fret 255. */
  readGrace(): Grace {
    const fret = this.r.readUnsignedByte()
    const dynamic = this.r.readUnsignedByte()
    this.r.readByte() // transition
    const duration = graceDurationFromByte(this.r.readUnsignedByte())
    let dead = fret === 255
    let setOnBeat = 'before'
    if (this.version === 5) {
      const flags = this.r.readUnsignedByte()
      dead = (flags & 0x01) !== 0
      setOnBeat = (flags & 0x02) !== 0 ? 'before' : 'width'
    }
    return {
      fret,
      dynamic: DYNAMIC_BY_BYTE[dynamic],
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
    // GP4: one byte; 15/17/22 = artificial harmonic 5/7/12 frets above
    if (this.version === 4) return GP4_HARMONICS[type] ?? ''
    if (type === 1) return 'N.H.' // natural
    if (type === 2) {
      this.r.skipBytes(3)
      return 'A.H.' // artificial
    }
    if (type === 3) {
      this.r.skipBytes(1)
      return 'T.H.' // tapped
    }
    if (type === 4) return 'P.H.' // pinch
    if (type === 5) return 'S.H.' // semi
    return ''
  }

  readTrill() {
    const fret = this.r.readByte()
    const period = this.r.readByte() // 1: 16th, 2: 32nd, 3: 64th
    return { fret, period }
  }
}

export function durationToString(duration: number): NoteLengthCode {
  if (duration + 2 > DURATION_BY_BYTE.length) return '' as NoteLengthCode
  return DURATION_BY_BYTE[duration + 2]
}

/** Grace-note length as stored by Guitar Pro 3-5: 1 = 64th, 2 = 32nd, 3 = 16th. */
export function graceDurationFromByte(durationByte: number): string {
  if (durationByte === 1) return 'z'
  if (durationByte === 2) return 't'
  return 's'
}
