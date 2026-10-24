import type { Beat, Chord, MeasureMetaInfo, Note, SongDescription, Track } from '../stores/song'
import { GP6_DRUM_ELEMENTS } from './gpifImport'

/**
 * Writes a song as GPIF, the XML inside Guitar Pro 6 (.gpx) and 7/8 (.gp) files, in the
 * Guitar Pro 6 layout (track settings on the track, `GeneralMidi`, drum elements).
 * It mirrors `gpifImport.ts`: everything written here reads back the same way.
 * Pure: song data in, XML text out. `gpContainers.buildGpxFile` wraps it into a .gpx.
 */

export interface GpifSource {
  description: SongDescription
  tracks: Track[]
  measureMeta: MeasureMetaInfo[]
  /** track → bar → voice → beat */
  measures: Beat[][][][]
}

const DRUM_CHANNEL = 9
const MAX_VOICES = 2
// App curves run 0–60; GPIF offsets 0–100.
const CURVE_OFFSET_SCALE = 100 / 60

const NOTE_VALUES: Record<string, string> = {
  w: 'Whole',
  h: 'Half',
  q: 'Quarter',
  e: 'Eighth',
  s: '16th',
  t: '32nd',
  z: '64th',
  o: '128th',
  2: '256th',
}
const TREMOLO_PICKING: Record<string, string> = { e: '1/8', s: '1/16', t: '1/32' }
const HARMONIC_TYPES: Record<string, string> = {
  'N.H.': 'Natural',
  'A.H.': 'Artificial',
  'P.H.': 'Pinch',
  'T.H.': 'Tap',
  'S.H.': 'Semi',
}

/** CDATA text; a literal "]]>" is split across two sections. */
function cdata(text: string): string {
  return `<![CDATA[${text.split(']]>').join(']]]]><![CDATA[>')}]]>`
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function property(name: string, body: string): string {
  return `<Property name="${name}">${body}</Property>`
}

const enable = (name: string) => property(name, '<Enable/>')
const float = (name: string, value: number) =>
  property(name, `<Float>${Math.round(value * 100) / 100}</Float>`)

function isDrumTrack(track: Track): boolean {
  return track.channel?.index === DRUM_CHANNEL || track.primaryChannel === DRUM_CHANNEL
}

function isRest(beat: Beat): boolean {
  return beat.duration.endsWith('r') || !(beat.notes ?? []).some((note) => note != null)
}

function baseDuration(beat: { duration: string }): string {
  return beat.duration.replace(/r+$/, '')
}

// ---------------------------------------------------------------------------
// Curves (bends, whammy bar) as GPIF origin / middle / destination points

interface CurvePoint {
  position: number
  value: number
}

/**
 * GPIF describes a curve by up to three values. Origin is the first point, destination the
 * last; an extreme in between (a dip or a bend and release) becomes the middle point.
 */
function curveProperties(prefix: string, points: CurvePoint[]): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  const rest = points.slice(1)
  const extreme = rest.reduce(
    (best, point) =>
      Math.abs(point.value - first.value) > Math.abs(best.value - first.value) ? point : best,
    rest[0] ?? first,
  )
  let out = float(`${prefix}OriginValue`, first.value)
  let destinationFrom = 0
  if (extreme.value !== last.value) {
    out +=
      float(`${prefix}MiddleValue`, extreme.value) +
      float(`${prefix}MiddleOffset1`, extreme.position * CURVE_OFFSET_SCALE)
    destinationFrom = points.indexOf(extreme)
  }
  const reached = points.slice(destinationFrom + 1).find((point) => point.value === last.value) ?? last
  out +=
    float(`${prefix}DestinationValue`, last.value) +
    float(`${prefix}DestinationOffset`, reached.position * CURVE_OFFSET_SCALE)
  return out
}

// ---------------------------------------------------------------------------

/** Collects GPIF entities in flat, id-referenced lists, as the format stores them. */
class GpifBuilder {
  bars: string[] = []
  voices: string[] = []
  beats: string[] = []
  notes: string[] = []
  rhythms: string[] = []
  private rhythmIds = new Map<string, number>()

