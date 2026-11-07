import { toRaw } from 'vue'
import Song, { type Beat, type Note } from '../../src/stores/song'

// Short marks for the note properties a file format should keep (see songSummary.ts for the
// object form). One letter or word each, so a snapshot line stays readable.
const NOTE_FLAGS: [keyof Note, string][] = [
  ['tied', 't'],
  ['dead', 'x'],
  ['ghost', 'g'],
  ['accentuated', '>'],
  ['heavyAccentuated', '^'],
  ['palmMute', 'pm'],
  ['stacatto', '.'],
  ['letRing', 'lr'],
  ['vibrato', '~'],
  ['slide', 'sl'],
  ['pullDown', 'hp'],
  ['tap', 'tap'],
  ['tremoloPicking', 'tr'],
]

function noteText(note: Note, string: number): string {
  const flags = NOTE_FLAGS.filter(([key]) => note[key] != null && note[key] !== false).map(([, mark]) => mark)
  if (note.artificialStyle) flags.push(`h:${note.artificialStyle}`)
  if (note.bendObj?.length) flags.push(`b:${note.bendObj.map((point) => point.bendValue).join('/')}`)
  if (note.graceObj) flags.push(`gr:${note.graceObj.fret}`)
  if (note.trill) flags.push(`trill:${note.trill.fret}`)
  return `${string}:${note.fret}${flags.length > 0 ? `(${flags.join(',')})` : ''}`
}

function beatExtras(beat: Beat): string[] {
  const extras: string[] = []
  if (beat.text) extras.push(`"${beat.text}"`)
  if (beat.chord?.name) extras.push(`chord ${beat.chord.name}`)
  if (beat.lyrics?.length) extras.push(`lyrics ${beat.lyrics.filter(Boolean).join('|')}`)
  if (beat.effects?.stroke) extras.push(`stroke ${beat.effects.stroke.strokeType}`)
  if (beat.effects?.tremoloBar?.length) extras.push('whammy')
  if (beat.slash) extras.push('slash')
  return extras
}

function beatText(beat: Beat): string {
  let text = `${beat.duration}${beat.dotted ? '.' : ''}${beat.tuplet != null && beat.tuplet > 1 ? `/${beat.tuplet}` : ''}`
  const notes = Array.from(beat.notes ?? [], (note, string) =>
    note == null ? null : noteText(note, string),
  ).filter((note) => note != null)
  if (notes.length > 0) text += ` ${notes.join(' ')}`
  const extras = beatExtras(beat)
  return extras.length > 0 ? `${text} [${extras.join(', ')}]` : text
}

/**
 * The loaded song as plain text, one line per bar and voice: what the corpus
 * snapshots pin. Readable in a diff, so a changed importer shows what it changed.
 */
export function songText(): string {
  const description = toRaw(Song.songDescription)
  const lines = [`title: ${description.title ?? ''} | artist: ${description.artist ?? ''}`]
  const measures = toRaw(Song.measures)
  toRaw(Song.tracks).forEach((track, trackId) => {
    lines.push(
      `track ${trackId}: ${track.name} | strings ${track.strings.join(',')} | program ${track.program}`,
    )
    measures[trackId].forEach((voices, blockId) => {
      const meta = toRaw(Song.measureMeta[blockId])
      const head = [
        `${blockId + 1}`,
        `${meta.numerator}/${meta.denominator}`,
        meta.bpm != null ? `${meta.bpm}bpm` : '',
        meta.repeatOpen ? '|:' : '',
        meta.repeatClose ? `:|x${meta.repeatClose}` : '',
        meta.repeatAlternative ? `alt${meta.repeatAlternative}` : '',
        meta.marker?.text ? `"${meta.marker.text}"` : '',
      ]
        .filter(Boolean)
        .join(' ')
      voices.forEach((beats, voiceId) => {
        // An all-rest second voice is what every importer adds; leave it out.
        if (voiceId > 0 && beats.every((beat) => beat.notes.every((note) => note == null))) return
        lines.push(`  ${head} v${voiceId + 1}: ${beats.map(beatText).join(' | ')}`)
      })
    })
  })
  return `${lines.join('\n')}\n`
}
