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
    <g v-if="selectedPosition" class="selection-indicator" style="pointer-events: none">
      <rect
        :x="getSelectionX() - 10"
        :y="getSelectionY() - 8"
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
import EventBus from '../../assets/js/eventBus'
import { typedEventBus } from '../../utils/typedEventBus'
import { useTabSelection } from '../../composables/useTabSelection'
import { legacyEditorCore } from '../../services/legacy/editorCoreAdapter'
import { getDisplayWidth, getPageMargins, TAB_CONSTANTS } from '../../utils/tabLayout'
import type {
  RendererSelectionPosition,
  RenderedTabRow,
  TabBeat,
  TabMeasureMetaData,
} from '../../types/tab'

// Props
interface Props {
  rowData: RenderedTabRow
  trackId: number
  voiceId: number
  yOffset: number
  width: number
  isFirstRow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFirstRow: false
})

// Constants from centralized layout utilities
const { STRING_SPACING, MEASURE_WIDTH, TAB_LABEL_WIDTH, START_PADDING } = TAB_CONSTANTS
const stringSpacing = STRING_SPACING
const measureWidth = MEASURE_WIDTH
const tabLabelWidth = TAB_LABEL_WIDTH

const { 
  currentSelection, 
  setSelection, 
  showContextMenu, 
  hideContextMenu 
} = useTabSelection()

// Selection state - derived from global selection
const selectedPosition = computed<RendererSelectionPosition | null>({
  get() {
    if (!currentSelection.value) return null
    
    const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
    
    // Check if this selection belongs to this row
    if (trackId === props.trackId && 
        voiceId === props.voiceId && 
        blockId >= props.rowData.startBlockId && 
        blockId <= props.rowData.endBlockId) {
      
      return {
        stringIndex,
        measureIndex: blockId - props.rowData.startBlockId,
        beatIndex,
        blockId
      }
    }
    
    return null
  },
  set(val) {
    if (val) {
      setSelection({
        trackId: props.trackId,
        voiceId: props.voiceId,
        blockId: val.blockId,
        beatIndex: val.beatIndex,
        stringIndex: val.stringIndex
      })
    } else {
      setSelection(null)
    }
  }
})

// Watch for selection changes to show context menu
watch(() => currentSelection.value, (newSelection) => {
  if (newSelection && 
      newSelection.trackId === props.trackId && 
      newSelection.voiceId === props.voiceId && 
      newSelection.blockId >= props.rowData.startBlockId && 
      newSelection.blockId <= props.rowData.endBlockId) {
    
    const measureIndex = newSelection.blockId - props.rowData.startBlockId
    const measureData = props.rowData.measures[measureIndex]?.data ?? []
    const note = measureData?.[newSelection.beatIndex]?.notes?.[newSelection.stringIndex] ?? null
    
    if (note) {
      setTimeout(() => {
        const pos = getSelectionScreenPos()
        if (pos) {
          showContextMenu(note, pos.x, pos.y)
        }
      }, 0)
    } else {
      hideContextMenu()
    }
  } else {
    // Only hide if the selection moved to a different row entirely
    // (If it moved within this row but not on a note, hideContextMenu is called above)
    if (newSelection && (newSelection.trackId !== props.trackId || 
        newSelection.voiceId !== props.voiceId || 
        newSelection.blockId < props.rowData.startBlockId || 
        newSelection.blockId > props.rowData.endBlockId)) {
      // We don't hide here because another row might be showing it
    }
  }
}, { deep: true })

function getSelectionScreenPos() {
  if (!selectedPosition.value) return null
  
  const x = getSelectionX()
  const y = getSelectionY()
  
  const svgElement = document.querySelector('.tab-svg') as SVGSVGElement
  if (!svgElement) return null
  
  const pt = svgElement.createSVGPoint()
  
  // Get the main group transform (paddingLeft, paddingTop)
  // These should match the calculations in GuitarTabView.vue
  const margins = getPageMargins()
  const paddingLeft = margins.left
  const paddingTop = margins.top
  
  pt.x = x + paddingLeft
  pt.y = y + props.yOffset + paddingTop
  
  const ctm = svgElement.getScreenCTM()
  if (!ctm) return null
  
  const screenPos = pt.matrixTransform(ctm)
  return { x: screenPos.x, y: screenPos.y }
}

// Computed properties
const numStrings = computed(() => {
  // Get from actual track data
  return legacyEditorCore.getTrackStringCount(props.trackId)
})

const measureSeparators = computed<{ x: number }[]>(() => {
  const separators: { x: number }[] = []
  let currentX = props.isFirstRow ? tabLabelWidth : 0
  
  // Start separator
  separators.push({ x: currentX })
  
  // Separators between measures
  for (let i = 0; i < props.rowData.measures.length; i++) {
    const measure = props.rowData.measures[i]
    currentX += measure.width || measureWidth
    separators.push({ x: currentX })
  }
  
  return separators
})

// Methods
function getMeasureXOffset(measureIndex: number): number {
  let offset = props.isFirstRow ? tabLabelWidth : 0
  for (let i = 0; i < measureIndex; i++) {
    const measure = props.rowData.measures[i]
    offset += measure.width || measureWidth
  }
  return offset
}

function getMeasureMeta(blockId: number): TabMeasureMetaData {
  return legacyEditorCore.getMeasureMeta(blockId)
}

