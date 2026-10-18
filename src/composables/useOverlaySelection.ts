import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import Song from '../assets/js/songData'
import { overlayHandler } from '../assets/js/overlayHandler'
import { useTabStore } from '../stores/tabStore'
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
  isFirstRow: ComputedRef<boolean>
  numStrings: ComputedRef<number>
  getMeasureContentPadding: (blockId: number) => number
}

export function useOverlaySelection(options: UseOverlaySelectionOptions) {
  const tabStore = useTabStore()
  const { selectionVersion } = storeToRefs(tabStore)

  const rangeOverlayRect = computed<OverlaySelectionRect | null>(() => {
    void selectionVersion.value

    const start = overlayHandler.startPosOverlay
    const end = overlayHandler.endPosOverlay
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
      options.isFirstRow.value,
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
