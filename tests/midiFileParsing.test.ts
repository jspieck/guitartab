import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMidiFile } from '../src/services/import/midiFile'
import { buildSongFromMidi } from '../src/services/midiImport'
import { midiFile, tempo, text, timeSignature, track, trackName } from './helpers/midiBytes'

/**
 * What the Standard MIDI File reader makes of a file and what the importer builds from it,
 * as JSON snapshots: `two-bars.mid` (the e2e fixture) and a file built here that uses
 * format 1, a conductor track with tempo and meter changes, running status, note-off as
 * velocity 0, sysex, pitch bend, channel pressure, a program change, a chord and drums.
 */

/** A format 1 file: conductor track, a guitar on channel 0, drums on channel 10. */
function showcase(): Uint8Array {
  const conductor = track([
    [0, ...trackName('Showcase')],
    [0, ...tempo(120)],
    [0, ...timeSignature(3, 4)],
    [1440, ...tempo(100)],
    [0, ...timeSignature(4, 4)],
  ])
  const guitar = track([
    [0, ...trackName('Guitar')],
    [0, 0xc0, 25], // program change: one data byte
    [0, 0x90, 40, 100],
    [480, 40, 0], // running status, velocity 0 = note off
    [0, 43, 100],
    [480, 0x80, 43, 64], // explicit note off
    [0, 0xf0, 0x05, 0x7e, 0x7f, 0x09, 0x01, 0xf7], // sysex (GM on)
    [0, 0xe0, 0x00, 0x40], // pitch bend centre
    [0, 0xd0, 0x50], // channel pressure: one data byte
    [0, 0x90, 45, 90],
    [0, ...text('chord')],
    [0, 49, 90], // running status right after a meta event: continues the note-on before it
    [0, 52, 90],
    [960, 0x80, 45, 0],
    [0, 49, 0],
    [0, 52, 0],
    [0, 0x90, 47, 80],
    [1920, 47, 0],
  ])
  const drums = track([
    [0, ...trackName('Drums')],
    [0, 0x99, 36, 110],
    [240, 0x89, 36, 0],
    [240, 0x99, 38, 100],
    [240, 38, 0],
    [240, 42, 70],
    [240, 42, 0],
  ])
  return midiFile(1, 480, [conductor, guitar, drums])
}

function decode(bytes: Uint8Array) {
  return JSON.parse(JSON.stringify(parseMidiFile(bytes)))
}

function imported(bytes: Uint8Array, name: string) {
  const song = buildSongFromMidi(decode(bytes), name)
  return JSON.parse(JSON.stringify({ ...song, programs: [...song.programs] }))
}

const fixture = () => new Uint8Array(readFileSync('e2e/fixtures/files/two-bars.mid'))

describe('MIDI file parsing', () => {
  it('decodes two-bars.mid', async () => {
    await expect(JSON.stringify(decode(fixture()), null, 1)).toMatchFileSnapshot(
      '__snapshots__/midi/two-bars.decoded.json',
    )
  })

  it('imports two-bars.mid', async () => {
    await expect(JSON.stringify(imported(fixture(), 'two-bars.mid'), null, 1)).toMatchFileSnapshot(
      '__snapshots__/midi/two-bars.song.json',
    )
  })

  it('decodes the showcase file', async () => {
    await expect(JSON.stringify(decode(showcase()), null, 1)).toMatchFileSnapshot(
      '__snapshots__/midi/showcase.decoded.json',
    )
  })

  it('imports the showcase file', async () => {
    await expect(JSON.stringify(imported(showcase(), 'showcase.mid'), null, 1)).toMatchFileSnapshot(
      '__snapshots__/midi/showcase.song.json',
    )
  })

  it.each([
    ['a bad header', Uint8Array.from([0x4d, 0x54, 0x68, 0x65, 0, 0, 0, 6])],
    ['format 2', midiFile(2, 480, [track([])])],
    [
      'a bad track header',
      Uint8Array.from([
        ...midiFile(0, 480, []).slice(0, 10),
        0,
        1,
        1,
        0xe0,
        0x4d,
        0x54,
        0x72,
        0x6a,
        0,
        0,
        0,
        0,
      ]),
    ],
    ['running status first', midiFile(0, 480, [track([[0, 40, 100]])])],
  ])('rejects %s', (_, bytes) => {
    expect(() => decode(bytes)).toThrowErrorMatchingSnapshot()
  })
})