  rhythm(duration: string, dots: number, tuplet: number | null): number {
    const key = `${duration}:${dots}:${tuplet ?? ''}`
    const known = this.rhythmIds.get(key)
    if (known != null) return known
    const id = this.rhythms.length
    const normal =
      tuplet === 3
        ? 2
        : tuplet != null && tuplet >= 5 && tuplet <= 7
          ? 4
          : tuplet != null && tuplet >= 9
            ? 8
            : 0
    this.rhythms.push(
      `<Rhythm id="${id}"><NoteValue>${NOTE_VALUES[duration] ?? 'Quarter'}</NoteValue>` +
        `${dots > 0 ? `<AugmentationDot count="${dots}"/>` : ''}` +
        `${tuplet != null && normal > 0 ? `<PrimaryTuplet num="${tuplet}" den="${normal}"/>` : ''}</Rhythm>`,
    )
    this.rhythmIds.set(key, id)
    return id
  }

  add(list: 'notes' | 'beats' | 'voices' | 'bars', render: (id: number) => string): number {
    const id = this[list].length
    this[list].push(render(id))
    return id
  }
}

interface NoteContext {
  track: Track
  drums: boolean
  /** The same string in the neighbouring beats of this voice, for ties and hammer-ons. */
  previous: Note | null
  next: Note | null
}

function drumProperties(midi: number): string {
  for (const [element, variations] of Object.entries(GP6_DRUM_ELEMENTS)) {
    const variation = variations.indexOf(midi)
    if (variation >= 0) {
      return (
        property('Element', `<Element>${element}</Element>`) +
        property('Variation', `<Variation>${variation}</Variation>`)
      )
    }
  }
  return property('Midi', `<Number>${midi}</Number>`)
}

function noteProperties(note: Note, string: number, context: NoteContext): string {
  const { drums, previous, next } = context
  const harmonic = note.artificialStyle ? HARMONIC_TYPES[note.artificialStyle] : undefined
  const bend = note.bendObj ?? []
  return [
    drums
      ? drumProperties(note.fret)
      : property('String', `<String>${string}</String>`) + property('Fret', `<Fret>${note.fret}</Fret>`),
    note.dead ? enable('Muted') : '',
    note.palmMute ? enable('PalmMuted') : '',
    note.tap ? enable('Tapped') : '',
    note.slide ? property('Slide', '<Flags>1</Flags>') : '',
    note.pullDown && next != null ? enable('HopoOrigin') : '',
    previous?.pullDown ? enable('HopoDestination') : '',
    harmonic
      ? property('HarmonicType', `<HType>${harmonic}</HType>`) +
        property('HarmonicFret', `<HFret>${note.fret}</HFret>`)
      : '',
    bend.length > 0
      ? enable('Bended') +
        curveProperties(
          'Bend',
          bend.map((point) => ({ position: point.bendPosition, value: point.bendValue })),
        )
      : '',
  ].join('')
}

function noteXml(id: number, note: Note, string: number, context: NoteContext): string {
  const { track, drums, next } = context
  const tieOrigin = next?.tied === true
  const ties = note.tied || tieOrigin ? `<Tie origin="${tieOrigin}" destination="${note.tied}"/>` : ''
  const accent = (note.stacatto ? 1 : 0) | (note.heavyAccentuated ? 4 : 0) | (note.accentuated ? 8 : 0)
  const trill =
    note.trill && !drums
      ? `<Trill>${track.strings[string] + Math.max(0, track.capo) + note.trill.fret}</Trill>`
      : ''
  return (
    `<Note id="${id}">${ties}${note.letRing ? '<LetRing/>' : ''}${note.vibrato ? '<Vibrato>Slight</Vibrato>' : ''}` +
    `${note.ghost ? '<AntiAccent>Normal</AntiAccent>' : ''}${accent ? `<Accent>${accent}</Accent>` : ''}${trill}` +
    `<Properties>${noteProperties(note, string, context)}</Properties></Note>`
  )
}

interface BeatContext {
  builder: GpifBuilder
  track: Track
  drums: boolean
  chordIds: Map<string, number>
}

function beatProperties(beat: Beat): string {
  const effects = beat.effects
  if (!effects) return ''
  const props = [
    effects.stroke
      ? property('Brush', `<Direction>${effects.stroke.strokeType === 'up' ? 'Up' : 'Down'}</Direction>`)
      : '',
    effects.slap ? enable('Slapped') : '',
    effects.pop ? enable('Popped') : '',
    effects.tremoloBar && effects.tremoloBar.length > 0
      ? enable('WhammyBar') + curveProperties('WhammyBar', effects.tremoloBar)
      : '',
  ].join('')
  return props ? `<Properties>${props}</Properties>` : ''
}

