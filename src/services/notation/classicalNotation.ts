import Vex, { type IRenderContext } from 'vexflow'
import { toRaw } from 'vue'
import Song, { type Beat, type Note } from '../../stores/song'
import {
  getClassicalRowGeometry,
  publishClassicalLayoutMetrics,
  setClassicalBeatWidth,
  type ClassicalStaffExtents,
} from '../../stores/classicalNotationLayoutState'
import { selectionState } from '../../stores/selectionState'
import Settings from '../../stores/settingsState'
import { tabLayout } from '../../stores/tabLayoutState'
import {
  beatNoteOffset,
  getMeasureBeatNoteX,
  getMeasureBeatWidth,
  getMeasureBeatX,
} from '../../utils/measureBeatLayout'
import { otherVoiceBeatXs } from '../../utils/otherVoiceNotes'
import { scrollToSvgBlock } from '../editor/navigationController'
import renderBridge from '../editor/renderBridge'
import { CLASSICAL_CLEF_GUTTER } from '../editor/tabLayoutMetrics'
import playback from '../playback'
import { keyChanges, keyFifths, vexFlowKey } from '../../utils/keySignature'
import { BarAccidentals, spellPitch, vexFlowKeyOf, type SpelledPitch } from '../../utils/pitchSpelling'
import { clefChangesAt, vexFlowClef } from '../../utils/clefs'
import { hiddenBars, multiRestRuns } from '../../utils/multiRests'
import {
  blockFingerprint,
  clefOf,
  durationToVexFlow,
  isDrumTrack,
  largestBeatWidth,
  otherVoiceOf,
  staffExtents,
  voiceHasNotes,
} from './vexflowNotes'

/**
 * Classical notation (VexFlow, loaded lazily through `classicalNotationAdapter`): converts
 * the shown track into VexFlow notes per bar (cached by a fingerprint of the bar), publishes
 * the layout metrics the tab spacing and row heights use, and draws one row of staff into
 * its surface, note heads centred on the tab digits.
 */

/** VexFlow places a stave's top line this far below the stave's y (4 spaces). */
const STAVE_SPACE_ABOVE_TOP_LINE = 40
/** Width of the clef-only stave segment that opens every row (inside the gutter). */
const CLEF_STAVE_WIDTH = 40

const GRACE_DURATIONS: Record<string, string> = { t: '32', s: '16', e: '8' }

/**
 * VexFlow 4 attaches dots as modifiers. (`@types/vexflow` describes VexFlow 1.2, whose
 * `addDotToAll` is gone; calling it made every dotted note throw.)
 */
const Dot = Vex.Flow.Dot as unknown as {
  buildAndAttach(notes: Vex.Flow.StaveNote[], options: { all: boolean }): void
}

interface ConvertedBeat {
  note: Vex.Flow.StaveNote
  /** per key: tied to the beat before */
  tied: boolean[]
  /** per key: the string it is on (-1 for notes off the strings) */
  strings: number[]
  measure: Beat
}

class ClassicalNotation {
  /** per bar: its beats as VexFlow notes with tie data */
  allNotes: ConvertedBeat[][] = []

  /** per bar: the VexFlow notes alone */
  allVoices: Vex.Flow.StaveNote[][] = []

  /** per bar: the voice that isn't edited, when it has notes there (drawn on the same staff) */
  otherVoices: (Vex.Flow.StaveNote[] | null)[] = []

  /** Per-block content fingerprint of the last conversion. */
  blockFingerprints: string[] = []

  /** Per-block largest beat width from the last conversion. */
  blockBeatWidths: number[] = []

  /** Track/voice/tuning the cached conversions belong to. */
  conversionScope = ''

  toggleClassicalVisibility(): void {
    Settings.vexFlowIsActive = !Settings.vexFlowIsActive
    const blockId = Settings.songPlaying ? playback.playingBlock : selectionState.cursor.blockId
    scrollToSvgBlock(Song.currentTrackId, Song.currentVoiceId, blockId)
  }

