import { reactive } from 'vue'
import { BaseModalHandler } from './baseModalHandler'
import Song, {
  type Beat,
  type DirectionJump,
  type DirectionTarget,
  type Grace,
  type Marker,
  type Note,
  type Stroke,
} from '../../stores/song'
import { DIRECTION_JUMPS, DIRECTION_TARGETS } from '../../utils/directions'
import { toggleNoteEffect } from '../editor/effectToggles'
import { recordBarEdit } from '../editor/editCommands'
import { requestBlocksRender } from '../editor/renderCommands'
import { classicalNotation } from '../notation/classicalNotationAdapter'
import { clampTempo } from '../../utils/tempo'
import { keyChanges, keyFifths } from '../../utils/keySignature'
import { redrawTrack } from '../editor/layoutInvalidation'
import { recordTrackEdit } from '../editor/songSettingsCommands'
import { clefAt, setClefFrom, type Clef } from '../../utils/clefs'

/** The bars an edit dialog changes, for the undo snapshot and the re-render. */
interface EditScope {
  trackId: number
  voiceId: number
  blockIds: number[]
}

/**
 * One edit dialog: a form, how to fill it from the song when it opens, and
 * how to write it back. Everything else (undo, re-render, closing) is shared.
 */
export interface EditModalConfig<TParams, TForm extends object> {
  id: string
  name: string
  /** Undo label. */
  label: string
  defaults: () => TForm
  /** Form values from the song for the selection the dialog was opened on. */
  read: (params: TParams) => Partial<TForm>
  scope: (params: TParams) => EditScope
  /** Writes the form into the song. Return false to refuse; nothing is recorded then. */
  write: (form: TForm, params: TParams) => void | boolean
  /** Runs after the edit and after each undo/redo of it. */
  afterChange?: (params: TParams) => void
  /** What the undo step snapshots: the scope's bars (default) or the scope's track settings. */
  undo?: 'bars' | 'track'
}

/** Generic handler for the dialogs that edit beats, notes or bar settings. */
export class EditModalHandler<TParams, TForm extends object> extends BaseModalHandler {
  readonly form: TForm

  private params: TParams | null = null

  constructor(private readonly config: EditModalConfig<TParams, TForm>) {
    super(config.id, config.name)
    this.form = reactive(config.defaults()) as TForm
  }

  openModal(params: TParams) {
    this.params = params
    Object.assign(this.form, this.config.defaults(), this.config.read(params))
    this.showModal()
  }

  /** Applies the form as one undo step and closes the dialog. */
  apply(): void {
    const params = this.params
    if (params == null) return
    const { trackId, voiceId, blockIds } = this.config.scope(params)
    const afterChange = this.config.afterChange
    if (this.config.undo === 'track') {
      recordTrackEdit(
        this.config.label,
        trackId,
        () => this.config.write(this.form, params),
        afterChange ? () => afterChange(params) : undefined,
      )
      this.closeModal()
      return
    }
    recordBarEdit(
      this.config.label,
      {
        trackId,
        blockIds,
        afterChange: afterChange ? () => afterChange(params) : undefined,
      },
      () => this.config.write(this.form, params),
    )
    requestBlocksRender(trackId, blockIds, voiceId)
    this.closeModal()
  }
}

/** A handler class (constructed without arguments, as the registry expects) for a config. */
export function defineEditModal<TParams, TForm extends object>(config: EditModalConfig<TParams, TForm>) {
  return class extends EditModalHandler<TParams, TForm> {
    constructor() {
      super(config)
    }
  }
}

// --- Selections the dialogs are opened on ----------------------------------

/** A beat (text) or a bar (marker, repeats, tempo) at the cursor. */
interface PositionParams {
  trackId: number
  blockId: number
  voiceId: number
  beatId?: number
}

/** The notes and beats of the cursor or the range selection. */
interface SelectionParams {
  notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[]
  beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Beat }[]
  blocks: number[]
  isVariableSet?: boolean
}

function barScope({ trackId, blockId, voiceId }: PositionParams): EditScope {
  return { trackId, voiceId, blockIds: [blockId] }
}

function selectionScope(params: SelectionParams): EditScope {
  const first = params.notes[0] ?? params.beats[0]
  const blockIds = [
    ...new Set([
      ...params.blocks,
      ...params.notes.map((note) => note.blockId),
      ...params.beats.map((beat) => beat.blockId),
    ]),
  ]
  return {
    trackId: first?.trackId ?? Song.currentTrackId,
    voiceId: first?.voiceId ?? Song.currentVoiceId,
    blockIds,
  }
}

function liveBeat({ trackId, blockId, voiceId, beatId }: PositionParams): Beat {
  return Song.getBeat({ trackId, blockId, voiceId, beatId: beatId ?? 0 })
}

