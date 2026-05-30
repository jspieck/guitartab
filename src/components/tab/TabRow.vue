<template>
  <g class="tab-row" :transform="`translate(0, ${yOffset})`">
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
    
    <!-- Selection indicator -->
    <g v-if="selectionRenderPoint" class="selection-indicator" style="pointer-events: none">
      <rect
        :x="selectionRenderPoint.x - 10"
        :y="selectionRenderPoint.y - 8"
        width="20"
        height="16"
        fill="rgba(74, 144, 226, 0.2)"
        stroke="#4A90E2"
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
      style="pointer-events: none"
    />
    
    <!-- Measure metadata (time signatures, BPM, etc.) -->
    <TabMeasureInfo
      v-for="(measureObj, measureIndex) in rowData.measures"
      :key="`info-${rowData.startBlockId + measureIndex}`"
      :measure-meta="getMeasureMeta(rowData.startBlockId + measureIndex)"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex)"
      :y-offset="stringSpacing * 2.5"
      :content-padding="getMeasureContentPadding(rowData.startBlockId + measureIndex)"
      style="pointer-events: none"
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
        fill="rgba(0, 0, 0, 0)"
        class="string-click-area"
        @click="(event: MouseEvent) => handleStringClick(event, stringIndex - 1)"
        style="cursor: pointer"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import { useTabSelection } from '../../composables/useTabSelection'
import legacyEditorCore from '../../services/legacy/editorCoreAdapter'
import type {
  RenderedTabRow,
  RendererSelectionPosition,
  TabMeasureMetaData,
  TabNoteData,
} from '../../types/tab'
import {
  clickToTabPosition,
  getMeasureXOffset as getLayoutMeasureXOffset,
  getSelectionRenderPoint,
  getSvgPageMargins,
  getSvgScreenPoint,
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
}

const props = withDefaults(defineProps<Props>(), {
  isFirstRow: false,
})

const { STRING_SPACING } = TAB_CONSTANTS
const stringSpacing = STRING_SPACING

const {
  currentSelection,
  setSelection,
  showContextMenu,
  hideContextMenu,
} = useTabSelection()

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

watch(() => currentSelection.value, (selection) => {
  if (!selection) {
    hideContextMenu()
    return
  }

  if (
    selection.trackId !== props.trackId
    || selection.voiceId !== props.voiceId
    || selection.blockId < props.rowData.startBlockId
    || selection.blockId > props.rowData.endBlockId
  ) {
    return
  }

  const measureIndex = selection.blockId - props.rowData.startBlockId
  const beat = props.rowData.measures[measureIndex]?.data?.[selection.beatIndex]
  const note = beat?.notes?.[selection.stringIndex] as TabNoteData | null | undefined

  if (!note) {
    hideContextMenu()
    return
  }

  window.setTimeout(() => {
    const pos = getSelectionScreenPos()
    if (pos) {
      showContextMenu({ ...note, duration: beat?.duration || 'q' }, pos.x, pos.y)
    }
  }, 0)
}, { deep: true })

function getSelectionScreenPos(): { x: number; y: number } | null {
  if (!selectionRenderPoint.value) {
    return null
  }

  const svgElement = props.svgRoot
  if (!svgElement) {
    return null
  }

  const margins = getSvgPageMargins(svgElement)
  return getSvgScreenPoint(svgElement, {
    x: selectionRenderPoint.value.x + margins.left,
    y: selectionRenderPoint.value.y + props.yOffset + margins.top,
  })
}

const numStrings = computed(() => legacyEditorCore.getTrackStringCount(props.trackId))

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

function getMeasureMeta(blockId: number): TabMeasureMetaData {
  return legacyEditorCore.getMeasureMeta(blockId)
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