  /**
   * Publishes layout metrics derived from the notation data only: per-block beat widths (tab
   * spacing) and the track's staff extents (row height). Returns whether anything changed.
   */
  syncLayoutMetrics(): boolean {
    const numBlocks = Song.measures[Song.currentTrackId]?.length ?? 0
    const beatWidthByBlock: Record<number, number> = {}
    const staffExtentsByBlock: Record<number, ClassicalStaffExtents> = {}
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      const notes = this.allVoices[blockId]
      // computed during conversion; formatting every block again is costly
      if (notes != null && notes.length > 0) {
        beatWidthByBlock[blockId] = this.blockBeatWidths[blockId] ?? largestBeatWidth(blockId, notes)
      }
      staffExtentsByBlock[blockId] = staffExtents([notes ?? [], this.otherVoices[blockId] ?? []])
    }
    return publishClassicalLayoutMetrics({ beatWidthByBlock, staffExtentsByBlock })
  }

  /**
   * Converts the whole track. Conversion is the costly part (StaveNote construction), so
   * blocks whose fingerprint is unchanged keep their notes.
   */
  computeVexFlowDataStructures(trackId: number, voiceId: number): void {
    const track = Song.tracks[trackId]
    const scope = JSON.stringify([
      trackId,
      voiceId,
      toRaw(track.strings),
      track.numStrings,
      isDrumTrack(trackId),
    ])
    if (scope !== this.conversionScope) {
      this.conversionScope = scope
      this.blockFingerprints = []
      this.blockBeatWidths = []
    }
    const numBlocks = Song.measures[trackId].length
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      const fingerprint = blockFingerprint(trackId, blockId, voiceId)
      if (
        fingerprint != null &&
        fingerprint === this.blockFingerprints[blockId] &&
        this.allVoices[blockId] != null
      ) {
        continue
      }
      this.convertBlockToNotation(trackId, blockId, voiceId)
      this.blockFingerprints[blockId] = fingerprint ?? ''
    }
    this.allNotes.length = numBlocks
    this.allVoices.length = numBlocks
    this.otherVoices.length = numBlocks
    this.blockFingerprints.length = numBlocks
    this.blockBeatWidths.length = numBlocks
  }

  /** Re-convert one block after an edit; drawing is scheduled by the adapter. */
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void {
    this.convertBlockToNotation(trackId, blockId, voiceId)
  }

  calculateLargestBeatWidth(_trackId: number, blockId: number, _voiceId: number): number {
    return largestBeatWidth(blockId, this.allVoices[blockId])
  }

  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void {
    const otherBeats = Song.measures[trackId][blockId][otherVoiceOf(voiceId)]
    const twoVoices = voiceHasNotes(otherBeats)
    const fifths = drumsOrKey(trackId, blockId)
    // With two voices on one staff, voice 1 has its stems up and voice 2 down.
    const accidentals = new BarAccidentals(fifths)
    const clef = vexFlowClef(clefOf(trackId, blockId)).name
    const converted = Song.measures[trackId][blockId][voiceId].map((beat) =>
      convertBeat(trackId, beat, accidentals, fifths, clef, twoVoices ? stemOf(voiceId) : undefined),
    )
    this.allNotes[blockId] = converted
    this.allVoices[blockId] = converted.map((entry) => entry.note)
    const otherAccidentals = new BarAccidentals(fifths)
    this.otherVoices[blockId] = twoVoices
      ? otherBeats.map(
          (beat) =>
            convertBeat(trackId, beat, otherAccidentals, fifths, clef, stemOf(otherVoiceOf(voiceId))).note,
        )
      : null
    this.blockBeatWidths[blockId] = largestBeatWidth(blockId, this.allVoices[blockId])
    setClassicalBeatWidth(blockId, this.blockBeatWidths[blockId])
  }

  /**
   * Draws one classical row into its surface. The surface spans the row's tab width plus
   * `CLASSICAL_CLEF_GUTTER` on the left, and the classical area height. Rows are
   * self-contained (no shared state between rows), so any subset can be drawn in any order.
   */
  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement): void {
    vexFlowArea?.replaceChildren()
    const rowBlocks = this.rowBlockRange(trackId, voiceId, rowId)
    if (!rowBlocks || this.allVoices.length === 0) return

    const { start, end } = rowBlocks
    let rowRight = 0
    for (let blockId = start; blockId < end; blockId += 1) {
      rowRight = Math.max(
        rowRight,
        measureX(trackId, voiceId, blockId, rowRight) + measureWidth(trackId, voiceId, blockId),
      )
    }

    const { height, staffTop } = getClassicalRowGeometry(start, end)
    const renderer = new Vex.Flow.Renderer(vexFlowArea, Vex.Flow.Renderer.Backends.SVG)
    renderer.resize(CLASSICAL_CLEF_GUTTER + Math.max(rowRight, 100), height)
    const context = renderer.getContext()
    context.setFont('Arial', 10).setBackgroundFillStyle('#eed')

    const staveY = staffTop - STAVE_SPACE_ABOVE_TOP_LINE
    const firstX = measureX(trackId, voiceId, start, 0)
    const clefStave = new Vex.Flow.Stave(
      CLASSICAL_CLEF_GUTTER + firstX - CLEF_STAVE_WIDTH,
      staveY,
      CLEF_STAVE_WIDTH,
    )
    const rowClef = vexFlowClef(clefOf(trackId, start))
    clefStave.addClef(rowClef.name, 'default', rowClef.annotation)
    clefStave.setEndBarType(Vex.Flow.Barline.type.NONE)
    clefStave.setContext(context).draw()

    const multiRests = Settings.multiBarRests
      ? multiRestRuns(Song.measures[trackId], Song.measureMeta, Song.tracks[trackId], isDrumTrack(trackId))
      : new Map<number, number>()
    const hidden = hiddenBars(multiRests)
    let fallbackX = firstX
    for (let blockId = start; blockId < end; blockId += 1) {
      // bars inside a multi-bar rest take no room in the tab layout
      if (hidden.has(blockId)) continue
      const xPos = measureX(trackId, voiceId, blockId, fallbackX)
      const width = measureWidth(trackId, voiceId, blockId)
      const rest = multiRests.get(blockId)
      this.drawStave(trackId, voiceId, blockId, xPos, staveY, width, blockId === start, context, rest)
      fallbackX = xPos + width
    }
    this.drawTies(trackId, voiceId, rowId, context)
  }

  private rowBlockRange(
    trackId: number,
    voiceId: number,
    rowId: number,
  ): { start: number; end: number } | null {
    const layout = renderBridge.getTrackLayout(trackId, voiceId)
    if (layout) {
      const blockIds = layout.blockLayouts
        .map((blockLayout, blockId) => ({ blockId, rowId: blockLayout.rowId }))
        .filter((entry) => entry.rowId === rowId)
        .map((entry) => entry.blockId)
        .sort((left, right) => left - right)
      if (blockIds.length > 0) return { start: blockIds[0], end: blockIds[blockIds.length - 1] + 1 }
    }
    return tabLayout.blocksPerRow[trackId]?.[voiceId]?.[rowId] ?? null
  }

  /**
   * Draws one measure. Note heads are centred on the tab digit centres
   * (`getMeasureBeatNoteX`, as `TabNote` renders them) so both systems align.
   */
  private drawStave(
    trackId: number,
    voiceId: number,
    blockId: number,
    xPos: number,
    yPos: number,
    width: number,
    isFirstInRow: boolean,
    context: IRenderContext,
    multiRest?: number,
  ): void {
    const notes = this.allVoices[blockId] ?? []
    const meta = Song.measureMeta[blockId]
    const stave = new Vex.Flow.Stave(CLASSICAL_CLEF_GUTTER + xPos, yPos, width)
    // a clef change inside the row (the row's clef sits in the gutter); room: keySignatureRoom
    if (!isFirstInRow && clefChangesAt(Song.tracks[trackId], blockId, isDrumTrack(trackId))) {
      const clef = vexFlowClef(clefOf(trackId, blockId))
      stave.addClef(clef.name, 'small', clef.annotation)
    }
    this.addKeySignature(trackId, blockId, isFirstInRow, stave)
    if (meta.repeatOpen) stave.setBegBarType(Vex.Flow.Barline.type.REPEAT_BEGIN)
    if (meta.repeatClose != null) stave.setEndBarType(Vex.Flow.Barline.type.REPEAT_END)
    // The clef segment already opened the system; avoid a barline right after it.
    if (isFirstInRow && !meta.repeatOpen) stave.setBegBarType(Vex.Flow.Barline.type.NONE)
    stave.setContext(context).draw()
    if (multiRest != null) {
      drawMultiRest(multiRest, stave, context)
      return
    }
    if (notes.length === 0) return

    const voice = new Vex.Flow.Voice({ num_beats: meta.numerator, beat_value: meta.denominator })
    voice.setStrict(false)
    voice.addTickables(notes)
    const other = this.otherVoices[blockId]
    // Beams first, so beamed notes do not also draw flags (and keep the voice's stem direction).
    const beams = Vex.Flow.Beam.generateBeams(notes, { maintain_stem_directions: other != null } as object)
    new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 0)
    // Voice.setStave does not reach the notes; their absolute X needs the stave.
    voice.setStave(stave)
    notes.forEach((note) => note.setStave(stave))

    const beats = Song.measures[trackId][blockId][voiceId]
    notes.forEach((note, beatId) => {
      const target =
        CLASSICAL_CLEF_GUTTER + xPos + getMeasureBeatNoteX(trackId, voiceId, blockId, beatId, beats)
      const current = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2
      const tickContext = note.getTickContext()
      tickContext.setX(tickContext.getX() + target - current)
    })

    beams.forEach((beam: Vex.Flow.Beam) => beam.postFormat())
    voice.draw(context, stave)
    beams.forEach((beam: Vex.Flow.Beam) => beam.setContext(context).draw())
    if (other != null) this.drawOtherVoice(trackId, voiceId, blockId, xPos, stave, other, context)
  }

  /**
   * The key signature at the start of a row, of the song and where it changes (with naturals
   * cancelling the old one). The tab layout reserves its room (`keySignatureRoom`).
   */
  private addKeySignature(
    trackId: number,
    blockId: number,
    isFirstInRow: boolean,
    stave: Vex.Flow.Stave,
  ): void {
    if (isDrumTrack(trackId)) return
    const meta = Song.measureMeta[blockId]
    const previous = Song.measureMeta[blockId - 1]
    const changes = blockId > 0 && keyChanges(meta, previous)
    if (!isFirstInRow && !changes) return
    if (keyFifths(meta) === 0 && !changes) return
    const keyStave = stave as unknown as {
      addKeySignature(spec: string, cancelSpec?: string): unknown
    }
    keyStave.addKeySignature(vexFlowKey(meta), changes ? vexFlowKey(previous) : undefined)
  }

  /**
   * The voice that isn't edited, in its own colour (as in the tab). Its beats are placed by
   * time in the edited voice's layout; its rests are left out, they would sit on the other
   * voice's notes.
   */
  private drawOtherVoice(
    trackId: number,
    voiceId: number,
    blockId: number,
    xPos: number,
    stave: Vex.Flow.Stave,
    notes: Vex.Flow.StaveNote[],
    context: IRenderContext,
  ): void {
    const meta = Song.measureMeta[blockId]
    const voice = new Vex.Flow.Voice({ num_beats: meta.numerator, beat_value: meta.denominator })
    voice.setStrict(false)
    voice.addTickables(notes)
    const beams = Vex.Flow.Beam.generateBeams(notes, { maintain_stem_directions: true } as object)
    new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 0)
    voice.setStave(stave)
    notes.forEach((note) => note.setStave(stave))

    const beats = Song.measures[trackId][blockId][voiceId]
    const boxes = beats.map((beat, beatId) => {
      const left = getMeasureBeatX(trackId, voiceId, blockId, beatId, beats)
      const width = getMeasureBeatWidth(trackId, voiceId, blockId, beatId, beats)
      return { left, width, noteX: left + beatNoteOffset(beat, width) }
    })
    const xs = otherVoiceBeatXs(beats, boxes, Song.measures[trackId][blockId][otherVoiceOf(voiceId)])
    notes.forEach((note, i) => {
      const current = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2
      const tickContext = note.getTickContext()
      tickContext.setX(tickContext.getX() + CLASSICAL_CLEF_GUTTER + xPos + (xs[i] ?? 0) - current)
    })

    beams.forEach((beam: Vex.Flow.Beam) => beam.postFormat())
    // (VexFlow 4's SVG context; the installed 1.2 types don't know groups)
    const groups = context as unknown as { openGroup(cls: string): unknown; closeGroup(): void }
    groups.openGroup(otherVoiceOf(voiceId) === 1 ? 'other-voice other-voice--voice2' : 'other-voice')
    notes.forEach((note) => {
      if (note.isRest()) return
      note.setContext(context)
      note.draw()
    })
    beams.forEach((beam: Vex.Flow.Beam) => beam.setContext(context).draw())
    groups.closeGroup()
  }

  private rowNotes(trackId: number, voiceId: number, rowId: number): ConvertedBeat[] {
    const range = this.rowBlockRange(trackId, voiceId, rowId)
    if (!range) return []
    const notes: ConvertedBeat[] = []
    for (let blockId = range.start; blockId < range.end; blockId += 1)
      notes.push(...(this.allNotes[blockId] ?? []))
    return notes
  }

  /**
   * Ties of one row. Ties crossing a row break are drawn as two halves, each in its own row
   * (outgoing half here when the next row starts tied, incoming half when this row starts
   * tied), so rows never need each other's context.
   */
  private drawTies(trackId: number, voiceId: number, rowId: number, context: IRenderContext): void {
    const notes = this.rowNotes(trackId, voiceId, rowId)
    if (notes.length === 0) return
    notes.forEach((current, i) => {
      current.tied.forEach((tied, j) => {
        if (!tied) return
        if (i === 0) {
          new Vex.Flow.StaveTie({ last_note: current.note, last_indices: [j] }).setContext(context).draw()
          return
        }
        const previousIndex = notes[i - 1].strings.indexOf(current.strings[j])
        if (previousIndex !== -1) {
          new Vex.Flow.StaveTie({
            first_note: notes[i - 1].note,
            last_note: current.note,
            first_indices: [previousIndex],
            last_indices: [j],
          })
            .setContext(context)
            .draw()
        }
      })
    })
    const nextFirst = this.rowNotes(trackId, voiceId, rowId + 1)[0]
    const last = notes[notes.length - 1]
    nextFirst?.tied.forEach((tied, j) => {
      const lastIndex = tied ? last.strings.indexOf(nextFirst.strings[j]) : -1
      if (lastIndex !== -1) {
        new Vex.Flow.StaveTie({ first_note: last.note, first_indices: [lastIndex] })
          .setContext(context)
          .draw()
      }
    })
  }
}

