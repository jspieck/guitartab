import { describe, expect, it } from 'vitest'
import {
  assignChannels,
  BEND_RANGE,
  buildMidiFile,
  midiFileName,
  PPQ,
  type MidiExportSource,
} from '../src/services/midiExport'
import { parseMidiFile, type MidiFileData } from '../src/services/import/midiFile'
import { buildSongFromMidi } from '../src/services/midiImport'
import { beat, meta, note, track } from './helpers/songBuilders'

const QUARTER = PPQ
const WHOLE = 4 * PPQ

interface DecodedNote {
  tick: number
  length: number
  pitch: number
  velocity: number
  channel: number
}

/** Absolute-time view of a parsed file: per track its notes, plus all events. */
function decode(midi: MidiFileData) {
  return midi.tracks.map((track) => {
    let tick = 0
    const events = track.events.map((event) => {
      tick += event.delta
      return { ...event, tick }
    })
    const open = new Map<string, { tick: number; velocity: number }>()
    const notes: DecodedNote[] = []
    for (const event of events) {
      if (event.type !== 'MIDI') continue
      const key = `${event.midiChannel}:${event.parameter1}`
      if (event.midiEventType === 0x09 && (event.parameter2 ?? 0) > 0) {
        open.set(key, { tick: event.tick, velocity: event.parameter2! })
      } else if (event.midiEventType === 0x08 || event.midiEventType === 0x09) {
        const start = open.get(key)
        if (start == null) continue
        notes.push({
          tick: start.tick,
          length: event.tick - start.tick,
          pitch: event.parameter1,
          velocity: start.velocity,
          channel: event.midiChannel,
        })
        open.delete(key)
      }
    }
    return {
      name: track.trackName,
      events,
      notes: notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch),
    }
  })
}

function exportAndRead(source: MidiExportSource, unrollRepeats = false) {
  const bytes = buildMidiFile(source, { unrollRepeats })
  return { bytes, midi: parseMidiFile(bytes), tracks: decode(parseMidiFile(bytes)) }
}

function simpleSong(): MidiExportSource {
  return {
    title: 'Riff',
    tracks: [track('Guitar', { program: 29 })],
    mixer: [{ volume: 80, balance: 20, reverb: 40, chorus: 10 }],
    measureMeta: [
      meta(4, 4, { bpm: 90, marker: { text: 'Intro', color: { red: 0, green: 0, blue: 0 } } }),
      meta(3, 4, { bpm: 140 }),
    ],
    measures: [
      [
        [
          [
            beat('q', { 0: note(3) }, { dynamic: 'f', dynamicPresent: true }),
            beat('q', { 1: note(2), 2: note(2) }, { dynamic: 'p' }),
            beat('q'),
            beat('e', { 5: note(0) }, { tuplet: 3 }),
            beat('e', { 5: note(1) }, { tuplet: 3 }),
            beat('e', { 5: note(3) }, { tuplet: 3 }),
          ],
          [beat('w')],
        ],
        [[beat('h', { 0: note(5) }, { dotted: true })], [beat('w')]],
      ],
    ],
  }
}

