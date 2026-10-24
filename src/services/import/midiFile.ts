import { ImportError } from '../importErrors'

/**
 * Reads a Standard MIDI File (format 0 or 1) into its tracks and events, without
 * interpreting them; `buildSongFromMidi` in `midiImport.ts` turns that into a song.
 */

export interface MidiEvent {
  delta: number
  /** 'MIDI' (channel event), 'meta' or 'sysex' */
  type: string
  midiChannel: number
  metaType: number
  metaData: number[]
  /** status nibble: 8 note off, 9 note on, 0xb controller, 0xc program, 0xd pressure, 0xe pitch bend */
  midiEventType: number
  parameter1: number
  parameter2?: number
}

export interface MidiTrack {
  trackName: string
  events: MidiEvent[]
  byteLength: number
}

export interface MidiFileData {
  format: number
  numTracks: number
  ticksPerBeat: number
  tracks: MidiTrack[]
}

const META = 0xff
const SYSEX = 0xf0
const SYSEX_ESCAPE = 0xf7
const TRACK_NAME = 0x03
const PROGRAM_CHANGE = 0x0c
const CHANNEL_PRESSURE = 0x0d

function fail(message: string): never {
  throw new ImportError(`Invalid MIDI file: ${message}`, 'mid')
}

class SmfReader {
  private readonly data: DataView
  private idx = 0
  /** last channel status byte, for running status (meta and sysex events don't change it) */
  private runningStatus: number | null = null

  constructor(bytes: Uint8Array) {
    this.data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  private u8(): number {
    const value = this.data.getUint8(this.idx)
    this.idx += 1
    return value
  }

  private u16(): number {
    const value = this.data.getUint16(this.idx)
    this.idx += 2
    return value
  }

  private u32(): number {
    const value = this.data.getUint32(this.idx)
    this.idx += 4
    return value
  }

  private expectTag(tag: string): boolean {
    for (let i = 0; i < 4; i += 1) {
      if (this.data.getUint8(this.idx + i) !== tag.charCodeAt(i)) return false
    }
    this.idx += 4
    return true
  }

  /** Variable-length quantity: 7 bits per byte, high bit = more bytes follow. */
  private vlq(): number {
    let result = 0
    let byte
    do {
      byte = this.u8()
      result = (result << 7) + (byte & 0x7f)
    } while (byte >= 0x80)
    return result
  }

  read(): MidiFileData {
    if (!this.expectTag('MThd')) fail('malformed file header.')
    if (this.u32() !== 6) fail('file header length is not 6.')
    const format = this.u16()
    if (format > 2) fail(`MIDI file format ${format} unrecognized.`)
    if (format === 2) fail('MIDI file format type 2 is not supported.')
    const numTracks = this.u16()
    const ticksPerBeat = this.u16()
    const tracks: MidiTrack[] = []
    for (let i = 0; i < numTracks; i += 1) tracks.push(this.readTrack())
    return { format, numTracks, ticksPerBeat, tracks }
  }

  private readTrack(): MidiTrack {
    if (!this.expectTag('MTrk')) fail('malformed track header.')
    const track: MidiTrack = { trackName: '', events: [], byteLength: this.u32() }
    const end = this.idx + track.byteLength
    this.runningStatus = null
    while (this.idx < end) track.events.push(this.readEvent(track))
    return track
  }

  private readEvent(track: MidiTrack): MidiEvent {
    const event: MidiEvent = {
      type: '',
      metaType: 0,
      delta: this.vlq(),
      midiChannel: 0,
      metaData: [],
      midiEventType: 0,
      parameter1: 0,
    }
    const first = this.data.getUint8(this.idx)
    if (first === META) {
      this.idx += 1
      event.type = 'meta'
      event.metaType = this.u8()
      const length = this.vlq()
      for (let i = 0; i < length; i += 1) event.metaData.push(this.u8())
      if (event.metaType === TRACK_NAME) track.trackName = String.fromCharCode(...event.metaData)
    } else if (first === SYSEX || first === SYSEX_ESCAPE) {
      // kept as raw bytes up to the closing 0xf7
      event.type = 'sysex'
      event.metaData.push(this.u8())
      let byte
      do {
        byte = this.u8()
        event.metaData.push(byte)
      } while (byte !== SYSEX_ESCAPE)
    } else {
      let status = first
      if (first & 0x80) {
        this.idx += 1
        this.runningStatus = first
      } else if (this.runningStatus != null) {
        status = this.runningStatus
      } else {
        fail('running status event with no previous event.')
      }
      event.type = 'MIDI'
      event.midiEventType = status >> 4
      event.midiChannel = status & 0x0f
      event.parameter1 = this.u8()
      if (event.midiEventType !== PROGRAM_CHANGE && event.midiEventType !== CHANNEL_PRESSURE) {
        event.parameter2 = this.u8()
      }
    }
    return event
  }
}

export function parseMidiFile(bytes: Uint8Array): MidiFileData {
  return new SmfReader(bytes).read()
}
