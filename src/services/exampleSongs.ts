import Song from '../stores/song'
import { EXAMPLE_SONGS, creditLine, type ExampleSong, type ExampleTrack } from '../data/exampleSongs'
import type { MidiFileData } from './import/midiFile'
import type { ImportedSong } from './midiImport'
import { describeImportWarnings } from './importWarnings'
import { importSongBytes, loadBuiltSong } from './songImport'
import { showUserMessage } from './userNotifications'
import { setClefFrom } from '../utils/clefs'

/** Shifts every pitched note (not the drum channel) by `semitones`. */
function transposeMidi(midi: MidiFileData, semitones: number): MidiFileData {
  if (semitones === 0) return midi
  for (const track of midi.tracks)
    for (const event of track.events)
      if (
        event.type === 'MIDI' &&
        (event.midiEventType === 0x08 || event.midiEventType === 0x09) &&
        event.midiChannel !== 9
      )
        event.parameter1 = Math.min(127, Math.max(0, event.parameter1 + semitones))
  return midi
}

/** The catalog's string tunings, by the file's track index. */
function tuningsOf(example: ExampleSong): (number[] | undefined)[] {
  const tunings: (number[] | undefined)[] = []
  for (const { index, track } of example.tracks ?? []) tunings[index] = track.strings
  return tunings
}

/** Keeps, names and voices the tracks the catalog lists. */
function arrange(song: ImportedSong, example: ExampleSong): ImportedSong {
  const picks: { index: number; track: ExampleTrack | null }[] =
    example.tracks ?? song.tracks.map((_, index) => ({ index, track: null }))
  const kept = picks.filter((pick) => song.tracks[pick.index] != null)
  const tracks = kept.map(({ index, track }) => {
    const imported = song.tracks[index]
    if (track == null) return imported
    song.programs.set(imported.channel.index, track.program)
    const arranged = { ...imported, name: track.name, program: track.program }
    if (track.clef) setClefFrom(arranged, 0, track.clef)
    return arranged
  })
  return { ...song, tracks, measures: kept.map(({ index }) => song.measures[index]) }
}

function describe(example: ExampleSong): void {
  Song.songDescription.title = example.title
  Song.songDescription.artist = example.composer
  Song.songDescription.author = example.composer
  Song.songDescription.music = example.composer
  if (example.credit) {
    Song.songDescription.copyright = `${example.credit.license} (${example.credit.sourceUrl})`
    Song.songDescription.comments = [creditLine(example.credit)]
  }
}

/**
 * Replaces the song with an example. MIDI examples go through the normal import
 * (`importSongBytes`), so they open, roll back and report warnings like a user's file.
 */
export async function openExampleSong(id: string): Promise<void> {
  const example = EXAMPLE_SONGS.find((candidate) => candidate.id === id)
  if (example == null) throw new Error(`Unknown example song ${id}`)
  if (example.build != null) {
    // Written in code; each in its own chunk.
    const song =
      example.build === 'shuffle'
        ? (await import('../data/exampleShuffle')).buildShuffle()
        : (await import('../data/demoArrangement')).buildDemoArrangement()
    loadBuiltSong(song)
    return
  }
  if (example.file == null) throw new Error(`Example song ${id} has no file`)
  const response = await fetch(`${import.meta.env.BASE_URL}examples/${example.file}`)
  if (!response.ok) throw new Error(`Could not load ${example.file} (${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const [{ parseMidiFile }, { applyImportedSong, buildSongFromMidi }] = await Promise.all([
    import('./import/midiFile'),
    import('./midiImport'),
  ])
  const warnings = importSongBytes(example.file, bytes, {
    midi: (data, name) =>
      arrange(
        buildSongFromMidi(transposeMidi(parseMidiFile(data), example.transpose ?? 0), name, {
          tunings: tuningsOf(example),
        }),
        example,
      ),
    // Before loading finishes, so the song info is part of the clean (saved) state.
    applyMidi: (song) => {
      applyImportedSong(song)
      describe(example)
    },
  })
  if (warnings.length > 0) showUserMessage(describeImportWarnings(warnings))
}
