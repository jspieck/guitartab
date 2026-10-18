import type { Beat, Note } from '../../src/assets/js/songData'
import type { GpifSong } from '../../src/services/gpifImport'

const NOTE_KEYS: (keyof Note)[] = [
  'fret',
  'tied',
  'dead',
  'ghost',
  'accentuated',
  'heavyAccentuated',
  'palmMute',
  'stacatto',
  'letRing',
  'vibrato',
  'slide',
  'pullDown',
  'tap',
  'tremoloPicking',
  'artificialStyle',
]

/** What a file format should keep of a song, per bar / beat / note (first voice). */
export function songSummary(song: Pick<GpifSong, 'description' | 'tracks' | 'measureMeta' | 'measures'>) {
  const note = (value: Note | null) =>
    value == null
      ? null
      : {
          ...Object.fromEntries(
            NOTE_KEYS.filter((key) => value[key] != null && value[key] !== false).map((key) => [
              key,
              value[key],
            ]),
          ),
          bend: value.bendObj?.map((point) => point.bendValue),
          grace: value.graceObj ? [value.graceObj.fret, value.graceObj.duration] : undefined,
          trill: value.trill?.fret,
        }
  const beat = (value: Beat) => ({
    d: value.duration,
    dotted: value.dotted,
    tuplet: value.tuplet != null && value.tuplet > 1 ? value.tuplet : null,
    text: value.text,
    chord: value.chord ? [value.chord.name, value.chord.frets.slice(0, 6)] : undefined,
    dynamic: value.dynamic,
    // The importer gives every brush a 16th; the length itself isn't stored in GPIF.
    stroke: value.effects.stroke?.strokeType,
    fadeIn: value.effects.fadeIn,
    slap: value.effects.slap,
    pop: value.effects.pop,
    whammy: value.effects.tremoloBar?.map((point) => point.value),
    notes: value.notes.map(note),
  })
  return {
    title: song.description.title,
    tracks: song.tracks.map((track) => [track.name, track.strings, track.program, track.channel.index]),
    bars: song.measureMeta.map((meta) => [
      meta.numerator,
      meta.denominator,
      meta.bpm,
      meta.repeatOpen,
      meta.repeatClose,
      meta.repeatAlternative,
      meta.marker?.text,
    ]),
    measures: song.measures.map((track) => track.map((block) => block[0].map(beat))),
  }
}