/** A grace-note beat for the notes of `beat` that have one (GPIF stores graces as their own beat). */
function graceBeat(beat: Beat, context: BeatContext): number | null {
  const graces = (beat.notes ?? []).flatMap((note, string) => (note?.graceObj ? [{ note, string }] : []))
  if (graces.length === 0) return null
  const { builder } = context
  const duration = graces[0].note.graceObj!.duration || 's'
  const noteIds = graces.map(({ note, string }) =>
    builder.add('notes', (id) =>
      noteXml(
        id,
        {
          ...note,
          fret: note.graceObj!.fret,
          dead: note.graceObj!.dead,
          tied: false,
          bendObj: undefined,
          trill: undefined,
          pullDown: false,
          slide: false,
          vibrato: false,
          letRing: false,
        },
        string,
        { track: context.track, drums: context.drums, previous: null, next: null },
      ),
    ),
  )
  const rhythm = builder.rhythm(duration, 0, null)
  const when = graces[0].note.graceObj!.setOnBeat === 'with' ? 'OnBeat' : 'BeforeBeat'
  return builder.add(
    'beats',
    (id) =>
      `<Beat id="${id}"><GraceNotes>${when}</GraceNotes><Dynamic>${(beat.dynamic || 'mf').toUpperCase()}</Dynamic>` +
      `<Rhythm ref="${rhythm}"/><Notes>${noteIds.join(' ')}</Notes></Beat>`,
  )
}

function voiceXml(
  beats: Beat[],
  neighbours: { before: Beat | undefined; after: Beat | undefined },
  context: BeatContext,
): number {
  const { builder, track, drums } = context
  const beatIds: number[] = []
  beats.forEach((beat, index) => {
    const previous = index > 0 ? beats[index - 1] : neighbours.before
    const next = index < beats.length - 1 ? beats[index + 1] : neighbours.after
    const grace = graceBeat(beat, context)
    if (grace != null) beatIds.push(grace)
    const rest = isRest(beat)
    const tremolo = (beat.notes ?? []).find((note) => note?.tremoloPicking)?.tremoloPickingLength
    const noteIds = rest
      ? []
      : (beat.notes ?? []).flatMap((note, string) =>
          note == null
            ? []
            : [
                builder.add('notes', (id) =>
                  noteXml(id, note, string, {
                    track,
                    drums,
                    previous: previous?.notes?.[string] ?? null,
                    next: next?.notes?.[string] ?? null,
                  }),
                ),
              ],
        )
    const rhythm = builder.rhythm(
      baseDuration(beat),
      beat.doubleDotted ? 2 : beat.dotted ? 1 : 0,
      beat.tuplet != null && beat.tuplet > 1 ? beat.tuplet : null,
    )
    const chordId = beat.chord ? context.chordIds.get(beat.chord.name) : undefined
    beatIds.push(
      builder.add(
        'beats',
        (id) =>
          `<Beat id="${id}">` +
          `<Dynamic>${(beat.dynamic || 'mf').toUpperCase()}</Dynamic>` +
          `${chordId != null ? `<Chord>${chordId}</Chord>` : ''}` +
          `${beat.text ? `<FreeText>${cdata(beat.text)}</FreeText>` : ''}` +
          `${tremolo && TREMOLO_PICKING[tremolo] ? `<Tremolo>${TREMOLO_PICKING[tremolo]}</Tremolo>` : ''}` +
          `${beat.effects?.fadeIn ? '<Fadding>FadeIn</Fadding>' : ''}` +
          `<Rhythm ref="${rhythm}"/>${noteIds.length > 0 ? `<Notes>${noteIds.join(' ')}</Notes>` : ''}` +
          `${beatProperties(beat)}</Beat>`,
      ),
    )
  })
  return builder.add('voices', (id) => `<Voice id="${id}"><Beats>${beatIds.join(' ')}</Beats></Voice>`)
}

// ---------------------------------------------------------------------------
// Tracks and bars

