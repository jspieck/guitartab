import { describe, expect, it } from 'vitest'
import { buildSongFromMidi, placeOnStrings, type MidiFileData } from '../src/services/midiImport'

const TPQ = 480

function noteEvents(channel: number, notes: { delta: number, pitch: number, length: number }[]) {
  return notes.flatMap(({ delta, pitch, length }) => [
    { delta, type: 'MIDI', midiChannel: channel, metaType: 0, metaData: [], midiEventType: 0x09, parameter1: pitch, parameter2: 96 },
    { delta: length, type: 'MIDI', midiChannel: channel, metaType: 0, metaData: [], midiEventType: 0x08, parameter1: pitch, parameter2: 0 },
  ])
}

function meta(metaType: number, metaData: number[], delta = 0) {
  return { delta, type: 'meta', midiChannel: 0, metaType, metaData, midiEventType: 0, parameter1: 0 }
}

describe('MIDI import', () => {
  it('places chord notes on separate strings at the lowest frets', () => {
    const tuning = [40, 45, 50, 55, 59, 64]
    expect(placeOnStrings([40], tuning)).toEqual([0, null, null, null, null, null])
    // E major chord voicing
    expect(placeOnStrings([40, 47, 52, 56, 59, 64], tuning)).toEqual([0, 2, 2, 1, 0, 0])
    // Too low for the instrument: moved up an octave
    expect(placeOnStrings([28], tuning)).toEqual([0, null, null, null, null, null])
  })

  it('reads tempo, time signature, rhythm and notes', () => {
    const midi: MidiFileData = {
      ticksPerBeat: TPQ,
      tracks: [{
        trackName: 'Lead',
        events: [
          meta(0x51, [0x07, 0xa1, 0x20]), // 120 bpm
          meta(0x58, [3, 2, 24, 8]), // 3/4
          ...noteEvents(0, [
            { delta: 0, pitch: 40, length: TPQ },
            { delta: 0, pitch: 45, length: TPQ / 2 },
            { delta: TPQ / 2, pitch: 47, length: TPQ }, // after an eighth rest
          ]),
        ],
      }],
    }
    const song = buildSongFromMidi(midi, 'folder/My Song.mid')
    expect(song.title).toBe('My Song')
    expect(song.bpm).toBe(120)
    expect(song.measureMeta).toHaveLength(1)
    expect(song.measureMeta[0]).toMatchObject({ numerator: 3, denominator: 4, bpm: 120 })
    const beats = song.measures[0][0][0]
    expect(beats.map((beat) => beat.duration)).toEqual(['q', 'e', 'er', 'q'])
    expect(beats[0].notes[0]?.fret).toBe(0)
    expect(beats[1].notes[1]?.fret).toBe(0)
    expect(beats[3].notes[1]?.fret).toBe(2)
  })

  it('splits a format-0 file by channel and keeps drum notes as MIDI numbers', () => {
    const midi: MidiFileData = {
      ticksPerBeat: TPQ,
      tracks: [{
        trackName: '',
        events: [
          // In one track the deltas add up, so interleave the two channels by hand.
          { delta: 0, type: 'MIDI', midiChannel: 0, metaType: 0, metaData: [], midiEventType: 0x09, parameter1: 52, parameter2: 96 },
          { delta: 0, type: 'MIDI', midiChannel: 9, metaType: 0, metaData: [], midiEventType: 0x09, parameter1: 36, parameter2: 96 },
          { delta: TPQ, type: 'MIDI', midiChannel: 0, metaType: 0, metaData: [], midiEventType: 0x08, parameter1: 52, parameter2: 0 },
          { delta: 0, type: 'MIDI', midiChannel: 9, metaType: 0, metaData: [], midiEventType: 0x08, parameter1: 36, parameter2: 0 },
        ],
      }],
    }
    const song = buildSongFromMidi(midi, 'groove.mid')
    expect(song.tracks.map((track) => [track.name, track.channel.index])).toEqual([['Track 1', 0], ['Drums', 9]])
    const drumBeat = song.measures[1][0][0][0]
    expect(drumBeat.notes.filter((note) => note != null).map((note) => note!.fret)).toEqual([36])
  })

  it('rejects files without notes or with SMPTE timing', () => {
    expect(() => buildSongFromMidi({ ticksPerBeat: TPQ, tracks: [{ trackName: '', events: [meta(0x51, [7, 0xa1, 0x20])] }] }, 'x.mid'))
      .toThrow('no notes')
    expect(() => buildSongFromMidi({ ticksPerBeat: 0xe728, tracks: [] }, 'x.mid')).toThrow('SMPTE')
  })
})