function measureWidth(trackId: number, voiceId: number, blockId: number): number {
  const layoutWidth = renderBridge.getBlockWidth(trackId, voiceId, blockId)
  if (Number.isFinite(layoutWidth) && layoutWidth > 0) return layoutWidth
  const legacyWidth = tabLayout.finalBlockWidths[trackId]?.[voiceId]?.[blockId]
  return Number.isFinite(legacyWidth) && (legacyWidth ?? 0) > 0 ? legacyWidth! : 200
}

function measureX(trackId: number, voiceId: number, blockId: number, fallbackX: number): number {
  const blockLayout = renderBridge.getBlockLayout(trackId, voiceId, blockId)
  return blockLayout != null && Number.isFinite(blockLayout.xOffset) ? blockLayout.xOffset : fallbackX
}

/** The H-bar and count of a multi-bar rest (VexFlow 4; the installed 1.2 types don't know it). */
function drawMultiRest(count: number, stave: Vex.Flow.Stave, context: IRenderContext): void {
  const MultiMeasureRest = (
    Vex.Flow as unknown as {
      MultiMeasureRest: new (
        count: number,
        options: object,
      ) => { setStave(stave: Vex.Flow.Stave): { setContext(context: IRenderContext): { draw(): void } } }
    }
  ).MultiMeasureRest
  new MultiMeasureRest(count, { show_number: true }).setStave(stave).setContext(context).draw()
}