function trackChords(measures: Beat[][][]): Chord[] {
  const byName = new Map<string, Chord>()
  for (const block of measures)
    for (const voice of block)
      for (const beat of voice) {
        if (beat.chord?.name && !byName.has(beat.chord.name)) byName.set(beat.chord.name, beat.chord)
      }
  return [...byName.values()]
}

/** Chord frets are stored highest string first; GPIF numbers diagram strings from the lowest. */
function diagramXml(chord: Chord, id: number, stringCount: number): string {
  const frets = chord.frets.slice(0, stringCount)
  const played = frets.filter((fret) => fret > 0)
  const baseFret = played.length > 0 && Math.max(...played) > 5 ? Math.min(...played) - 1 : 0
  const fretXml = frets
    .map((fret, index) =>
      fret < 0 ? '' : `<Fret string="${stringCount - 1 - index}" fret="${fret - baseFret}"/>`,
    )
    .join('')
  return `<Item id="${id}" name="${escapeAttribute(chord.name)}"><Diagram stringCount="${stringCount}" fretCount="5" baseFret="${baseFret}">${fretXml}</Diagram></Item>`
}

/** Guitar Pro 6 instrument presets; Guitar Pro falls back to the MIDI program for the sound. */
function instrumentRef(track: Track): string {
  if (isDrumTrack(track)) return 'drumkit'
  const strings = track.strings.length
  if (track.program >= 32 && track.program <= 39) return `e-bass${strings}`
  if (track.program === 24) return `n-gtr${strings}`
  if (track.program === 25) return `s-gtr${strings}`
  return `e-gtr${strings}`
}

function trackXml(track: Track, id: number, chords: Chord[]): string {
  const drums = isDrumTrack(track)
  const channel = drums ? DRUM_CHANNEL : Math.max(0, track.channel?.index ?? track.primaryChannel ?? 0)
  const r = track.color?.red ?? 220
  const g = track.color?.green ?? 60
  const b = track.color?.blue ?? 60
  const diagrams =
    chords.length > 0
      ? property(
          'DiagramCollection',
          `<Items>${chords.map((chord, index) => diagramXml(chord, index, track.strings.length)).join('')}</Items>`,
        )
      : ''
  const tuning = drums ? '' : property('Tuning', `<Pitches>${track.strings.join(' ')}</Pitches>`)
  return (
    `<Track id="${id}"><Name>${cdata(track.name)}</Name><ShortName>${cdata(track.name.slice(0, 8))}</ShortName>` +
    `<Color>${r} ${g} ${b}</Color><Instrument ref="${instrumentRef(track)}"/>` +
    `<GeneralMidi table="Instrument"><Program>${Math.max(0, track.program)}</Program><Port>0</Port>` +
    `<PrimaryChannel>${channel}</PrimaryChannel><SecondaryChannel>${drums ? DRUM_CHANNEL : channel}</SecondaryChannel>` +
    '<ForeOneChannelPerString>false</ForeOneChannelPerString></GeneralMidi>' +
    `<Properties>${tuning}${property('CapoFret', `<Fret>${Math.max(0, track.capo)}</Fret>`)}${diagrams}</Properties></Track>`
  )
}

function clefOf(track: Track): string {
  if (isDrumTrack(track)) return 'Neutral'
  return Math.min(...track.strings) < 36 ? 'F4' : 'G2'
}

function endings(mask: number): string {
  const passes: number[] = []
  for (let pass = 1; pass <= 8; pass += 1) if ((mask & (1 << (pass - 1))) !== 0) passes.push(pass)
  return passes.join(' ')
}

function masterBarXml(meta: MeasureMetaInfo, barIds: number[]): string {
  const repeatEnd = meta.repeatClose != null && meta.repeatClose > 0
  const repeat =
    meta.repeatOpen || repeatEnd
      ? `<Repeat start="${meta.repeatOpen}" end="${repeatEnd}" count="${repeatEnd ? meta.repeatClose! + 1 : 0}"/>`
      : ''
  const alternate = meta.repeatAlternative
    ? `<AlternateEndings>${endings(meta.repeatAlternative)}</AlternateEndings>`
    : ''
  const section = meta.marker?.text
    ? `<Section><Letter>${cdata('')}</Letter><Text>${cdata(meta.marker.text)}</Text></Section>`
    : ''
  return (
    `<MasterBar><Key><AccidentalCount>0</AccidentalCount><Mode>Major</Mode></Key>` +
    `<Time>${meta.numerator}/${meta.denominator}</Time>${repeat}${alternate}${section}<Bars>${barIds.join(' ')}</Bars></MasterBar>`
  )
}

