import type { Beat, MeasureMetaInfo, Note, SongDescription, Track } from '../stores/song'

/**
 * Writes a song as MusicXML 4.0 (score-partwise), for MuseScore, Finale, Sibelius, Dorico
 * and Guitar Pro. One part per track, standard notation with string/fret on every note
 * (MuseScore builds a tab staff from that and the staff tuning). Pure: takes song data,
 * returns the XML text.
 */

export interface MusicXmlSource {
  description: SongDescription
  tracks: Track[]
  measureMeta: MeasureMetaInfo[]
  /** track → bar → voice → beat */
  measures: Beat[][][][]
}

// Durations in divisions of a quarter note. 6720 = 2^6 · 3 · 5 · 7, so 256ths,
// triplets, quintuplets and septuplets all come out whole.
const DIVISIONS = 6720
const DRUM_CHANNEL = 9
const MAX_VOICES = 2

const NOTE_TYPES: Record<string, { type: string; quarters: number }> = {
  w: { type: 'whole', quarters: 4 },
  h: { type: 'half', quarters: 2 },
  q: { type: 'quarter', quarters: 1 },
  e: { type: 'eighth', quarters: 1 / 2 },
  s: { type: '16th', quarters: 1 / 4 },
  t: { type: '32nd', quarters: 1 / 8 },
  z: { type: '64th', quarters: 1 / 16 },
  o: { type: '128th', quarters: 1 / 32 },
  2: { type: '256th', quarters: 1 / 64 },
}
const SHARP_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B']
const SHARP_ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]
const DYNAMICS = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'])
const HARMONICS: Record<string, string> = {
  'A.H.': '<artificial/>',
  'T.H.': '<artificial/>',
  'P.H.': '<artificial/>',
}
const TREMOLO_MARKS: Record<string, number> = { e: 1, s: 2, t: 3 }

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** How many plain notes a tuplet of `actual` replaces (same table as `Duration`). */
export function tupletNormalNotes(actual: number): number {
  if (actual === 3) return 2
  if (actual >= 5 && actual <= 7) return 4
  if (actual >= 9 && actual <= 15) return 8
  return 0
}

function baseDuration(beat: Beat): string {
  return beat.duration.replace(/r+$/, '')
}

/** A beat's length in divisions, matching the app's `Duration.getDurationOfNote`. */
export function beatDivisions(beat: Beat): number {
  const base = NOTE_TYPES[baseDuration(beat)]
  if (base == null) return 0
  let quarters = base.quarters
  if (beat.dotted) quarters *= 1.5
  if (beat.doubleDotted) quarters *= 1.75
  const normal = beat.tuplet != null && beat.tuplet > 1 ? tupletNormalNotes(beat.tuplet) : 0
  if (normal > 0) quarters *= normal / beat.tuplet!
  return Math.round(quarters * DIVISIONS)
}

