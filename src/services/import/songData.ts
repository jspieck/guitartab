import Song, {
  type Beat,
  type Chord,
  type MeasureMetaInfo,
  type SongDescription,
  type Track,
} from '../../stores/song'

/**
 * A whole song as plain data: what the GPIF and MusicXML readers produce and the songs
 * built in code (demo, examples) are. Applying it is the one step they share, so it stays
 * at startup while the readers are lazy chunks.
 */
export interface GpifSong {
  description: SongDescription
  bpm: number
  measureMeta: MeasureMetaInfo[]
  tracks: Track[]
  chords: Map<string, Chord>[]
  measures: Beat[][][][]
}

export function applyGpifSong(song: GpifSong): void {
  Song.songDescription = song.description
  Song.measureMeta = song.measureMeta
  Song.numMeasures = song.measureMeta.length
  Song.tracks = song.tracks
  Song.chordsMap = song.chords
  for (const track of song.tracks) {
    const channel = Song.allChannels[track.channel.index]
    if (channel) channel.cInstrument = track.program
  }
  Song.measures = song.measures
  Song.setTempo(song.bpm)
}