function getMeasureContentPadding(blockId: number): number {
  const meta = getMeasureMeta(blockId)
  let padding = 10 // Default padding
  if (meta.timeMeterPresent) {
    padding += 25 // Space for time signature
  }
  if (meta.repeatOpen) {
    padding += 15
  }
  return padding
}

function handleStringClick(event: MouseEvent, stringIndex: number) {
  event.stopPropagation()
  
  // Get the SVG root element
  const svgElement = document.querySelector('.tab-svg') as SVGSVGElement
  if (!svgElement) return
  const screenMatrix = svgElement.getScreenCTM()
  if (!screenMatrix) return
  
  // Calculate the click position in SVG coordinates
  const svgPoint = svgElement.createSVGPoint()
  svgPoint.x = event.clientX
  svgPoint.y = event.clientY
  const transformedPoint = svgPoint.matrixTransform(screenMatrix.inverse())
  
  // Adjust for the main SVG padding and row transform
  const margins = getPageMargins()
  const paddingLeft = margins.left // Same as in GuitarTabView
  const adjustedX = transformedPoint.x - paddingLeft
  
  // Calculate which measure was clicked
  const tabOffset = props.isFirstRow ? tabLabelWidth : 0
  const relativeX = adjustedX - tabOffset
  
  // Find the measure at click position
  let currentX = 0
  let foundMeasureIndex = -1
  let measureRelativeX = 0
  
  for (let i = 0; i < props.rowData.measures.length; i++) {
    const measure = props.rowData.measures[i]
    const width = measure.width || measureWidth
    
    if (relativeX >= currentX && relativeX < currentX + width) {
      foundMeasureIndex = i
      measureRelativeX = relativeX - currentX
      break
    }
    currentX += width
  }
  
  if (foundMeasureIndex !== -1) {
    const measureIndex = foundMeasureIndex
    const blockId = props.rowData.startBlockId + measureIndex
    const padding = getMeasureContentPadding(blockId) + START_PADDING
    
    const beatX = measureRelativeX - padding
    
    // Find which beat corresponds to this X position
    const measureData = props.rowData.measures[measureIndex]?.data ?? []
    if (measureData.length === 0) {
      return
    }
    let currentBeatX = 0
    let foundBeatIndex = -1
    
    // Iterate through beats to find the one at this position
    for (let i = 0; i < measureData.length; i++) {
      const beat = measureData[i]
      const width = getDisplayWidth(beat?.duration)
      
      if (beatX >= currentBeatX && beatX < currentBeatX + width) {
        foundBeatIndex = i
        break
      }
      
      currentBeatX += width
    }
    
    // If we didn't find a beat, clamp to valid range
    if (foundBeatIndex === -1) {
      foundBeatIndex = beatX < 0 ? 0 : measureData.length - 1
    }
    
    const beatIndex = Math.max(0, Math.min(foundBeatIndex, measureData.length - 1))
    
    // Set the selection (this triggers the global state and the watcher)
    selectedPosition.value = {
      stringIndex,
      measureIndex,
      beatIndex,
      blockId
    }

    typedEventBus.emit('selection.changed', {
      trackId: props.trackId,
      voiceId: props.voiceId,
      blockId,
      beatIndex,
      stringIndex
    })
  }
}

function getSelectionX(): number {
  if (!selectedPosition.value) return 0
  
  const tabOffset = props.isFirstRow ? tabLabelWidth : 0
  
  // Calculate X offset for the measure
  let measureX = 0
  for (let i = 0; i < selectedPosition.value.measureIndex; i++) {
    const measure = props.rowData.measures[i]
    measureX += measure.width || measureWidth
  }
  
  // Get padding for this specific measure
  const padding = getMeasureContentPadding(selectedPosition.value.blockId) + START_PADDING
  
  // Calculate beat X position based on variable durations
  let beatX = 0
  const measureData = props.rowData.measures[selectedPosition.value.measureIndex]?.data ?? []
  if (measureData) {
    for (let i = 0; i < selectedPosition.value.beatIndex; i++) {
      const beat = measureData[i]
      beatX += getDisplayWidth(beat?.duration)
    }
    // Add half of the current beat's display width to center the selection
    const currentBeat = measureData[selectedPosition.value.beatIndex]
    beatX += getDisplayWidth(currentBeat?.duration) / 2
  }
  
  return tabOffset + measureX + padding + beatX
}

function getSelectionY(): number {
  if (!selectedPosition.value) return 0
  return selectedPosition.value.stringIndex * stringSpacing
}

function setNoteAtSelection(fret: number) {
  if (!selectedPosition.value) return
  
  const { stringIndex, blockId, beatIndex } = selectedPosition.value
  const trackId = props.trackId
  const voiceId = props.voiceId

  const beat = legacyEditorCore.ensureBeatAtPosition(trackId, blockId, voiceId, beatIndex, numStrings.value) as TabBeat
  
  if (fret === -1) {
    beat.notes[stringIndex] = null
  } else {
    beat.notes[stringIndex] = {
      ...legacyEditorCore.defaultNote(),
      fret,
      string: stringIndex
    }
  }
  
  EventBus.emit('song-data-changed')
}

// Expose the setNoteAtSelection function to parent components
defineExpose({
  setNoteAtSelection,
  selectedPosition
})
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