/** The bar's key; drums have none. */
function drumsOrKey(trackId: number, blockId: number): number {
  return isDrumTrack(trackId) ? 0 : keyFifths(Song.measureMeta[blockId])
}

/** Guitar music is written an octave above it sounds (MIDI 40, the low E2, is written E3). */
function writtenPitch(height: number, fifths: number): SpelledPitch {
  const pitch = spellPitch(height, fifths)
  return { ...pitch, octave: pitch.octave + 1 }
}

function stemOf(voiceId: number): number {
  return voiceId === 0 ? Vex.Flow.Stem.UP : Vex.Flow.Stem.DOWN
}

/**
 * One beat as a VexFlow note: its pitches (lowest first, each once), accidentals, grace notes
 * and dots. `stemDirection` fixes the stem (two voices on the staff); otherwise VexFlow picks it.
 */
function convertBeat(
  trackId: number,
  beat: Beat,
  accidentals: BarAccidentals,
  fifths: number,
  clef: string,
  stemDirection?: number,
): ConvertedBeat {
  const track = Song.tracks[trackId]
  const pitches: { height: number; note: Note; string: number }[] = []
  const seen = new Set<number>()
  for (let string = 0; string < track.numStrings; string += 1) {
    const note = beat.notes[string]
    if (note == null) continue
    const height = Math.round(track.strings[string]) + note.fret
    if (!seen.has(height)) {
      seen.add(height)
      pitches.push({ height, note, string })
    }
  }
  // notes recorded from MIDI that fit no string
  for (const note of beat.otherNotes ?? []) {
    if (!seen.has(note.height)) {
      seen.add(note.height)
      pitches.push({ height: note.height, note, string: -1 })
    }
  }
  pitches.sort((a, b) => a.height - b.height)
  if (beat.slash) return slashBeat(beat, pitches, clef, stemDirection)

  const spelled = pitches.map((pitch) => writtenPitch(pitch.height, fifths))
  // dead notes get an X head, as in the tab
  const keys = spelled.map((pitch, index) => `${vexFlowKeyOf(pitch)}${pitches[index].note.dead ? '/x2' : ''}`)
  // rests need a pitch placeholder but keep the rest duration suffix
  if (keys.length === 0) keys.push('b/4')
  const staveNote = new Vex.Flow.StaveNote({
    clef,
    keys,
    duration: durationToVexFlow(beat),
    ...(stemDirection != null ? { stem_direction: stemDirection } : { auto_stem: true }),
  })
  keys.forEach((_key, index) => {
    const pitch = spelled[index]
    const sign = pitch != null ? accidentals.sign(pitch, pitches[index].note.tied === true) : null
    if (sign != null) staveNote.addModifier(new Vex.Flow.Accidental(sign), index)
    if (pitches[index]?.note.ghost) addParentheses(staveNote, index)
    const grace = pitches[index]?.note.graceObj
    const string = pitches[index]?.string ?? -1
    if (grace != null && string >= 0) {
      const graceNote = new Vex.Flow.GraceNote({
        keys: [vexFlowKeyOf(writtenPitch(track.strings[string] + grace.fret, fifths))],
        duration: GRACE_DURATIONS[grace.duration] ?? '16',
      })
      staveNote.addModifier(new Vex.Flow.GraceNoteGroup([graceNote]), index)
    }
  })
  const dots = beat.dotted ? 1 : beat.doubleDotted ? 2 : 0
  for (let i = 0; i < dots; i += 1) Dot.buildAndAttach([staveNote], { all: true })

  return {
    note: staveNote,
    tied: pitches.map((pitch) => pitch.note.tied != null && pitch.note.tied),
    strings: pitches.map((pitch) => pitch.string),
    measure: beat,
  }
}

