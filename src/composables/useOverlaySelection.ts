import { computed, type ComputedRef } from 'vue'
import Song from '../stores/song'
import { selectionState } from '../stores/selectionState'
import type { RenderedTabRow } from '../types/tab'
import {
  computeOverlayRectForRow,
  normalizeOverlayRange,
  type OverlaySelectionRect,
} from '../utils/overlaySelectionLayout'

interface UseOverlaySelectionOptions {
  trackId: number
  voiceId: number
  rowId: number
  rowData: ComputedRef<Pick<RenderedTabRow, 'startBlockId' | 'measures'>>
  labelGutter: ComputedRef<boolean>
  numStrings: ComputedRef<number>
  getMeasureContentPadding: (blockId: number) => number
}

export function useOverlaySelection(options: UseOverlaySelectionOptions) {
  const rangeOverlayRect = computed<OverlaySelectionRect | null>(() => {
    const start = selectionState.rangeStart
    const end = selectionState.rangeEnd
    if (start == null || end == null) {
      return null
    }
    if (start.trackId !== options.trackId || start.voiceId !== options.voiceId) {
      return null
    }

    const range = normalizeOverlayRange(start, end)
    const beatCountInEndBlock =
      Song.measures[options.trackId]?.[range.blockIdEnd]?.[options.voiceId]?.length ?? 0

    return computeOverlayRectForRow(
      options.trackId,
      options.voiceId,
      options.rowId,
      options.rowData.value,
      options.labelGutter.value,
      range,
      beatCountInEndBlock,
      options.getMeasureContentPadding,
      options.numStrings.value,
    )
  })

  const hasRangeSelection = computed(() => rangeOverlayRect.value != null)

  return {
    rangeOverlayRect,
    hasRangeSelection,
  }
}
