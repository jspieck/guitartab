<template>
  <g class="tab-row" :transform="`translate(0, ${yOffset})`">
    <!-- Clickable string areas for note placement -->
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
        @click="(event) => handleStringClick(event, stringIndex - 1)"
        style="cursor: pointer"
      />
    </g>
    
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
      <text x="15" :y="-stringSpacing" font-family="Source Sans Pro" font-size="16px" fill="#000">T</text>
      <text x="15" y="0" font-family="Source Sans Pro" font-size="16px" fill="#000">A</text>
      <text x="15" :y="stringSpacing" font-family="Source Sans Pro" font-size="16px" fill="#000">B</text>
    </g>
    
    <!-- Measures -->
    <TabMeasure
      v-for="(measure, measureIndex) in rowData.measures"
      :key="`measure-${rowData.startBlockId + measureIndex}`"
      :measure-data="measure"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex)"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
    />
    
    <!-- Measure metadata (time signatures, BPM, etc.) -->
    <TabMeasureInfo
      v-for="(measure, measureIndex) in rowData.measures"
      :key="`measure-info-${rowData.startBlockId + measureIndex}`"
      :measure-meta="getMeasureMeta(rowData.startBlockId + measureIndex)"
      :block-id="rowData.startBlockId + measureIndex"
      :x-offset="getMeasureXOffset(measureIndex) + 10"
      :y-offset="-10"
    />
  </g>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import Song from '../../assets/js/songData'

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

// Constants
const stringSpacing = 12
const measureWidth = 200 // Base width per measure
const tabLabelWidth = 32 // Width for the TAB label

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
    currentX += measureWidth
    separators.push({ x: currentX })
  }
  
  return separators
})

// Methods
function getMeasureXOffset(measureIndex: number): number {
  const tabOffset = props.isFirstRow ? tabLabelWidth : 0
  return tabOffset + (measureIndex * measureWidth)
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

function handleStringClick(event: MouseEvent, stringIndex: number) {
  event.stopPropagation()
  
  console.log('=== STRING CLICK DEBUG ===')
  console.log('String clicked, stringIndex:', stringIndex)
  
  // Get the SVG root element, not just the closest svg
  const svgElement = document.querySelector('.tab-svg') as SVGSVGElement
  if (!svgElement) {
    console.log('No SVG element found')
    return
  }
  
  // Get the clicked element's position
  const clickedRect = (event.target as SVGElement)
  const svgRect = svgElement.getBoundingClientRect()
  
  // Calculate the actual click position in SVG coordinates
  const svgPoint = svgElement.createSVGPoint()
  svgPoint.x = event.clientX
  svgPoint.y = event.clientY
  const transformedPoint = svgPoint.matrixTransform(svgElement.getScreenCTM()?.inverse())
  
  console.log('SVG coordinates:', { x: transformedPoint.x, y: transformedPoint.y })
  console.log('Row yOffset:', props.yOffset)
  console.log('String spacing:', stringSpacing)
  
  // Adjust for the main SVG padding and row transform
  const paddingLeft = svgRect.width * (1 / 21) // Same as in GuitarTabView
  const adjustedX = transformedPoint.x - paddingLeft
  
  console.log('Adjusted X after padding:', adjustedX)
  
  // Calculate which measure and beat was clicked
  const tabOffset = props.isFirstRow ? tabLabelWidth : 0
  const relativeX = adjustedX - tabOffset
  
  console.log('Relative X calculation:', { 
    relativeX, 
    tabOffset,
    measureWidth 
  })
  
  // Find the measure
  const measureIndex = Math.floor(relativeX / measureWidth)
  console.log('Calculated measureIndex:', measureIndex)
  
  if (measureIndex >= 0 && measureIndex < props.rowData.measures.length) {
    // Calculate beat within the measure (4 beats per measure)
    const beatX = relativeX % measureWidth
    const beatIndex = Math.floor(beatX / (measureWidth / 4))
    const blockId = props.rowData.startBlockId + measureIndex
    
    console.log('Setting selection:', {
      stringIndex,
      measureIndex, 
      beatIndex,
      blockId,
      beatX,
      relativeX
    })
    
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
    
    console.log('Selection set and event dispatched')
    console.log('=== END DEBUG ===')
  } else {
    console.log('Click outside valid measure range, measureIndex:', measureIndex)
    console.log('Available measures:', props.rowData.measures.length)
    console.log('=== END DEBUG ===')
  }
}

function getSelectionX(): number {
  if (!selectedPosition.value) return 0
  
  const tabOffset = props.isFirstRow ? tabLabelWidth : 0
  const measureX = selectedPosition.value.measureIndex * measureWidth
  const beatX = selectedPosition.value.beatIndex * (measureWidth / 4) + (measureWidth / 8) // Center of beat
  
  return tabOffset + measureX + beatX
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
  
  console.log('Setting note at selection:', { trackId, blockId, voiceId, beatIndex, stringIndex, fret })
  
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
    // Remove note
    beat.notes[stringIndex] = null
    console.log(`Removed note from string ${stringIndex}`)
  } else {
    // Set note
    beat.notes[stringIndex] = {
      ...Song.defaultNote(),
      fret,
      string: stringIndex
    }
    console.log(`Set note: fret ${fret} on string ${stringIndex}`)
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