describe('MIDI export', () => {
  it('writes a type 1 file: conductor track with tempo, time signatures and markers, one track per song track', () => {
    const { midi, tracks } = exportAndRead(simpleSong())
    expect(midi.format).toBe(1)
    expect(midi.ticksPerBeat).toBe(PPQ)
    expect(midi.tracks).toHaveLength(2)
    expect(tracks[0].name).toBe('Riff')
    expect(tracks[1].name).toBe('Guitar')
    const meta = (type: number) =>
      tracks[0].events.filter((event) => event.type === 'meta' && event.metaType === type)
    const tempos = meta(0x51).map((event) => ({
      tick: event.tick,
      bpm: Math.round(
        60_000_000 / ((event.metaData[0] << 16) | (event.metaData[1] << 8) | event.metaData[2]),
      ),
    }))
    expect(tempos).toEqual([
      { tick: 0, bpm: 90 },
      { tick: WHOLE, bpm: 140 },
    ])
    expect(meta(0x58).map((event) => [event.tick, event.metaData[0], 2 ** event.metaData[1]])).toEqual([
      [0, 4, 4],
      [WHOLE, 3, 4],
    ])
    expect(meta(0x06).map((event) => String.fromCharCode(...event.metaData))).toEqual(['Intro'])
  })

  it('writes notes at their pitch and time, triplets included, with velocities from the dynamics', () => {
    const { tracks } = exportAndRead(simpleSong())
    const third = QUARTER / 3
    expect(tracks[1].notes).toEqual([
      { tick: 0, length: QUARTER, pitch: 43, velocity: 96, channel: 0 },
      { tick: QUARTER, length: QUARTER, pitch: 47, velocity: 49, channel: 0 },
      { tick: QUARTER, length: QUARTER, pitch: 52, velocity: 49, channel: 0 },
      { tick: 3 * QUARTER, length: third, pitch: 64, velocity: 80, channel: 0 },
      { tick: 3 * QUARTER + third, length: third, pitch: 65, velocity: 80, channel: 0 },
      { tick: 3 * QUARTER + 2 * third, length: third, pitch: 67, velocity: 80, channel: 0 },
      { tick: WHOLE, length: 3 * QUARTER, pitch: 45, velocity: 80, channel: 0 },
    ])
  })

  it('sets program, volume, pan, reverb, chorus and the pitch bend range', () => {
    const { tracks } = exportAndRead(simpleSong())
    const channelEvents = tracks[1].events.filter((event) => event.type === 'MIDI' && event.tick === 0)
    expect(channelEvents.find((event) => event.midiEventType === 0x0c)?.parameter1).toBe(29)
    const controllers = Object.fromEntries(
      channelEvents
        .filter((event) => event.midiEventType === 0x0b)
        .map((event) => [event.parameter1, event.parameter2]),
    )
    expect(controllers).toMatchObject({ 7: 80, 10: 20, 91: 40, 93: 10, 6: BEND_RANGE })
  })

  it('joins tied notes, plays a capo, and puts drums on channel 10 without a program change', () => {
    const source: MidiExportSource = {
      title: '',
      tracks: [
        track('Guitar', { capo: 2 }),
        track('Drums', { strings: [0, 0, 0, 0, 0, 0], channel: { index: 9, effectChannel: 9 } }),
      ],
      measureMeta: [meta(4, 4), meta(4, 4)],
      measures: [
        [
          [[beat('h'), beat('h', { 2: note(4, { tieBegin: true }) })], [beat('w')]],
          [[beat('h', { 2: note(4, { tied: true }) }), beat('h')], [beat('w')]],
        ],
        [
          [[beat('h', { 0: note(36), 3: note(42) }), beat('h')], [beat('w')]],
          [[beat('w')], [beat('w')]],
        ],
      ],
    }
    const { tracks } = exportAndRead(source)
    expect(tracks[1].notes).toEqual([
      { tick: 2 * QUARTER, length: 4 * QUARTER, pitch: 50 + 4 + 2, velocity: 80, channel: 0 },
    ])
    expect(tracks[2].notes.map((n) => [n.tick, n.pitch, n.channel])).toEqual([
      [0, 36, 9],
      [0, 42, 9],
    ])
    expect(tracks[2].events.some((event) => event.type === 'MIDI' && event.midiEventType === 0x0c)).toBe(
      false,
    )
  })

  it('writes bends as pitch bend on the note, back to centre at its end', () => {
    const bent = note(7, {
      bendObj: [
        { bendPosition: 0, bendValue: 0, vibrato: 0 },
        { bendPosition: 60, bendValue: 100, vibrato: 0 },
      ],
    })
    const source: MidiExportSource = {
      title: '',
      tracks: [track('Lead')],
      measureMeta: [meta(4, 4)],
      measures: [[[[beat('w', { 3: bent })], [beat('w')]]]],
    }
    const { tracks } = exportAndRead(source)
    const bends = tracks[1].events
      .filter((event) => event.type === 'MIDI' && event.midiEventType === 0x0e)
      .map((event) => ({ tick: event.tick, value: event.parameter1 | ((event.parameter2 ?? 0) << 7) }))
    expect(bends[0]).toEqual({ tick: 0, value: 8192 })
    // A full bend (100) is a whole tone: 2 of 12 semitones above the centre, at the note's end.
    const peak = Math.round(8192 + (2 / BEND_RANGE) * 8191)
    expect(bends.find((bend) => bend.tick === WHOLE && bend.value !== 8192)?.value).toBe(peak)
    expect(bends[bends.length - 1]).toEqual({ tick: WHOLE, value: 8192 })
  })

  it('plays grace notes before the note, strums across the strings and tremolo picking as repeated notes', () => {
    const grace = note(5, {
      graceObj: {
        fret: 3,
        string: 0,
        height: 0,
        dynamic: 'mf',
        transition: 'none',
        duration: 's',
        setOnBeat: 'before',
        dead: false,
      },
    })
    const source: MidiExportSource = {
      title: '',
      tracks: [track('Guitar')],
      measureMeta: [meta(4, 4)],
      measures: [
        [
          [
            [
              beat('q', { 0: grace }),
              beat(
                'q',
                { 0: note(0), 1: note(0), 2: note(0) },
                {
                  effects: {
                    vibrato: false,
                    fadeIn: false,
                    tap: false,
                    slap: false,
                    pop: false,
                    stroke: { strokeType: 'down', strokeLength: 8 },
                  },
                },
              ),
              beat('h', { 0: note(1, { tremoloPicking: true, tremoloPickingLength: 'e' }) }),
            ],
            [beat('w')],
          ],
        ],
      ],
    }
    const { notes } = exportAndRead(source).tracks[1]
    const sixteenth = QUARTER / 4
    expect(notes.slice(0, 2).map((n) => [n.tick, n.length, n.pitch])).toEqual([
      [0, sixteenth, 43],
      [sixteenth, QUARTER - sixteenth, 45],
    ])
    // A down stroke starts on the lowest string; each further string a little later.
    const strum = notes.filter((n) => n.tick >= QUARTER && n.tick < 2 * QUARTER)
    expect(strum.map((n) => n.pitch)).toEqual([40, 45, 50])
    expect(strum[1].tick - strum[0].tick).toBeCloseTo(WHOLE / 8 / 12, -1)
    expect(notes.filter((n) => n.tick >= 2 * QUARTER).map((n) => n.tick)).toEqual(
      [2, 2.5, 3, 3.5].map((q) => q * QUARTER),
    )
  })

  it('plays repeats, voltas and D.S. al Coda out, or writes every bar once', () => {
    const bar = (fret: number) => [[beat('w', { 0: note(fret) })], [beat('w')]]
    const source: MidiExportSource = {
      title: '',
      tracks: [track('Guitar')],
      measureMeta: [
        meta(4, 4, { repeatOpen: true }),
        meta(4, 4, { repeatClose: 1, repeatAlternative: 1 }),
        meta(4, 4, { repeatAlternative: 2 }),
      ],
      measures: [[bar(0), bar(1), bar(2)]],
    }
    const pitches = (unroll: boolean) =>
      exportAndRead(source, unroll).tracks[1].notes.map((n) => n.pitch - 40)
    expect(pitches(true)).toEqual([0, 1, 0, 2])
    expect(pitches(false)).toEqual([0, 1, 2])
  })

  it('writes the lyric of the pass a repeat is in', () => {
    const source: MidiExportSource = {
      title: '',
      tracks: [track('Voice')],
      measureMeta: [meta(4, 4, { repeatOpen: true, repeatClose: 1 })],
      measures: [[[[beat('w', { 0: note(0) }, { lyrics: ['one', 'two'] })], [beat('w')]]]],
    }
    const lyrics = exportAndRead(source, true).tracks[1].events.filter(
      (event) => event.type === 'meta' && event.metaType === 0x05,
    )
    expect(lyrics.map((event) => [event.tick, String.fromCharCode(...event.metaData)])).toEqual([
      [0, 'one'],
      [WHOLE, 'two'],
    ])
  })

  it('reads back through the MIDI importer to the same notes', () => {
    const song = buildSongFromMidi(
      parseMidiFile(buildMidiFile(simpleSong(), { unrollRepeats: false })),
      'riff.mid',
    )
    expect(song.measureMeta.map((bar) => [bar.numerator, bar.denominator, bar.bpm])).toEqual([
      [4, 4, 90],
      [3, 4, 140],
    ])
    expect(song.tracks).toHaveLength(1)
    expect(song.tracks[0].name).toBe('Guitar')
    const firstBar = song.measures[0][0][0]
    const pitches = firstBar.map((b) =>
      b.notes.flatMap((n, s) => (n ? [song.tracks[0].strings[s] + n.fret] : [])),
    )
    // The MIDI importer quantizes to sixteenths, so the triplet comes back as straight notes.
    expect(pitches.slice(0, 2)).toEqual([[43], [47, 52]])
  })

  it('gives each melodic track its own channel and skips the drum channel', () => {
    const drums = track('Drums', { channel: { index: 9, effectChannel: 9 } })
    const tracks = [...Array.from({ length: 10 }, (_, i) => track(`T${i}`)), drums]
    expect(assignChannels(tracks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 9])
  })

  it('names the file after the title', () => {
    expect(midiFileName('My: Song')).toBe('My Song.mid')
    expect(midiFileName('[Title]')).toBe('song.mid')
  })
})
