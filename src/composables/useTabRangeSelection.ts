import { ref, unref, type Ref } from 'vue'
import { overlayHandler } from '../assets/js/overlayHandler'
import type { RenderedTabRow, TabSelectionData } from '../types/tab'
import {
  resolveTabPointerPosition,
  TAB_CONSTANTS,
} from '../utils/tabLayout'
import { usePlaybackEngine } from './usePlaybackEngine'

const DRAG_THRESHOLD_PX = 8

type ResolvedPointer = NonNullable<ReturnType<typeof resolveTabPointerPosition>>

interface TabRangeSelectionOptions {
  svgRoot: Ref<SVGSVGElement | null>
  tabRows: Ref<RenderedTabRow[]>
  trackId: number
  voiceId: number
  rowHeight: number | Ref<number>
  rowYOffsetAdjust?: number | Ref<number>
  getMeasureContentPadding: (blockId: number) => number
  onSingleSelect: (selection: TabSelectionData) => void
}

export function useTabRangeSelection(options: TabRangeSelectionOptions) {
  const isDraggingRange = ref(false)

  let pointerStart: (ResolvedPointer & { stringIndex: number }) | null = null
  let pointerStartClientX = 0
  let pointerStartClientY = 0
  let dragSessionActive = false
  const playbackEngine = usePlaybackEngine()

  function resolvePointer(event: MouseEvent) {
    const svgElement = options.svgRoot.value
    if (!svgElement) {
      return null
    }

    return resolveTabPointerPosition(
      event,
      svgElement,
      options.tabRows.value,
      unref(options.rowHeight),
      TAB_CONSTANTS.STRING_SPACING,
      options.getMeasureContentPadding,
      unref(options.rowYOffsetAdjust) ?? 0,
      options.trackId,
      options.voiceId,
    )
  }

  function cleanupWindowListeners(): void {
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
    dragSessionActive = false
  }

  function handleWindowMouseMove(event: MouseEvent): void {
    if (!dragSessionActive || pointerStart == null) {
      return
    }

    const deltaX = Math.abs(event.clientX - pointerStartClientX)
    const deltaY = Math.abs(event.clientY - pointerStartClientY)
    if (!isDraggingRange.value && (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX)) {
      isDraggingRange.value = true
      overlayHandler.initOverlay(
        options.trackId,
        pointerStart.blockId,
        options.voiceId,
        pointerStart.beatIndex,
      )
    }

    if (!isDraggingRange.value) {
      return
    }

    const current = resolvePointer(event)
    if (!current) {
      return
    }

    overlayHandler.selectionMove(
      event,
      options.trackId,
      current.blockId,
      options.voiceId,
      current.beatIndex,
    )
  }

  function handleWindowMouseUp(event: MouseEvent): void {
    if (!dragSessionActive) {
      return
    }

    if (isDraggingRange.value) {
      const current = resolvePointer(event)
      if (current) {
        overlayHandler.selectionMove(
          event,
          options.trackId,
          current.blockId,
          options.voiceId,
          current.beatIndex,
        )
      }
      // The selected range is also the playback loop (as when dragging in the sequencer).
      overlayHandler.setLoopingInterval()
    } else if (pointerStart) {
      options.onSingleSelect({
        trackId: options.trackId,
        voiceId: options.voiceId,
        blockId: pointerStart.blockId,
        beatIndex: pointerStart.beatIndex,
        stringIndex: pointerStart.stringIndex,
      })
      // A click while the song plays moves playback there.
      if (playbackEngine.getPlayingState()) {
        void playbackEngine.jumpToBeat(options.trackId, pointerStart.blockId, options.voiceId, pointerStart.beatIndex)
      }
    }

    isDraggingRange.value = false
    pointerStart = null
    cleanupWindowListeners()
  }

  function handleStringPointerDown(event: MouseEvent, stringIndex: number): void {
    if (event.button !== 0) {
      return
    }

    const resolved = resolvePointer(event)
    if (!resolved) {
      return
    }

    pointerStart = {
      ...resolved,
      stringIndex,
    }
    pointerStartClientX = event.clientX
    pointerStartClientY = event.clientY
    dragSessionActive = true
    isDraggingRange.value = false

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
  }

  function clearRangeSelection(): void {
    overlayHandler.resetOverlays()
  }

  return {
    isDraggingRange,
    handleStringPointerDown,
    clearRangeSelection,
  }
}
