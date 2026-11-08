<template>
  <g class="tab-row" :data-row-id="rowData.id" :data-track-id="trackId" :transform="`translate(0, ${yOffset})`">
    <!-- Guitar strings background -->
    <g class="strings">
      <line
        v-for="stringIndex in numStrings"
        :key="`string-${stringIndex}`"
        :x1="0"
        :x2="width"
        :y1="(stringIndex - 1) * stringSpacing"
        :y2="(stringIndex - 1) * stringSpacing"
        class="tab-string-line"
        stroke-width="1"
      />
    </g>
    
    <!-- Measure separators -->
    <g class="measure-separators">
      <line
        v-for="(separator, index) in measureSeparators"
        :key="`separator-${index}`"
        :x1="separator.x"
        :x2="separator.x"
        :y1="0"
        :y2="(numStrings - 1) * stringSpacing"
        class="tab-separator-line"
        stroke-width="1"
      />
    </g>
    
    <!-- Drum tracks: each line's drum, on every row (utils/drumMap.ts) -->
    <g v-if="drumLines" class="drum-line-labels" pointer-events="none">
      <text
        v-for="(midi, line) in drumLines"
        :key="`drum-label-${line}`"
        x="15"
        :y="stringLine(line, numStrings) * stringSpacing + 3"
        font-family="Source Sans Pro"
        font-size="9px"
        font-weight="600"
        text-anchor="middle"
        class="drum-line-label"
      >{{ drumLabel(midi) }}</text>
    </g>

    <!-- TAB label for first row -->
    <g v-else-if="labelGutter && rowData.id === 0" class="tab-label">
      <text x="15" :y="stringSpacing * 1.5" font-family="Source Sans Pro" font-size="16px" class="tab-label-text" text-anchor="middle">T</text>
      <text x="15" :y="stringSpacing * 3.0" font-family="Source Sans Pro" font-size="16px" class="tab-label-text" text-anchor="middle">A</text>
      <text x="15" :y="stringSpacing * 4.5" font-family="Source Sans Pro" font-size="16px" class="tab-label-text" text-anchor="middle">B</text>
    </g>
    
    <!-- Range selection overlay (loop / copy-paste) -->
    <g v-if="rangeOverlayRect" class="range-selection-overlay" pointer-events="none">
      <rect
        :x="rangeOverlayRect.x"
        :y="rangeOverlayRect.y"
        :width="rangeOverlayRect.width"
        :height="rangeOverlayRect.height"
        style="fill: var(--tab-range); stroke: none"
      />
    </g>

    <!-- A/B handles of the loop (Big win 28): drag to move its start or end beat by beat -->
    <g
      v-for="handle in loopHandles"
      :key="handle.edge"
      class="loop-handle"
      :class="`loop-handle--${handle.edge}`"
      :transform="`translate(${handle.x}, ${rangeOverlayRect!.y})`"
      @pointerdown="(event: PointerEvent) => onLoopHandleDown?.(event, handle.edge)"
    >
      <title>{{ handle.edge === 'start' ? 'Loop start: drag to move' : 'Loop end: drag to move' }}</title>
      <rect class="loop-handle__grip" x="-7" :y="-22" width="14" :height="rangeOverlayRect!.height + 26" style="fill: transparent" />
      <line x1="0" x2="0" :y1="-8" :y2="rangeOverlayRect!.height + 4" style="stroke: var(--color-accent); stroke-width: 2" />
      <rect :x="handle.edge === 'start' ? 0 : -14" y="-22" width="14" height="14" rx="3" style="fill: var(--color-accent)" />
      <text :x="handle.edge === 'start' ? 7 : -7" y="-11" text-anchor="middle" font-size="10" font-weight="700"
        style="fill: var(--color-on-accent)">{{ handle.edge === 'start' ? 'A' : 'B' }}</text>
    </g>

    <!-- Selection indicator -->
    <g
      v-if="selectionRenderPoint"
      class="selection-indicator"
      :class="{ 'selection-indicator--voice2': voiceId === 1 }"
      :data-voice="voiceId + 1"
      pointer-events="none"
      :data-lyrics-dy="lyricsLineTop - selectionRenderPoint.y"
    >
      <rect
        :x="selectionRenderPoint.x - 10"
        :y="selectionRenderPoint.y - 8"
        width="20"
        height="16"
        stroke-width="1"
        rx="2"
        class="selection-cursor"
      />
      <!-- voice 2: the cursor says so (the tab draws it in its own colour) -->
      <text
        v-if="voiceId === 1"
        :x="selectionRenderPoint.x + 12"
        :y="selectionRenderPoint.y - 6"
        font-family="Source Sans Pro"
        font-size="9px"
        font-weight="700"
        class="selection-voice-label"
      >2</text>
    </g>

    <!-- Measures (Notes and Effects) -->
    <TabMeasure
      v-for="(measureObj, measureIndex) in rowData.measures"
      :key="`measure-${rowData.startBlockId + measureIndex}`"
      :measure-data="measureObj.data"
      :width="measureObj.width"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex)"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :content-padding="getMeasureContentPadding(rowData.startBlockId + measureIndex)"
      :lanes="rowData.lanes"
      :multi-rest="measureObj.multiRest"
      :hidden="measureObj.hidden"
      :bar-number="!rowData.lowerStaff"
      :drums="drumLines != null"
      pointer-events="none"
    />
    
    <!-- Measure metadata (time signatures, BPM, etc.) -->
    <TabMeasureInfo
      v-for="(measureObj, measureIndex) in rowData.measures"
      :key="`info-${rowData.startBlockId + measureIndex}`"
      :measure-meta="getMeasureMeta(rowData.startBlockId + measureIndex)"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex)"
      :width="measureObj.width"
      :num-strings="numStrings"
      :string-spacing="stringSpacing"
      :lanes="rowData.lanes"
      :content-padding="getMeasureContentPadding(rowData.startBlockId + measureIndex)"
      :annotations="!rowData.lowerStaff"
      pointer-events="none"
    />

    <!-- Clickable string areas for note placement - ON TOP -->
    <g class="clickable-strings">
      <rect
        v-for="stringIndex in numStrings"
        :key="`click-area-${stringIndex}`"
        :x="0"
        :y="(stringIndex - 1) * stringSpacing - 6"
        :width="width"
        :height="12"
        fill="transparent"
        class="string-click-area"
        :data-string="stringLine(stringIndex - 1, numStrings)"
        @mousedown="(event: MouseEvent) => handleStringPointerDown(event, stringLine(stringIndex - 1, numStrings))"
        cursor="pointer"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { stringLine } from '../../utils/tabStrings'