/** Ghost notes: the note head in parentheses (VexFlow 4; the installed 1.2 types don't know them). */
function addParentheses(note: Vex.Flow.StaveNote, index: number): void {
  const flow = Vex.Flow as unknown as {
    Parenthesis: new (position: number) => Vex.Flow.Modifier
    ModifierPosition?: { LEFT: number; RIGHT: number }
  }
  const position = flow.ModifierPosition ?? { LEFT: 1, RIGHT: 2 }
  note.addModifier(new flow.Parenthesis(position.LEFT), index)
  note.addModifier(new flow.Parenthesis(position.RIGHT), index)
}

/** The pitch on the staff's middle line, where slashes sit. */
const MIDDLE_LINE: Record<string, string> = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3' }

/** A slashed beat: one slash head on the middle line with the beat's rhythm (its notes still sound). */
function slashBeat(
  beat: Beat,
  pitches: { note: Note; string: number }[],
  clef: string,
  stemDirection?: number,
): ConvertedBeat {
  const duration = durationToVexFlow(beat).replace(/r$/, '')
  const staveNote = new Vex.Flow.StaveNote({
    clef,
    keys: [MIDDLE_LINE[clef] ?? 'b/4'],
    duration: `${duration}s`,
    ...(stemDirection != null ? { stem_direction: stemDirection } : { auto_stem: true }),
  })
  const dots = beat.dotted ? 1 : beat.doubleDotted ? 2 : 0
  for (let i = 0; i < dots; i += 1) Dot.buildAndAttach([staveNote], { all: true })
  // ties need a key per string; a slash has one, so the beat ties nothing on the staff
  return { note: staveNote, tied: [false], strings: [pitches[0]?.string ?? -1], measure: beat }
}

export type { ClassicalNotation }

export const classicalNotation = new ClassicalNotation()
export default classicalNotation
