import { ref, unref, type Ref } from 'vue'
import {
  applyRangeAsLoop,
  clearRange,
  currentLoopInterval,
  moveRangeEdge,
  orderedRange,
  startRange,
  extendRange,
} from '../services/editor/rangeSelection'
import { announce } from '../stores/announcerState'
import type { RenderedTabRow, TabSelectionData } from '../types/tab'
import { resolveTabPointerPosition, TAB_CONSTANTS } from '../utils/tabLayout'
import { barOtherVoiceNotes } from '../utils/measureBeatLayout'
import { otherVoiceNoteAt } from '../utils/otherVoiceNotes'
import { usePlaybackEngine } from './usePlaybackEngine'

const DRAG_THRESHOLD_PX = 8

type ResolvedPointer = NonNullable<ReturnType<typeof resolveTabPointerPosition>> & {
  trackId: number
  voiceId: number
}

interface TabRangeSelectionOptions {
  svgRoot: Ref<SVGSVGElement | null>
  tabRows: Ref<RenderedTabRow[]>
  /** The shown track and voice (the props change when another track is shown). */
  trackId: () => number
  voiceId: () => number
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

  function resolvePointer(event: MouseEvent): ResolvedPointer | null {
    const svgElement = options.svgRoot.value
    if (!svgElement) {
      return null
    }

    const resolved = resolveTabPointerPosition(
      event,
      svgElement,
      options.tabRows.value,
      unref(options.rowHeight),
      TAB_CONSTANTS.STRING_SPACING,
      options.getMeasureContentPadding,
      unref(options.rowYOffsetAdjust) ?? 0,
      options.trackId(),
      options.voiceId(),
    )
    if (!resolved) return null
    // in the score view every row has its own track
    return {
      ...resolved,
      trackId: resolved.row.trackId ?? options.trackId(),
      voiceId: resolved.row.voiceId ?? options.voiceId(),
    }
  }

  /**
   * A click on a faintly drawn note of the other voice edits that voice there; otherwise the
   * beat of the shown voice under the pointer.
   */
  function clickedBeat(resolved: ResolvedPointer, stringIndex: number): TabSelectionData {
    const { trackId, voiceId, blockId } = resolved
    const beats = resolved.row.measures[blockId - resolved.row.startBlockId]?.data ?? []
    const faint = otherVoiceNoteAt(
      barOtherVoiceNotes(trackId, voiceId, blockId, beats),
      resolved.barX,
      stringIndex,
    )
    return faint != null
      ? { trackId, voiceId: voiceId === 0 ? 1 : 0, blockId, beatIndex: faint.beatIndex, stringIndex }
      : { trackId, voiceId, blockId, beatIndex: resolved.beatIndex, stringIndex }
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
      startRange(pointerStart.trackId, pointerStart.blockId, pointerStart.voiceId, pointerStart.beatIndex)
    }

    if (!isDraggingRange.value) {
      return
    }

    // a range stays in the track it started in
    const current = resolvePointer(event)
    if (!current || current.trackId !== pointerStart.trackId) {
      return
    }

    extendRange(current.trackId, current.blockId, current.voiceId, current.beatIndex)
  }

  function handleWindowMouseUp(event: MouseEvent): void {
    if (!dragSessionActive) {
      return
    }

    if (isDraggingRange.value) {
      const current = resolvePointer(event)
      if (current && current.trackId === pointerStart?.trackId) {
        extendRange(current.trackId, current.blockId, current.voiceId, current.beatIndex)
      }
      // The selected range is also the playback loop (as when dragging in the sequencer).
      applyRangeAsLoop()
    } else if (pointerStart) {
      const selection = clickedBeat(pointerStart, pointerStart.stringIndex)
      options.onSingleSelect(selection)
      // A click while the song plays moves playback there.
      if (playbackEngine.getPlayingState()) {
        void playbackEngine.jumpToBeat(
          selection.trackId,
          selection.blockId,
          selection.voiceId,
          selection.beatIndex,
        )
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
    if (event.shiftKey) {
      if (resolved.trackId !== options.trackId()) return
      // Shift+click extends the range from the cursor (or the range's anchor) to here.
      // The selection commands are the lazy `editing-tools` chunk.
      void import('../services/editor/selectionCommands').then((tools) =>
        tools.extendSelectionTo(resolved.blockId, resolved.beatIndex, stringIndex),
      )
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

  /**
   * A right-click on a string: selects that beat first (keeping a range the click is inside, so
   * the note menu acts on the range) and returns whether something was hit.
   */
  function selectForContextMenu(event: MouseEvent, stringIndex: number): boolean {
    const resolved = resolvePointer(event)
    if (!resolved) return false
    const range = currentLoopInterval()
    const inRange =
      range != null &&
      range.trackId === resolved.trackId &&
      compareBeat(resolved.blockId, resolved.beatIndex, range.startBlock, range.startBeat) >= 0 &&
      compareBeat(resolved.blockId, resolved.beatIndex, range.endBlock, range.endBeat) <= 0
    if (!inRange) {
      options.onSingleSelect(clickedBeat(resolved, stringIndex))
    }
    return true
  }

  function clearRangeSelection(): void {
    clearRange()
  }

  /**
   * Dragging a loop handle (A or B above the tab, Big win 28): that end of the loop follows
   * the pointer beat by beat in the loop's track and voice; the loop is set when let go.
   */
  function handleLoopHandleDown(event: PointerEvent, edge: 'start' | 'end'): void {
    if (event.button !== 0) return
    const range = orderedRange()
    if (range == null) return
    event.preventDefault()
    event.stopPropagation()
    const { trackId, voiceId } = range[0]
    isDraggingRange.value = true
    const follow = (move: PointerEvent) => {
      const current = resolvePointer(move)
      if (current && current.trackId === trackId && current.voiceId === voiceId)
        moveRangeEdge(edge, current.blockId, current.beatIndex)
    }
    const finish = (up: PointerEvent) => {
      follow(up)
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      isDraggingRange.value = false
      applyRangeAsLoop()
      const ends = orderedRange()
      if (ends)
        announce(
          `Loop from bar ${ends[0].blockId + 1} beat ${ends[0].beatId + 1} to bar ${ends[1].blockId + 1} beat ${ends[1].beatId + 1}`,
        )
    }
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return {
    isDraggingRange,
    handleLoopHandleDown,
    handleStringPointerDown,
    selectForContextMenu,
    clearRangeSelection,
  }
}

function compareBeat(blockA: number, beatA: number, blockB: number, beatB: number): number {
  return blockA !== blockB ? blockA - blockB : beatA - beatB
}