import { drumLabel } from '../../utils/drumMap'
import Song from '../../stores/song'
import { computed } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import { useOverlaySelection } from '../../composables/useOverlaySelection'
import { orderedRange } from '../../services/editor/rangeSelection'
import { playbackLoopState } from '../../stores/playbackLoopState'
import { useTabSelection } from '../../composables/useTabSelection'
import { usePlaybackEngine } from '../../composables/usePlaybackEngine'
import editorCore from '../../services/editor/editorCore'
import { lyricsEntryState } from '../../stores/lyricsEntryState'
import { LANE_HEIGHTS } from '../../utils/tabRowLanes'
import type {
  RenderedTabRow,
  RendererSelectionPosition,
  TabMeasureMetaData,
} from '../../types/tab'
import {
  clickToTabPosition,
  getMeasureXOffset as getLayoutMeasureXOffset,
  getSelectionRenderPoint,
  TAB_CONSTANTS,
} from '../../utils/tabLayout'

interface Props {
  rowData: RenderedTabRow
  trackId: number
  voiceId: number
  svgRoot?: SVGSVGElement | null
  yOffset: number
  width: number
  labelGutter?: boolean
  onStringPointerDown?: (event: MouseEvent, stringIndex: number) => void
  onLoopHandleDown?: (event: PointerEvent, edge: 'start' | 'end') => void
}

const props = withDefaults(defineProps<Props>(), {
  labelGutter: false,
  onStringPointerDown: undefined,
  onLoopHandleDown: undefined,
})

const { STRING_SPACING } = TAB_CONSTANTS
const stringSpacing = STRING_SPACING

const {
  currentSelection,
  setSelection,
} = useTabSelection()

const numStrings = computed(() => editorCore.getTrackStringCount(props.trackId))

/** A drum track's map (its line names), or null. */
const drumLines = computed(() => {
  if (Song.playBackInstrument[props.trackId]?.instrument !== 'drums') return null
  return Song.tracks[props.trackId]?.drumMap ?? null
})
const playbackEngine = usePlaybackEngine()

function getMeasureMeta(blockId: number): TabMeasureMetaData {
  return editorCore.getMeasureMeta(blockId)
}

function getMeasureContentPadding(blockId: number): number {
  const meta = getMeasureMeta(blockId)
  let padding = 10

  if (meta.timeMeterPresent) {
    padding += 25
  }
  if (meta.repeatOpen) {
    padding += 15
  }

  return padding
}

const { rangeOverlayRect } = useOverlaySelection({
  trackId: props.trackId,
  voiceId: props.voiceId,
  rowId: props.rowData.id,
  rowData: computed(() => props.rowData),
  labelGutter: computed(() => props.labelGutter),
  numStrings,
  getMeasureContentPadding,
})