// --- The dialogs -----------------------------------------------------------

export const TextModalHandler = defineEditModal<PositionParams, { text: string }>({
  id: 'textModal',
  name: 'Text',
  label: 'Text',
  defaults: () => ({ text: '' }),
  read: (params) => ({ text: liveBeat(params).text ?? '' }),
  scope: barScope,
  write: ({ text }, params) => {
    const beat = liveBeat(params)
    if (text.trim() === '') {
      delete beat.text
    } else {
      beat.text = text
    }
  },
})

export const MarkerModalHandler = defineEditModal<PositionParams, { text: string; color: Marker['color'] }>({
  id: 'markerModal',
  name: 'Marker',
  label: 'Marker',
  defaults: () => ({ text: '', color: { red: 255, green: 0, blue: 0 } }),
  read: ({ blockId }) => {
    const marker = Song.measureMeta[blockId].marker
    return marker ? { text: marker.text, color: { ...marker.color } } : {}
  },
  scope: barScope,
  write: ({ text, color }, { blockId }) => {
    Song.measureMeta[blockId].marker = { text, color: { ...color } }
  },
})

export const RepetitionModalHandler = defineEditModal<PositionParams, { count: number }>({
  id: 'repetitionModal',
  name: 'Repetition',
  label: 'Repeat count',
  defaults: () => ({ count: 1 }),
  read: ({ blockId }) => {
    const count = Song.measureMeta[blockId].repeatClose
    return count != null ? { count } : {}
  },
  scope: barScope,
  write: ({ count }, { blockId }) => {
    Song.measureMeta[blockId].repeatClose = Math.max(1, Math.round(Number(count) || 1))
  },
})

/** Bit `i` of `repeatAlternative` marks ending `i + 1`. */
export const RepeatAlternativeModalHandler = defineEditModal<PositionParams, { endings: boolean[] }>({
  id: 'repeatAlternativeModal',
  name: 'Repeat Alternative',
  label: 'Repeat ending',
  defaults: () => ({ endings: Array.from({ length: 8 }, () => false) }),
  read: ({ blockId }) => {
    const bits = Song.measureMeta[blockId].repeatAlternative ?? 0
    return { endings: Array.from({ length: 8 }, (_, i) => bits > 0 && ((bits >> i) & 1) === 1) }
  },
  scope: barScope,
  write: ({ endings }, { blockId }) => {
    const bits = endings.reduce((sum, checked, i) => (checked ? sum + 2 ** i : sum), 0)
    if (bits === 0) {
      delete Song.measureMeta[blockId].repeatAlternative
    } else {
      Song.measureMeta[blockId].repeatAlternative = bits
    }
  },
})

/** Navigation signs on a bar; an empty form removes them. */
export const DirectionModalHandler = defineEditModal<
  PositionParams,
  { targets: DirectionTarget[]; jumps: DirectionJump[] }
>({
  id: 'directionModal',
  name: 'Navigation signs',
  label: 'Navigation signs',
  defaults: () => ({ targets: [], jumps: [] }),
  read: ({ blockId }) => {
    const meta = Song.measureMeta[blockId]
    return { targets: [...(meta.directionTargets ?? [])], jumps: [...(meta.directionJumps ?? [])] }
  },
  scope: barScope,
  write: ({ targets, jumps }, { blockId }) => {
    const meta = Song.measureMeta[blockId]
    // (in the canonical order, whatever order the boxes were ticked in)
    const orderedTargets = DIRECTION_TARGETS.filter((target) => targets.includes(target))
    const orderedJumps = DIRECTION_JUMPS.filter((jump) => jumps.includes(jump))
    if (orderedTargets.length > 0) meta.directionTargets = orderedTargets
    else delete meta.directionTargets
    if (orderedJumps.length > 0) meta.directionJumps = orderedJumps
    else delete meta.directionJumps
  },
})

export const TempoModalHandler = defineEditModal<PositionParams, { bpm: number }>({
  id: 'tempoModal',
  name: 'Tempo',
  label: 'Tempo change',
  defaults: () => ({ bpm: 90 }),
  read: ({ blockId }) => ({ bpm: Song.measureMeta[blockId].bpm ?? Song.bpm }),
  scope: barScope,
  write: ({ bpm }, { blockId }) => {
    Song.measureMeta[blockId].bpm = clampTempo(Number(bpm))
  },
})

/**
 * The key from the cursor's bar up to the next bar whose key differs (a key change), in every
 * track (the key is bar data). Row starts get wider, so the track is laid out again.
 */
