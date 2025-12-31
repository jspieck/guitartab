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
        stroke="#cccccc"
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
        stroke="#333333"
        stroke-width="1"
      />
    </g>
    
    <!-- TAB label for first row -->
    <g v-if="isFirstRow" class="tab-label">
      <text x="15" :y="stringSpacing * 1.5" font-family="Source Sans Pro" font-size="16px" fill="#000" text-anchor="middle">T</text>
      <text x="15" :y="stringSpacing * 3.0" font-family="Source Sans Pro" font-size="16px" fill="#000" text-anchor="middle">A</text>
      <text x="15" :y="stringSpacing * 4.5" font-family="Source Sans Pro" font-size="16px" fill="#000" text-anchor="middle">B</text>
    </g>
    
    <!-- Measures -->
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
    />
    
    <!-- Measure metadata (time signatures, BPM, etc.) -->
    <TabMeasureInfo
      v-for="(measureObj, measureIndex) in rowData.measures"
      :key="`measure-info-${rowData.startBlockId + measureIndex}`"
      :measure-meta="getMeasureMeta(rowData.startBlockId + measureIndex)"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex) + 10"
      :y-offset="(numStrings - 1) * stringSpacing / 2"
    />
    
    <!-- Selection indicators -->
    <g v-if="selectedPosition" class="selection-indicator">
      <rect
        :x="getSelectionX() - 8"
        :y="getSelectionY() - 8"
        width="16"
        height="16"
        fill="rgba(74, 144, 226, 0.3)"
        stroke="#4A90E2"
        stroke-width="2"
        rx="3"
        class="selection-highlight"
      />
    </g>
    
    <!-- Clickable string areas for note placement - must be last to be on top -->
    <g class="clickable-strings">
      <rect
        v-for="stringIndex in numStrings"
        :key="`click-area-${stringIndex}`"
        :x="0"
        :y="(stringIndex - 1) * stringSpacing - 6"
        :width="width"
        :height="12"
        fill="rgba(0, 0, 255, 0.02)"
        stroke="rgba(0, 0, 255, 0.1)"
        stroke-width="0.5"
        class="string-click-area"
        @click="(event: MouseEvent) => handleStringClick(event, stringIndex - 1)"
        style="cursor: pointer"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import Song from '../../assets/js/songData'
import { getDurationInBeats, TAB_CONSTANTS } from '../../utils/tabLayout'

// Local type definitions to avoid import issues
interface TabRow {
  id: number
  measures: any[]
  startBlockId: number
  endBlockId: number
  yOffset: number
}

// Props
interface Props {
  rowData: TabRow
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
const { STRING_SPACING, MEASURE_WIDTH, BEAT_WIDTH, TAB_LABEL_WIDTH, START_PADDING } = TAB_CONSTANTS
const stringSpacing = STRING_SPACING
const measureWidth = MEASURE_WIDTH
const beatWidth = BEAT_WIDTH
const tabLabelWidth = TAB_LABEL_WIDTH

// Selection state
const selectedPosition = ref<{
  stringIndex: number
  measureIndex: number
  beatIndex: number
  blockId: number
} | null>(null)

// Computed properties
const numStrings = computed(() => {
  // Get from actual track data
  return Song.tracks?.[props.trackId]?.numStrings || 6
})

const measureSeparators = computed(() => {
  const separators = []
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

function getMeasureMeta(blockId: number) {
  return Song.measureMeta?.[blockId] || {
    numerator: 4,
    denominator: 4,
    timeMeterPresent: false,
    bpmPresent: false,
    bpm: 120,
    repeatOpen: false,
    repeatClosePresent: false,
    repeatClose: 0,
    repeatAlternativePresent: false,
    repeatAlternative: 0,
    markerPresent: false,
    marker: { text: '', color: { red: 0, green: 0, blue: 0 } }
  }
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
  
  // Get SVG bounding rect for padding calculation
  const svgRect = svgElement.getBoundingClientRect()
  
  // Calculate the click position in SVG coordinates
  const svgPoint = svgElement.createSVGPoint()
  svgPoint.x = event.clientX
  svgPoint.y = event.clientY
  const transformedPoint = svgPoint.matrixTransform(svgElement.getScreenCTM()?.inverse())
  
  // Adjust for the main SVG padding and row transform
  const paddingLeft = svgRect.width * (1 / 21) // Same as in GuitarTabView
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
    const measureData = props.rowData.measures[measureIndex].data
    let currentBeatX = 0
    let foundBeatIndex = -1
    
    // Iterate through beats to find the one at this position
    for (let i = 0; i < measureData.length; i++) {
      const beat = measureData[i]
      const duration = getDurationInBeats(beat?.duration || 'q')
      const width = duration * beatWidth
      
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
    
    // Set the selection
    selectedPosition.value = {
      stringIndex,
      measureIndex,
      beatIndex,
      blockId
    }
    
    // Emit selection event
    const selectionEvent = new CustomEvent('noteSelected', {
      detail: {
        trackId: props.trackId,
        voiceId: props.voiceId,
        blockId,
        beatIndex,
        stringIndex
      }
    })
    window.dispatchEvent(selectionEvent)
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
  const measureData = props.rowData.measures[selectedPosition.value.measureIndex].data
  if (measureData) {
    for (let i = 0; i < selectedPosition.value.beatIndex; i++) {
      const beat = measureData[i]
      const duration = getDurationInBeats(beat?.duration || 'q')
      beatX += duration * beatWidth
    }
    // Add half of the current beat's width to center the selection
    const currentBeat = measureData[selectedPosition.value.beatIndex]
    const currentDuration = getDurationInBeats(currentBeat?.duration || 'q')
    beatX += (currentDuration * beatWidth) / 2
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
  
  // Ensure the measure structure exists
  if (!Song.measures[trackId]) Song.measures[trackId] = []
  if (!Song.measures[trackId][blockId]) Song.measures[trackId][blockId] = []
  if (!Song.measures[trackId][blockId][voiceId]) Song.measures[trackId][blockId][voiceId] = []
  if (!Song.measures[trackId][blockId][voiceId][beatIndex]) {
    Song.measures[trackId][blockId][voiceId][beatIndex] = {
      ...Song.defaultMeasure(),
      duration: 'quarter'
    }
  }
  
  const beat = Song.measures[trackId][blockId][voiceId][beatIndex]
  
  // Ensure notes array exists
  if (!beat.notes) {
    beat.notes = new Array(6).fill(null)
  }
  
  if (fret === -1) {
    beat.notes[stringIndex] = null
  } else {
    beat.notes[stringIndex] = {
      ...Song.defaultNote(),
      fret,
      string: stringIndex
    }
  }
  
  // Force reactivity update
  const event = new CustomEvent('songDataChanged', {
    detail: { trackId, blockId, voiceId, beatIndex, stringIndex }
  })
  window.dispatchEvent(event)
}

// Expose the setNoteAtSelection function to parent components
defineExpose({
  setNoteAtSelection,
  selectedPosition: selectedPosition.value
})
</script>

<style scoped>
.tab-row {
  /* SVG styles are handled by attributes */
}
</style> 