function tempoAutomations(measureMeta: MeasureMetaInfo[]): string {
  return measureMeta
    .flatMap((meta, bar) =>
      meta.bpm != null && meta.bpm > 0
        ? [
            `<Automation><Type>Tempo</Type><Linear>false</Linear><Bar>${bar}</Bar><Position>0</Position>` +
              `<Visible>true</Visible><Value>${meta.bpm} 2</Value></Automation>`,
          ]
        : [],
    )
    .join('')
}

function voiceHasNotes(beats: Beat[] | undefined): boolean {
  return (beats ?? []).some((beat) => !isRest(beat))
}

/** The song as GPIF XML. */
export function buildGpif(source: GpifSource): string {
  const { description, tracks, measureMeta, measures } = source
  const builder = new GpifBuilder()
  const chordsPerTrack = tracks.map((_, trackId) => trackChords(measures[trackId] ?? []))
  const barIdsPerMasterBar: number[][] = measureMeta.map(() => [])

  tracks.forEach((track, trackId) => {
    const drums = isDrumTrack(track)
    const chordIds = new Map(chordsPerTrack[trackId].map((chord, index) => [chord.name, index]))
    const context: BeatContext = { builder, track, drums, chordIds }
    const blocks = measures[trackId] ?? []
    measureMeta.forEach((_, barIndex) => {
      const block = blocks[barIndex] ?? []
      const voiceIds: number[] = []
      for (let voice = 0; voice < MAX_VOICES; voice += 1) {
        const beats = block[voice] ?? []
        if (voice > 0 && !voiceHasNotes(beats)) continue
        const before = blocks[barIndex - 1]?.[voice]
        voiceIds.push(
          voiceXml(
            beats,
            { before: before?.[before.length - 1], after: blocks[barIndex + 1]?.[voice]?.[0] },
            context,
          ),
        )
      }
      const voices = [...voiceIds, -1, -1, -1, -1].slice(0, 4)
      barIdsPerMasterBar[barIndex].push(
        builder.add(
          'bars',
          (id) => `<Bar id="${id}"><Clef>${clefOf(track)}</Clef><Voices>${voices.join(' ')}</Voices></Bar>`,
        ),
      )
    })
  })

  const score =
    `<Score><Title>${cdata(description.title)}</Title><SubTitle>${cdata(description.subtitle)}</SubTitle>` +
    `<Artist>${cdata(description.artist)}</Artist><Album>${cdata(description.album)}</Album>` +
    `<Words>${cdata(description.writer)}</Words><Music>${cdata(description.music)}</Music>` +
    `<WordsAndMusic>${cdata(description.wordsAndMusic)}</WordsAndMusic><Copyright>${cdata(description.copyright)}</Copyright>` +
    `<Tabber>${cdata(description.author)}</Tabber><Instructions>${cdata(description.instructions)}</Instructions>` +
    `<Notices>${cdata((description.comments ?? []).join('\n'))}</Notices></Score>`
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    `<GPIF><GPVersion>6.0</GPVersion><GPRevision required="6000" recommended="6000">6000</GPRevision>${score}` +
    `<MasterTrack><Tracks>${tracks.map((_, i) => i).join(' ')}</Tracks><Automations>${tempoAutomations(measureMeta)}</Automations></MasterTrack>` +
    `<Tracks>${tracks.map((track, i) => trackXml(track, i, chordsPerTrack[i])).join('')}</Tracks>` +
    `<MasterBars>${measureMeta.map((meta, i) => masterBarXml(meta, barIdsPerMasterBar[i])).join('')}</MasterBars>` +
    `<Bars>${builder.bars.join('')}</Bars><Voices>${builder.voices.join('')}</Voices>` +
    `<Beats>${builder.beats.join('')}</Beats><Notes>${builder.notes.join('')}</Notes>` +
    `<Rhythms>${builder.rhythms.join('')}</Rhythms></GPIF>\n`
  )
}