function keyRun(blockId: number): number[] {
  const bars = Song.measureMeta
  const blockIds = [blockId]
  for (let next = blockId + 1; next < bars.length && !keyChanges(bars[next], bars[next - 1]); next += 1) {
    blockIds.push(next)
  }
  return blockIds
}

export const KeySignatureModalHandler = defineEditModal<PositionParams, { fifths: number; minor: boolean }>({
  id: 'keySignatureModal',
  name: 'Key signature',
  label: 'Key signature',
  defaults: () => ({ fifths: 0, minor: false }),
  read: ({ blockId }) => ({
    fifths: keyFifths(Song.measureMeta[blockId]),
    minor: Song.measureMeta[blockId].keyMinor === true,
  }),
  scope: ({ trackId, blockId, voiceId }) => ({ trackId, voiceId, blockIds: keyRun(blockId) }),
  write: ({ fifths, minor }, { blockId }) => {
    for (const id of keyRun(blockId)) {
      const meta = Song.measureMeta[id]
      meta.keySignature = Math.max(-7, Math.min(7, Math.round(Number(fifths))))
      if (minor) meta.keyMinor = true
      else delete meta.keyMinor
    }
  },
  afterChange: () => redrawTrack(Song.currentTrackId, Song.currentVoiceId),
})

/**
 * The staff's clef from the cursor's bar on, in the cursor's track (up to its next clef
 * change). Choosing the clef of the bar before removes the change.
 */
export const ClefModalHandler = defineEditModal<PositionParams, { clef: Clef }>({
  id: 'clefModal',
  name: 'Clef',
  label: 'Clef',
  undo: 'track',
  defaults: () => ({ clef: 'treble' }),
  read: ({ trackId, blockId }) => {
    const clef = clefAt(Song.tracks[trackId], blockId, false)
    return clef === 'percussion' ? {} : { clef }
  },
  scope: barScope,
  write: ({ clef }, { trackId, blockId }) => {
    setClefFrom(Song.tracks[trackId], blockId, clef)
  },
  afterChange: ({ trackId, voiceId }) => redrawTrack(trackId, voiceId),
})

export const StrokeModalHandler = defineEditModal<SelectionParams, Stroke>({
  id: 'strokeModal',
  name: 'Stroke',
  label: 'Stroke',
  defaults: () => ({ strokeType: 'up', strokeLength: 8 }),
  read: ({ beats }) => {
    const stroke = beats[0]?.beat.effects.stroke
    return stroke ? { ...stroke } : {}
  },
  scope: selectionScope,
  write: ({ strokeType, strokeLength }, { beats }) => {
    for (const { beat } of beats) {
      beat.effects.stroke = { strokeType, strokeLength: Number(strokeLength) }
    }
  },
})

export const ArtificialModalHandler = defineEditModal<SelectionParams, { style: string }>({
  id: 'artificialModal',
  name: 'Artificial',
  label: 'Harmonic',
  defaults: () => ({ style: 'N.H.' }),
  read: ({ notes }) => {
    const style = notes[0]?.note.artificialStyle
    return style ? { style } : {}
  },
  scope: selectionScope,
  write: ({ style }, { notes }) => {
    for (const { note } of notes) {
      note.artificialStyle = style
    }
  },
})

export const GraceModalHandler = defineEditModal<SelectionParams, Grace>({
  id: 'graceModal',
  name: 'Grace',
  label: 'Grace note',
  defaults: () => ({
    fret: 0,
    duration: 's',
    dynamic: 'f',
    transition: 'none',
    setOnBeat: 'before',
    string: 0,
    height: 0,
    dead: false,
  }),
  read: ({ notes }) => {
    const grace = notes[0]?.note.graceObj
    return grace ? { ...grace } : {}
  },
  scope: selectionScope,
  write: (form, { notes }) => {
    for (const { note } of notes) {
      note.graceObj = { ...form, fret: Number(form.fret) }
    }
  },
  afterChange: (params) => {
    const { trackId, voiceId } = selectionScope(params)
    classicalNotation.computeVexFlowDataStructures(trackId, voiceId)
  },
})

export const TremoloPickingModalHandler = defineEditModal<SelectionParams, { length: string }>({
  id: 'tremoloPickingModal',
  name: 'Tremolo Picking',
  label: 'Tremolo picking',
  defaults: () => ({ length: 'e' }),
  read: ({ notes }) => {
    const length = notes[0]?.note.tremoloPickingLength
    return length ? { length } : {}
  },
  scope: selectionScope,
  write: ({ length }, { notes, isVariableSet }) => {
    toggleNoteEffect(notes, 'tremoloPicking', isVariableSet ?? false)
    for (const { note } of notes) {
      note.tremoloPicking = true
      note.tremoloPickingLength = length
    }
  },
})
