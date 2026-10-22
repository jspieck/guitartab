import { reactive } from 'vue'

/** The edit cursor: one string of one beat. */
export interface CursorPosition {
  trackId: number
  voiceId: number
  blockId: number
  beatId: number
  string: number
}

/** One end of a range selection; `abstractTimePos` is the position inside the beat (0–1). */
export interface RangeEndpoint {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  abstractTimePos: number
}

export interface SelectionStateData {
  cursor: CursorPosition
  /** The user has placed the cursor (click or keyboard), as opposed to the startup default. */
  hasExplicitSelection: boolean
  rangeStart: RangeEndpoint | null
  rangeEnd: RangeEndpoint | null
}

/**
 * The editor's selection in one reactive place: the edit cursor and the two
 * ends of the range selection (set through services/editor/rangeSelection.ts).
 */
export const selectionState = reactive<SelectionStateData>({
  cursor: { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 },
  hasExplicitSelection: false,
  rangeStart: null,
  rangeEnd: null,
})

export function resetSelectionState(): void {
  selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 }
  selectionState.hasExplicitSelection = false
  selectionState.rangeStart = null
  selectionState.rangeEnd = null
}
