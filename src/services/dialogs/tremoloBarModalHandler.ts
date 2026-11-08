import { reactive } from 'vue'
import { BaseModalHandler } from './baseModalHandler'
import { Note, Beat, TremoloBar } from '../../stores/song'
import { recordBarEdit } from '../editor/editCommands'
import { toggleBeatEffect } from '../editor/effectToggles'
import { DIALOGS } from './dialogs'
import { requestBlocksRender } from '../editor/renderCommands'

/** Grid columns (time) and rows (pitch; row 16 is the unchanged pitch, one row is 50 GP units). */
export const TREMOLO_COLUMNS = 12
export const TREMOLO_ROWS = 24

/** Dive, dip, release up, inverted dip, return, release down, as (column, rows up). */
const TREMOLO_PRESETS: { x: number; y: number }[][] = [
  [
    { x: 0, y: 16 },
    { x: 9, y: 14 },
    { x: 12, y: 14 },
  ],
  [
    { x: 0, y: 16 },
    { x: 6, y: 14 },
    { x: 12, y: 16 },
  ],
  [
    { x: 0, y: 14 },
    { x: 9, y: 14 },
    { x: 12, y: 16 },
  ],
  [
    { x: 0, y: 16 },
    { x: 6, y: 18 },
    { x: 12, y: 16 },
  ],
  [
    { x: 0, y: 16 },
    { x: 9, y: 18 },
    { x: 12, y: 18 },
  ],
  [
    { x: 0, y: 18 },
    { x: 9, y: 18 },
    { x: 12, y: 16 },
  ],
]

type BeatRef = { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Beat }

/** The tremolo bar dialog: one point (rows up) or none per grid column; TremoloBarModal.vue draws them. */
export class TremoloBarModalHandler extends BaseModalHandler {
  readonly editor = reactive({
    /** Index = column; value = rows up, or null for no point. */
    points: new Array<number | null>(TREMOLO_COLUMNS + 1).fill(null),
    preset: 0,
  })

  private beats: BeatRef[] = []
  private blocks: number[] = []
  private isVariableSet = false

  constructor() {
    super(DIALOGS.TREMOLO_BAR.id, DIALOGS.TREMOLO_BAR.name)
  }

  openModal(params: {
    notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[]
    blocks: number[]
    beats: BeatRef[]
    isVariableSet: boolean
  }) {
    this.beats = params.beats ?? []
    this.blocks = params.blocks ?? []
    this.isVariableSet = params.isVariableSet
    this.editor.preset = 0
    const existing = params.beats?.[0]?.beat.effects?.tremoloBar
    // A new tremolo bar starts as the preset the select shows, like the bend dialog.
    this.setPoints(
      existing == null
        ? TREMOLO_PRESETS[0]
        : existing.map((point) => ({ x: point.position / 5, y: (point.value + 800) / 50 })),
    )
    this.showModal()
  }

  applyPreset(index: number): void {
    this.editor.preset = index
    this.setPoints(TREMOLO_PRESETS[index] ?? TREMOLO_PRESETS[0])
  }

  /** A click on the grid at (column, rows up): adds a point there, or removes the same point. */
  togglePoint(column: number, rowsUp: number): void {
    if (column < 0 || column > TREMOLO_COLUMNS) return
    this.editor.points[column] = this.editor.points[column] === rowsUp ? null : rowsUp
  }

  /** Writes the curve to the beats (one undo step) and closes. */
  apply(): void {
    const { beats, blocks } = this
    if (beats.length === 0) return
    const blockIds = [...blocks, ...beats.map((ref) => ref.blockId)]
    recordBarEdit('Tremolo bar', { trackId: beats[0].trackId, blockIds }, () => {
      toggleBeatEffect(beats, 'tremoloBar', this.isVariableSet)
      for (const ref of beats) ref.beat.effects.tremoloBar = this.tremoloBar()
    })
    requestBlocksRender(beats[0].trackId, blocks, beats[0].voiceId)
    this.closeModal()
  }

  private setPoints(points: { x: number; y: number }[]): void {
    const next = new Array<number | null>(TREMOLO_COLUMNS + 1).fill(null)
    for (const { x, y } of points) {
      const column = Math.round(x)
      if (column >= 0 && column <= TREMOLO_COLUMNS) next[column] = y
    }
    this.editor.points = next
  }

  private tremoloBar(): TremoloBar {
    const result: TremoloBar = []
    this.editor.points.forEach((rowsUp, column) => {
      if (rowsUp != null) result.push({ position: column * 5, value: rowsUp * 50 - 800, vibrato: 0 })
    })
    return result
  }
}
