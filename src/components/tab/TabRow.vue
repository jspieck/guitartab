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

  <!-- Note Context Menu -->
  <NoteContextMenu
    :is-visible="contextMenu.visible"
    :note="contextMenu.note"
    :x="contextMenu.x"
    :y="contextMenu.y"
    @close="closeContextMenu"
    @toggle-effect="handleToggleEffect"
    @set-duration="handleSetDuration"
    @delete-note="handleDeleteNote"
    @copy-note="handleCopyNote"
    @paste-note="handlePasteNote"
  />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import TabMeasure from './TabMeasure.vue'
import TabMeasureInfo from './TabMeasureInfo.vue'
import NoteContextMenu from '../NoteContextMenu.vue'
import Song from '../../assets/js/songData'
import { tab } from '../../assets/js/tab'
import EventBus from '../../assets/js/eventBus'
import { getDurationInBeats, getDisplayWidth, TAB_CONSTANTS } from '../../utils/tabLayout'

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

// Context Menu state
const contextMenu = ref({
  visible: false,
  note: null as any,
  x: 0,
  y: 0
})

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
  console.log('String click:', stringIndex)
  
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
    
    // Set the selection
    selectedPosition.value = {
      stringIndex,
      measureIndex,
      beatIndex,
      blockId
    }
    
    // Update global tab selection state
    tab.markedNoteObj.blockId = blockId
    tab.markedNoteObj.beatId = beatIndex
    tab.markedNoteObj.string = stringIndex
    tab.markedNoteObj.voiceId = props.voiceId
    
    // Check for note to show context menu
    const beat = measureData[beatIndex]
    const note = beat?.notes?.[stringIndex]
    
    if (note) {
      console.log('Found note for context menu:', note)
      handleNoteContextMenu({
        note,
        x: event.clientX,
        y: event.clientY
      })
    } else {
      closeContextMenu()
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
  
  // Notify via EventBus for syncSongData to update reactive proxy
  EventBus.emit('song-data-changed')
  
  // Also dispatch DOM event for GuitarTabView
  window.dispatchEvent(new CustomEvent('songDataChanged', {
    detail: { trackId, blockId: selectedPosition.value.blockId, voiceId, beatIndex, stringIndex }
  }))
}

// Context Menu handlers
function handleNoteContextMenu(data: { note: any; x: number; y: number }) {
  contextMenu.value = {
    visible: true,
    note: data.note,
    x: data.x,
    y: data.y
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleToggleEffect(effectId: string) {
  if (!contextMenu.value.note) return
  
  const note = contextMenu.value.note
  
  if (effectId === 'bend') {
    note.bendPresent = !note.bendPresent
    if (note.bendPresent && (!note.bendObj || note.bendObj.length === 0)) {
      note.bendObj = [{ bendPosition: 0, bendValue: 0, vibrato: 0 }, { bendPosition: 60, bendValue: 4, vibrato: 0 }]
    }
  } else if (effectId === 'trill') {
    note.trillPresent = !note.trillPresent
    if (note.trillPresent && !note.trill) {
      note.trill = { fret: note.fret + 1, period: 4 }
    }
  } else if (effectId === 'ghost') {
    note.ghost = !note.ghost
  } else if (effectId === 'dead') {
    note.dead = !note.dead
  } else if (effectId === 'vibrato') {
    note.vibrato = !note.vibrato
  } else if (effectId === 'slide') {
    note.slide = !note.slide
  } else if (effectId === 'pullDown') {
    note.pullDown = !note.pullDown
  } else if (effectId === 'palmMute') {
    note.palmMute = !note.palmMute
  } else if (effectId === 'stacatto') {
    note.stacatto = !note.stacatto
  }
  
  EventBus.emit('song-data-changed')
  window.dispatchEvent(new CustomEvent('songDataChanged'))
}

function handleSetDuration(durationId: string) {
  if (!contextMenu.value.note) return
  
  const note = contextMenu.value.note
  const trackId = props.trackId
  
  // Find the beat containing this note
  // This is a bit simplified, but we'll use the tab.changeNoteDuration logic
  tab.changeNoteDuration(
    trackId,
    selectedPosition.value?.blockId || 0,
    props.voiceId,
    selectedPosition.value?.beatIndex || 0,
    selectedPosition.value?.stringIndex || 0,
    durationId as any,
    false
  )
  
  EventBus.emit('song-data-changed')
  window.dispatchEvent(new CustomEvent('songDataChanged'))
}

function handleDeleteNote() {
  if (!contextMenu.value.note) return
  
  const note = contextMenu.value.note
  const stringIndex = note.string
  
  if (selectedPosition.value && selectedPosition.value.stringIndex === stringIndex) {
    setNoteAtSelection(-1)
  } else {
    note.fret = -1
    EventBus.emit('song-data-changed')
    window.dispatchEvent(new CustomEvent('songDataChanged'))
  }
  
  closeContextMenu()
}

function handleCopyNote() {
  if (!contextMenu.value.note) return
  // Implement copy logic (e.g., to a clipboard store)
  console.log('Copy note:', contextMenu.value.note)
}

function handlePasteNote() {
  // Implement paste logic
  console.log('Paste note at selection')
  // We can use the existing paste logic from useTabSelection if we expose it
  window.dispatchEvent(new CustomEvent('pasteNote'))
}

// Close context menu on click outside
function handleGlobalClick(event: MouseEvent) {
  if (contextMenu.value.visible) {
    // Check if the click was on a note or the menu itself
    const target = event.target as HTMLElement
    if (target.closest('.note-context-menu') || target.closest('.string-click-area')) {
      return
    }
    closeContextMenu()
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick)
})

// Expose the setNoteAtSelection function to parent components
defineExpose({
  setNoteAtSelection,
  selectedPosition
})
</script>

<style scoped>
.tab-row {
  /* SVG styles are handled by attributes */
}
</style> 