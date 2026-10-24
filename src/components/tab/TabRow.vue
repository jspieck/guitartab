<template>
  <g class="tab-row" :data-row-id="rowData.id" :transform="`translate(0, ${yOffset})`">
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
    
    <!-- TAB label for first row -->
    <g v-if="isFirstRow" class="tab-label">
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

    <!-- Selection indicator -->
    <g v-if="selectionRenderPoint" class="selection-indicator" pointer-events="none">
      <rect
        :x="selectionRenderPoint.x - 10"
        :y="selectionRenderPoint.y - 8"
        width="20"
        height="16"
        style="fill: var(--tab-cursor); stroke: var(--tab-cursor-border)"
        stroke-width="1"
        rx="2"
      />
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
        @mousedown="(event: MouseEvent) => handleStringPointerDown(event, stringLine(stringIndex - 1, numStrings))"
        cursor="pointer"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { stringLine } from '../../utils/tabStrings'
import { computed } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import { useOverlaySelection } from '../../composables/useOverlaySelection'
import { useTabSelection } from '../../composables/useTabSelection'
import { usePlaybackEngine } from '../../composables/usePlaybackEngine'
import editorCore from '../../services/editor/editorCore'
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
  isFirstRow?: boolean
  onStringPointerDown?: (event: MouseEvent, stringIndex: number) => void
}

const props = withDefaults(defineProps<Props>(), {
  isFirstRow: false,
  onStringPointerDown: undefined,
})

const { STRING_SPACING } = TAB_CONSTANTS
const stringSpacing = STRING_SPACING

const {
  currentSelection,
  setSelection,
} = useTabSelection()

const numStrings = computed(() => editorCore.getTrackStringCount(props.trackId))
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
  isFirstRow: computed(() => props.isFirstRow),
  numStrings,
  getMeasureContentPadding,
})

const selectionRenderPoint = computed(() => {
  if (!selectedPosition.value) {
    return null
  }

  return getSelectionRenderPoint(
    props.rowData,
    selectedPosition.value,
    props.isFirstRow,
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

const measureSeparators = computed(() => {
  const separators: Array<{ x: number }> = []
  for (let index = 0; index <= props.rowData.measures.length; index++) {
    separators.push({
      x: getLayoutMeasureXOffset(props.rowData.measures, index, props.isFirstRow),
    })
  }

  return separators
})

function getMeasureXOffset(measureIndex: number): number {
  return getLayoutMeasureXOffset(props.rowData.measures, measureIndex, props.isFirstRow)
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
    props.isFirstRow,
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
.tab-label-text {
  fill: var(--tab-primary);
}
</style> 