import Song, {
  type Beat,
  type Channel,
  type Chord,
  type MeasureMetaInfo,
  type SongDescription,
  type Track,
} from '../../../stores/song'

/** A song as read from a Guitar Pro 3–5 file, before it is put into `Song`. */
export interface GuitarProSong {
  description: SongDescription
  bpm: number
  measureMeta: MeasureMetaInfo[]
  tracks: Track[]
  chords: Map<string, Chord>[]
  /** The file's 64 MIDI channels. */
  channels: Channel[]
  measures: Beat[][][][]
}

export function emptyGuitarProSong(): GuitarProSong {
  return {
    description: {
      title: '',
      author: '',
      subtitle: '',
      artist: '',
      album: '',
      music: '',
      copyright: '',
      writer: '',
      instructions: '',
      comments: [],
      wordsAndMusic: '',
    },
    bpm: 120,
    measureMeta: [],
    tracks: [],
    chords: [],
    channels: [],
    measures: [],
  }
}

/** Adds a chord to a track's chord library (shown in the chord diagrams). */
export function addChord(song: GuitarProSong, trackId: number, chord: Chord): void {
  ;(song.chords[trackId] ??= new Map()).set(chord.name, { ...chord, display: true })
}

/** Replaces the current song with `song`. */
export function applyGuitarProSong(song: GuitarProSong): void {
  Song.songDescription = song.description
  Song.measureMeta = song.measureMeta
  Song.numMeasures = song.measureMeta.length
  Song.tracks = song.tracks
  Song.chordsMap = song.chords
  Song.allChannels = song.channels
  Song.measures = song.measures
  Song.setTempo(song.bpm)
}

/**
 * Guitar Pro 3–5 store a dynamic per note; the editor shows, plays and writes
 * one per beat. Each beat gets its notes' dynamic (rests keep the one before),
 * marked as present where it changes, as the GPIF import does.
 */
function noteDynamic(note: unknown): string | undefined {
  return (note as { dynamic?: string } | null | undefined)?.dynamic || undefined
}

export function liftNoteDynamics(song: GuitarProSong): void {
  for (const bars of song.measures) {
    const last: string[] = []
    for (const voices of bars) {
      voices.forEach((beats, voiceId) => {
        for (const beat of beats) {
          const previous = last[voiceId] ?? 'mf'
          // The readers keep the note's dynamic on the note object (not part of the Note type).
          const dynamic = beat.notes.map(noteDynamic).find((value) => value)
          beat.dynamic = dynamic ?? previous
          beat.dynamicPresent = dynamic != null && dynamic !== previous
          last[voiceId] = beat.dynamic
        }
      })
    }
  }
}