function pitchXml(midi: number): string {
  const step = SHARP_STEPS[midi % 12]
  const alter = SHARP_ALTERS[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`
}

/** Drums: the fret is the General MIDI drum note; place it on the staff at that note's pitch. */
function unpitchedXml(midi: number): string {
  return (
    `<unpitched><display-step>${SHARP_STEPS[midi % 12]}</display-step>` +
    `<display-octave>${Math.floor(midi / 12) - 1}</display-octave></unpitched>`
  )
}

function isDrumTrack(track: Track): boolean {
  return track.channel?.index === DRUM_CHANNEL || track.primaryChannel === DRUM_CHANNEL
}

function noteOf(beat: Beat | undefined, string: number): Note | null {
  return beat?.notes?.[string] ?? null
}

function isRest(beat: Beat): boolean {
  return beat.duration.endsWith('r') || !(beat.notes ?? []).some((note) => note != null)
}

// ---------------------------------------------------------------------------
// Part header

function scorePart(track: Track, index: number): string {
  const id = `P${index + 1}`
  const channel = (isDrumTrack(track) ? DRUM_CHANNEL : Math.max(0, track.channel?.index ?? 0) % 16) + 1
  const program = Math.min(128, Math.max(1, (track.program >= 0 ? track.program : 0) + 1))
  return (
    `<score-part id="${id}"><part-name>${escapeXml(track.name || `Track ${index + 1}`)}</part-name>` +
    `<score-instrument id="${id}-I1"><instrument-name>${escapeXml(track.name || 'Instrument')}</instrument-name></score-instrument>` +
    `<midi-instrument id="${id}-I1"><midi-channel>${channel}</midi-channel>` +
    `${isDrumTrack(track) ? '' : `<midi-program>${program}</midi-program>`}</midi-instrument></score-part>`
  )
}

function clefAndTuning(track: Track): string {
  if (isDrumTrack(track)) return '<clef><sign>percussion</sign></clef>'
  const lowest = Math.min(...track.strings)
  // Guitar-family parts are written an octave above sounding pitch.
  const clef =
    lowest < 36
      ? '<clef><sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef>'
      : '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>'
  // MusicXML numbers tuning lines from the lowest string up, as the app indexes strings.
  const tuning = track.strings
    .map((midi, i) => {
      const step = SHARP_STEPS[midi % 12]
      const alter = SHARP_ALTERS[midi % 12]
      return (
        `<staff-tuning line="${i + 1}"><tuning-step>${step}</tuning-step>` +
        `${alter ? `<tuning-alter>${alter}</tuning-alter>` : ''}<tuning-octave>${Math.floor(midi / 12) - 1}</tuning-octave></staff-tuning>`
      )
    })
    .join('')
  const capo = track.capo > 0 ? `<capo>${track.capo}</capo>` : ''
  return `${clef}<staff-details><staff-lines>${track.strings.length}</staff-lines>${tuning}${capo}</staff-details>`
}

// ---------------------------------------------------------------------------
// Bar-level markings

function barAttributes(
  meta: MeasureMetaInfo,
  previous: MeasureMetaInfo | undefined,
  track: Track,
  first: boolean,
): string {
  const timeChanged =
    previous == null || previous.numerator !== meta.numerator || previous.denominator !== meta.denominator
  if (!first && !timeChanged) return ''
  const parts = [
    first ? `<divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key>` : '',
    timeChanged
      ? `<time><beats>${meta.numerator}</beats><beat-type>${meta.denominator}</beat-type></time>`
      : '',
    first ? clefAndTuning(track) : '',
  ]
  return `<attributes>${parts.join('')}</attributes>`
}

function direction(content: string, placement: 'above' | 'below' = 'above', sound = ''): string {
  return `<direction placement="${placement}"><direction-type>${content}</direction-type>${sound}</direction>`
}

function barDirections(meta: MeasureMetaInfo, isFirstPart: boolean): string {
  let out = ''
  // Tempo and rehearsal marks belong to the score; write them once, in the first part.
  if (!isFirstPart) return out
  if (meta.marker?.text) out += direction(`<rehearsal>${escapeXml(meta.marker.text)}</rehearsal>`)
  if (meta.bpm != null && meta.bpm > 0) {
    out += direction(
      `<metronome><beat-unit>quarter</beat-unit><per-minute>${meta.bpm}</per-minute></metronome>`,
      'above',
      `<sound tempo="${meta.bpm}"/>`,
    )
  }
  return out
}

function endingNumbers(mask: number): string {
  const passes: number[] = []
  for (let pass = 1; pass <= 8; pass += 1) if ((mask & (1 << (pass - 1))) !== 0) passes.push(pass)
  return passes.join(', ')
}

function leftBarline(meta: MeasureMetaInfo, previous: MeasureMetaInfo | undefined): string {
  const repeat = meta.repeatOpen ? '<bar-style>heavy-light</bar-style><repeat direction="forward"/>' : ''
  // An ending starts where the previous bar had a different (or no) ending.
  const ending =
    meta.repeatAlternative != null && meta.repeatAlternative !== previous?.repeatAlternative
      ? `<ending number="${endingNumbers(meta.repeatAlternative)}" type="start"/>`
      : ''
  return repeat || ending ? `<barline location="left">${repeat}${ending}</barline>` : ''
}

function rightBarline(meta: MeasureMetaInfo, next: MeasureMetaInfo | undefined): string {
  const repeat =
    meta.repeatClose != null && meta.repeatClose > 0
      ? `<bar-style>light-heavy</bar-style><repeat direction="backward" times="${meta.repeatClose + 1}"/>`
      : ''
  const endsHere = meta.repeatAlternative != null && next?.repeatAlternative !== meta.repeatAlternative
  const ending = endsHere
    ? `<ending number="${endingNumbers(meta.repeatAlternative!)}" type="${repeat ? 'stop' : 'discontinue'}"/>`
    : ''
  return repeat || ending ? `<barline location="right">${repeat}${ending}</barline>` : ''
}

// ---------------------------------------------------------------------------
// Notes

interface BeatContext {
  track: Track
  drums: boolean
  voice: number
  /** The beats around this one in the same voice (possibly in the neighbouring bar), for ties, slides and hammer-ons. */
  previous: Beat | undefined
  next: Beat | undefined
}

function midiOf(note: Note, string: number, context: BeatContext): number {
  if (context.drums) return note.fret
  return context.track.strings[string] + note.fret + Math.max(0, context.track.capo)
}

function timeModification(beat: Beat): string {
  const normal = beat.tuplet != null && beat.tuplet > 1 ? tupletNormalNotes(beat.tuplet) : 0
  return normal > 0
    ? `<time-modification><actual-notes>${beat.tuplet}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`
    : ''
}

function dots(beat: Beat): string {
  if (beat.doubleDotted) return '<dot/><dot/>'
  return beat.dotted ? '<dot/>' : ''
}

function legatoKind(from: Note, to: Note): 'hammer-on' | 'pull-off' {
  return to.fret < from.fret ? 'pull-off' : 'hammer-on'
}

function technicalXml(
  note: Note,
  string: number,
  context: BeatContext,
  nextNote: Note | null,
  previousNote: Note | null,
): string {
  const technical: string[] = []
  if (!context.drums) {
    // MusicXML strings count from the highest (1); the app's index 0 is the lowest.
    technical.push(`<string>${context.track.strings.length - string}</string><fret>${note.fret}</fret>`)
  }
  if (previousNote?.pullDown && !note.tied) technical.push(`<${legatoKind(previousNote, note)} type="stop"/>`)
  if (note.pullDown && nextNote != null && !nextNote.tied) {
    const kind = legatoKind(note, nextNote)
    technical.push(`<${kind} type="start">${kind === 'pull-off' ? 'P' : 'H'}</${kind}>`)
  }
  if (note.artificialStyle)
    technical.push(`<harmonic>${HARMONICS[note.artificialStyle] ?? '<natural/>'}</harmonic>`)
  if (note.tap) technical.push('<tap/>')
  // Bend values use 100 per whole tone (50 per semitone), as in Guitar Pro.
  const peak = Math.max(0, ...(note.bendObj ?? []).map((point) => point.bendValue))
  if (peak > 0) technical.push(`<bend><bend-alter>${Math.round((peak / 50) * 2) / 2}</bend-alter></bend>`)
  return technical.length > 0 ? `<technical>${technical.join('')}</technical>` : ''
}

function articulationsXml(note: Note): string {
  const marks = [
    note.accentuated ? '<accent/>' : '',
    note.heavyAccentuated ? '<strong-accent type="up"/>' : '',
    note.stacatto ? '<staccato/>' : '',
  ].join('')
  return marks ? `<articulations>${marks}</articulations>` : ''
}

function ornamentsXml(note: Note): string {
  const tremolo = note.tremoloPicking ? TREMOLO_MARKS[note.tremoloPickingLength] : undefined
  const marks = `${note.trill ? '<trill-mark/>' : ''}${tremolo ? `<tremolo type="single">${tremolo}</tremolo>` : ''}`
  return marks ? `<ornaments>${marks}</ornaments>` : ''
}

function noteNotations(
  note: Note,
  string: number,
  beat: Beat,
  context: BeatContext,
  tieStart: boolean,
): string {
  const nextNote = noteOf(context.next, string)
  const previousNote = noteOf(context.previous, string)
  const stroke = beat.effects?.stroke
  const parts = [
    note.tied ? '<tied type="stop"/>' : '',
    tieStart ? '<tied type="start"/>' : '',
    previousNote?.slide ? '<slide type="stop"/>' : '',
    note.slide && nextNote != null ? '<slide type="start" line-type="solid"/>' : '',
    // A down stroke sweeps from the low string up, which MusicXML calls an upward arpeggio.
    stroke ? `<arpeggiate direction="${stroke.strokeType === 'up' ? 'down' : 'up'}"/>` : '',
    ornamentsXml(note),
    technicalXml(note, string, context, nextNote, previousNote),
    articulationsXml(note),
  ].join('')
  return parts ? `<notations>${parts}</notations>` : ''
}

function graceNoteXml(note: Note, string: number, context: BeatContext, chord: boolean): string {
  const grace = note.graceObj!
  const type = NOTE_TYPES[grace.duration]?.type ?? '16th'
  const midi = context.drums
    ? grace.fret
    : context.track.strings[string] + grace.fret + Math.max(0, context.track.capo)
  const technical = context.drums
    ? ''
    : `<notations><technical><string>${context.track.strings.length - string}</string><fret>${grace.fret}</fret></technical></notations>`
  return (
    `<note><grace${grace.setOnBeat === 'with' ? '' : ' slash="yes"'}/>${chord ? '<chord/>' : ''}${pitchXml(midi)}` +
    `<voice>${context.voice}</voice><type>${type}</type>${grace.dead ? '<notehead>x</notehead>' : ''}${technical}</note>`
  )
}

function noteheadXml(note: Note): string {
  if (note.dead) return '<notehead>x</notehead>'
  if (note.ghost) return '<notehead parentheses="yes">normal</notehead>'
  return ''
}

function beatXml(beat: Beat, context: BeatContext): string {
  const duration = beatDivisions(beat)
  const type = NOTE_TYPES[baseDuration(beat)]?.type ?? 'quarter'
  const tail = `<voice>${context.voice}</voice><type>${type}</type>${dots(beat)}${timeModification(beat)}`
  if (isRest(beat)) {
    return `<note><rest/><duration>${duration}</duration>${tail}</note>`
  }
  const sounding = (beat.notes ?? [])
    .map((note, string) => ({ note, string }))
    .filter((entry): entry is { note: Note; string: number } => entry.note != null)
    // Highest string first reads naturally in chords; order doesn't matter to MusicXML.
    .sort((a, b) => midiOf(b.note, b.string, context) - midiOf(a.note, a.string, context))
  const graces = sounding
    .filter((entry) => entry.note.graceObj != null)
    .map((entry, i) => graceNoteXml(entry.note, entry.string, context, i > 0))
    .join('')
  const notes = sounding
    .map(({ note, string }, i) => {
      const nextNote = noteOf(context.next, string)
      const tieStart = nextNote?.tied === true && !context.drums
      const ties = `${note.tied ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}`
      const pitch = context.drums ? unpitchedXml(note.fret) : pitchXml(midiOf(note, string, context))
      return (
        `<note>${i > 0 ? '<chord/>' : ''}${pitch}<duration>${duration}</duration>${ties}${tail}${noteheadXml(note)}` +
        `${noteNotations(note, string, beat, context, tieStart)}</note>`
      )
    })
    .join('')
  return graces + notes
}

function beatDirections(beat: Beat, previousDynamic: string | null): string {
  let out = ''
  if (beat.chord?.name) out += direction(`<words>${escapeXml(beat.chord.name)}</words>`)
  if (beat.text) out += direction(`<words>${escapeXml(beat.text)}</words>`)
  if (beat.dynamicPresent && DYNAMICS.has(beat.dynamic) && beat.dynamic !== previousDynamic) {
    out += direction(`<dynamics><${beat.dynamic}/></dynamics>`, 'below')
  }
  return out
}

/**
 * Rests that fill a voice up to the bar length. Songs can hold short bars (the editor fills them
 * on load, other sources may not); notation programs mark those as broken, so pad them here.
 */
export function fillerRests(missing: number, voice: number): string {
  let out = ''
  let left = missing
  // Longest first. (Not Object.values: the numeric key '2' would come first.)
  for (const { type, quarters } of ['w', 'h', 'q', 'e', 's', 't', 'z', 'o', '2'].map(
    (key) => NOTE_TYPES[key],
  )) {
    const size = Math.round(quarters * DIVISIONS)
    while (left >= size) {
      out += `<note><rest/><duration>${size}</duration><voice>${voice}</voice><type>${type}</type></note>`
      left -= size
    }
  }
  // Whatever doesn't fit a plain note value (leftovers of odd tuplets) is a rest without a type.
  if (left > 0) out += `<note><rest/><duration>${left}</duration><voice>${voice}</voice></note>`
  return out
}

function voiceHasNotes(beats: Beat[] | undefined): boolean {
  return (beats ?? []).some((beat) => !isRest(beat))
}

// ---------------------------------------------------------------------------

function partXml(source: MusicXmlSource, trackIndex: number): string {
  const track = source.tracks[trackIndex]
  const drums = isDrumTrack(track)
  const bars = source.measures[trackIndex] ?? []
  let lastDynamic: string | null = null
  const measures = source.measureMeta.map((meta, barIndex) => {
    const previous = source.measureMeta[barIndex - 1]
    const block = bars[barIndex] ?? []
    let body =
      leftBarline(meta, previous) +
      barAttributes(meta, previous, track, barIndex === 0) +
      barDirections(meta, trackIndex === 0)
    let written = 0
    for (let voice = 0; voice < MAX_VOICES; voice += 1) {
      const beats = block[voice] ?? []
      // The second voice is written only when it plays something.
      if (voice > 0 && !voiceHasNotes(beats)) continue
      if (voice > 0 && written > 0) body += `<backup><duration>${written}</duration></backup>`
      written = 0
      beats.forEach((beat, beatIndex) => {
        const next = beats[beatIndex + 1] ?? bars[barIndex + 1]?.[voice]?.[0]
        const prevBar = bars[barIndex - 1]?.[voice]
        const previous = beatIndex > 0 ? beats[beatIndex - 1] : prevBar?.[prevBar.length - 1]
        if (voice === 0) {
          body += beatDirections(beat, lastDynamic)
          if (beat.dynamicPresent) lastDynamic = beat.dynamic
        }
        body += beatXml(beat, { track, drums, voice: voice + 1, previous, next })
        written += beatDivisions(beat)
      })
      const barLength = Math.round((meta.numerator * 4 * DIVISIONS) / meta.denominator)
      if (written < barLength) {
        body += fillerRests(barLength - written, voice + 1)
        written = barLength
      }
    }
    body += rightBarline(meta, source.measureMeta[barIndex + 1])
    return `<measure number="${barIndex + 1}">${body}</measure>`
  })
  return `<part id="P${trackIndex + 1}">${measures.join('')}</part>`
}

/** The whole song as a MusicXML document. */
export function buildMusicXml(source: MusicXmlSource): string {
  const { description } = source
  const credits = [
    description.title ? `<work><work-title>${escapeXml(description.title)}</work-title></work>` : '',
    description.subtitle ? `<movement-title>${escapeXml(description.subtitle)}</movement-title>` : '',
  ].join('')
  const creators = [
    description.artist ? `<creator type="composer">${escapeXml(description.artist)}</creator>` : '',
    description.writer ? `<creator type="lyricist">${escapeXml(description.writer)}</creator>` : '',
    description.author ? `<creator type="arranger">${escapeXml(description.author)}</creator>` : '',
  ].join('')
  const rights = description.copyright ? `<rights>${escapeXml(description.copyright)}</rights>` : ''
  const identification =
    `<identification>${creators}${rights}<encoding><software>GuitarTab</software>` +
    `<encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>`
  const partList = `<part-list>${source.tracks.map(scorePart).join('')}</part-list>`
  const parts = source.tracks.map((_, i) => partXml(source, i)).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0">${credits}${identification}${partList}${parts}</score-partwise>\n`
  )
}

/** File name for the download, from the song title. */
export function musicXmlFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, '').trim()
  return `${base && base !== '[Title]' ? base : 'song'}.musicxml`
}
