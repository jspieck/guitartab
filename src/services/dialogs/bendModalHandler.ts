import { reactive } from 'vue'
import { BaseModalHandler } from './baseModalHandler'
import { Note, Beat } from '../../stores/song'
import { toggleNoteEffect } from '../editor/effectToggles'
import { recordBarEdit } from '../editor/editCommands'
import { Song } from '../../stores/song'
import { DIALOGS } from './dialogs'
import { requestBlocksRender } from '../editor/renderCommands'

/** The bend editor's SVG size in its own units (BendModal.vue's viewBox). */
export const BEND_EDITOR_WIDTH = 501
export const BEND_EDITOR_HEIGHT = 200
export const BEND_PADDING_TOP = 20
export const BEND_PADDING_LEFT = 25
/** Grid columns (time) and rows (pitch: 4 rows = a whole tone). */
export const BEND_COLUMNS = 12
export const BEND_ROWS = 12

/** Bend shapes as (column, rows up) points: bend, bend/release, bend/release/bend, pre-bend, pre-bend/release. */
const BEND_PRESETS: { x: number; y: number }[][] = [
  [
    { x: 0, y: 0 },
    { x: 6, y: 4 },
    { x: 12, y: 4 },
  ],
  [
    { x: 0, y: 0 },
    { x: 3, y: 4 },
    { x: 6, y: 4 },
    { x: 9, y: 0 },
    { x: 12, y: 0 },
  ],
  [
    { x: 0, y: 0 },
    { x: 2, y: 4 },
    { x: 4, y: 4 },
    { x: 6, y: 0 },
    { x: 8, y: 0 },
    { x: 10, y: 4 },
    { x: 12, y: 4 },
  ],
  [
    { x: 0, y: 4 },
    { x: 12, y: 4 },
  ],
  [
    { x: 0, y: 4 },
    { x: 4, y: 4 },
    { x: 8, y: 0 },
    { x: 12, y: 0 },
  ],
]

interface BendNoteRef {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  note: Note
}

interface BendModalParams {
  notes: BendNoteRef[]
  blocks: number[]
  beats: {
    trackId: number
    blockId: number
    voiceId: number
    beatId: number
    beat: Beat
  }[]
  isVariableSet: boolean
}

/** The bend dialog: one point (rows up) or none per grid column; BendModal.vue draws them. */
export class BendModalHandler extends BaseModalHandler {
  readonly editor = reactive({
    /** Index = column; value = rows up, or null for no point. */
    points: new Array<number | null>(BEND_COLUMNS + 1).fill(null),
    preset: 0,
  })

  private currentNotes: Pick<BendModalParams, 'notes' | 'blocks'> | null = null
  private isVariableSet = false

  constructor() {
    super(DIALOGS.BEND.id, DIALOGS.BEND.name)
  }

  openModal(params: BendModalParams) {
    this.currentNotes = { notes: params.notes ?? [], blocks: params.blocks ?? [] }
    this.isVariableSet = params.isVariableSet
    const bend = params.notes?.[0]?.note.bendObj
    this.editor.preset = 0
    this.setPoints(
      bend == null
        ? BEND_PRESETS[0]
        : bend.map((point) => ({ x: point.bendPosition / 5, y: point.bendValue / 25 })),
    )
    this.showModal()
  }

  applyPreset(index: number): void {
    this.editor.preset = index
    this.setPoints(BEND_PRESETS[index] ?? BEND_PRESETS[0])
  }

  /** A click on the grid at (column, rows up): adds a point there, or removes the same point. */
  togglePoint(column: number, rowsUp: number): void {
    if (column < 0 || column > BEND_COLUMNS) return
    this.editor.points[column] = this.editor.points[column] === rowsUp ? null : rowsUp
  }

  /** Writes the curve to the notes (one undo step) and closes. */
  apply(): void {
    const target = this.currentNotes
    if (target == null || target.notes.length === 0) return
    const bendObjs = this.bendObjects()
    const { notes, blocks } = target
    const blockIds = [...blocks, ...notes.map((note) => note.blockId)]
    recordBarEdit('Bend', { trackId: notes[0].trackId, blockIds }, () => {
      toggleNoteEffect(notes, 'bend', this.isVariableSet)
      for (const { trackId, blockId, voiceId, beatId, string } of notes) {
        const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
        if (note) note.bendObj = bendObjs.map((point) => ({ ...point }))
      }
    })
    requestBlocksRender(notes[0].trackId, blocks, notes[0].voiceId)
    this.closeModal()
  }

  private setPoints(points: { x: number; y: number }[]): void {
    const next = new Array<number | null>(BEND_COLUMNS + 1).fill(null)
    for (const { x, y } of points) {
      const column = Math.round(x)
      if (column >= 0 && column <= BEND_COLUMNS) next[column] = y
    }
    this.editor.points = next
  }

  private bendObjects(): { bendPosition: number; bendValue: number; vibrato: number }[] {
    const result: { bendPosition: number; bendValue: number; vibrato: number }[] = []
    this.editor.points.forEach((rowsUp, column) => {
      if (rowsUp != null) result.push({ bendPosition: column * 5, bendValue: rowsUp * 25, vibrato: 0 })
    })
    return result
  }
}