/** The loop's A/B handles in this row: at the range's start and end when they fall in it. */
const loopHandles = computed<{ edge: 'start' | 'end'; x: number }[]>(() => {
  const rect = rangeOverlayRect.value
  if (!rect || !playbackLoopState.active || !props.onLoopHandleDown) return []
  const ends = orderedRange()
  if (!ends || ends[0].trackId !== props.trackId || ends[0].voiceId !== props.voiceId) return []
  const inRow = (blockId: number) =>
    blockId >= props.rowData.startBlockId && blockId < props.rowData.startBlockId + props.rowData.measures.length
  const handles: { edge: 'start' | 'end'; x: number }[] = []
  if (inRow(ends[0].blockId)) handles.push({ edge: 'start', x: rect.x })
  if (inRow(ends[1].blockId)) handles.push({ edge: 'end', x: rect.x + rect.width })
  return handles
})

const selectionRenderPoint = computed(() => {
  if (!selectedPosition.value) {
    return null
  }

  return getSelectionRenderPoint(
    props.rowData,
    selectedPosition.value,
    props.labelGutter,
    stringSpacing,
    getMeasureContentPadding,
    props.trackId,
    props.voiceId,
    numStrings.value,
  )
})

const selectedPosition = computed<RendererSelectionPosition | null>({
  get() {
    if (!currentSelection.value) {
      return null
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
    if (
      trackId !== props.trackId
      || voiceId !== props.voiceId
      || blockId < props.rowData.startBlockId
      || blockId > props.rowData.endBlockId
    ) {
      return null
    }

    return {
      stringIndex,
      measureIndex: blockId - props.rowData.startBlockId,
      beatIndex,
      blockId,
    }
  },
  set(value) {
    if (!value) {
      setSelection(null)
      return
    }

    setSelection({
      trackId: props.trackId,
      voiceId: props.voiceId,
      blockId: value.blockId,
      beatIndex: value.beatIndex,
      stringIndex: value.stringIndex,
    })
  },
})

// Where the lyric field sits (LyricsEntryField.vue): the current verse's line, or the
// bottom of the row when it has no lyrics yet (the lyrics lane is the lowest one).
const lyricsLineTop = computed(() => {
  const lanes = props.rowData.lanes
  const top = lanes?.below.lyrics?.top ?? lanes?.bodyHeight ?? (numStrings.value - 1) * stringSpacing + 30
  return top + lyricsEntryState.verse * LANE_HEIGHTS.lyrics
})

const measureSeparators = computed(() => {
  const separators: Array<{ x: number }> = []
  for (let index = 0; index <= props.rowData.measures.length; index++) {
    separators.push({
      x: getLayoutMeasureXOffset(props.rowData.measures, index, props.labelGutter),
    })
  }

  return separators
})

function getMeasureXOffset(measureIndex: number): number {
  return getLayoutMeasureXOffset(props.rowData.measures, measureIndex, props.labelGutter)
}

function handleStringPointerDown(event: MouseEvent, stringIndex: number): void {
  if (props.onStringPointerDown) {
    props.onStringPointerDown(event, stringIndex)
    return
  }

  handleStringClick(event, stringIndex)
}

function handleStringClick(event: MouseEvent, stringIndex: number): void {
  event.stopPropagation()

  const svgElement = props.svgRoot
  if (!svgElement) {
    return
  }

  const targetPosition = clickToTabPosition(
    event,
    svgElement,
    props.rowData,
    props.labelGutter,
    getMeasureContentPadding,
    props.trackId,
    props.voiceId,
  )
  if (!targetPosition) {
    return
  }

  selectedPosition.value = {
    stringIndex,
    measureIndex: targetPosition.measureIndex,
    beatIndex: targetPosition.beatIndex,
    blockId: targetPosition.blockId,
  }
  // A click while the song plays moves playback there.
  if (playbackEngine.getPlayingState()) {
    void playbackEngine.jumpToBeat(props.trackId, targetPosition.blockId, props.voiceId, targetPosition.beatIndex)
  }
}
</script>

<style scoped>
.tab-string-line {
  stroke: var(--tab-string);
}
.tab-separator-line {
  stroke: var(--tab-separator);
}
.drum-line-label {
  fill: var(--tab-secondary);
}

.tab-label-text {
  fill: var(--tab-primary);
}
.selection-cursor {
  fill: var(--tab-cursor);
  stroke: var(--tab-cursor-border);
}
.selection-indicator--voice2 .selection-cursor {
  stroke: var(--tab-voice2);
  stroke-width: 2;
}
.selection-voice-label {
  fill: var(--tab-voice2);
}
</style> 