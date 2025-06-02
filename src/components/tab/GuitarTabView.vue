<template>
  <div class="guitar-tab-view" ref="tabContainer">
    <svg 
      :width="pageWidth" 
      :height="totalHeight"
      class="tab-svg"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @keydown="handleKeyDown"
      tabindex="0"
    >
      <!-- Simple tab content for now -->
      <g :transform="`translate(${paddingLeft}, ${paddingTop})`">
        <!-- Tab header info -->
        <g v-if="showTabInfo">
          <text 
            :x="tabGroupWidth / 2" 
            y="30" 
            font-family="Source Sans Pro" 
            font-size="24px" 
            fill="#000"
            text-anchor="middle"
          >
            {{ songTitle }}
          </text>
          <text 
            :x="tabGroupWidth / 2" 
            y="55" 
            font-family="Source Sans Pro" 
            font-size="16px" 
            fill="#666"
            text-anchor="middle"
          >
            {{ songAuthor }}
          </text>
          
          <!-- Help text -->
          <text 
            :x="tabGroupWidth / 2" 
            y="75" 
            font-family="Source Sans Pro" 
            font-size="12px" 
            fill="#999"
            text-anchor="middle"
          >
            Click strings to select • Type 0-9 for fret • Delete to remove • Press T for toolbar
          </text>
          
          <!-- Selection indicator -->
          <text 
            v-if="currentSelection"
            :x="tabGroupWidth / 2" 
            y="90" 
            font-family="Source Sans Pro" 
            font-size="10px" 
            fill="#4A90E2"
            text-anchor="middle"
          >
            Selected: String {{ currentSelection.stringIndex + 1 }}, Measure {{ currentSelection.blockId + 1 }}, Beat {{ currentSelection.beatIndex + 1 }}
          </text>
          
          <!-- Debug refresh button -->
          <rect 
            x="50" 
            y="85" 
            width="80" 
            height="20" 
            fill="#f0f0f0" 
            stroke="#ccc" 
            rx="3"
            style="cursor: pointer"
            @click="forceRefresh"
          />
          <text 
            x="90" 
            y="98" 
            font-family="Source Sans Pro" 
            font-size="10px" 
            fill="#333"
            text-anchor="middle"
            style="cursor: pointer; user-select: none"
            @click="forceRefresh"
          >
            Force Refresh
          </text>
          
          <!-- Debug data button -->
          <rect 
            x="140" 
            y="85" 
            width="80" 
            height="20" 
            fill="#e8f4fd" 
            stroke="#4A90E2" 
            rx="3"
            style="cursor: pointer"
            @click="debugSongData"
          />
          <text 
            x="180" 
            y="98" 
            font-family="Source Sans Pro" 
            font-size="10px" 
            fill="#4A90E2"
            text-anchor="middle"
            style="cursor: pointer; user-select: none"
            @click="debugSongData"
          >
            Show Data
          </text>
        </g>
        
        <!-- Simple tab rows -->
        <TabRow
          v-for="(row, rowIndex) in tabRows"
          :key="`row-${rowIndex}`"
          :row-data="row"
          :track-id="trackId"
          :voice-id="voiceId"
          :y-offset="getRowYOffset(rowIndex)"
          :width="tabGroupWidth"
          :is-first-row="rowIndex === 0"
        />
      </g>
    </svg>
    
    <!-- Toolbar -->
    <TabToolbar
      :is-visible="toolbarVisible"
      :selected-note="selectedNote"
      @apply-effect="handleApplyEffect"
      @set-duration="handleSetDuration"
      @clear-selection="handleClearSelection"
      @copy-selection="handleCopySelection"
      @paste-selection="handlePasteSelection"
      @delete-selection="handleDeleteSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TabRow from './TabRow.vue'
import Song from '../../assets/js/songData'
import TabToolbar from './TabToolbar.vue'

// Props
interface Props {
  trackId: number
  voiceId: number
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 1200,
  height: 1600
})

// Refs
const tabContainer = ref<HTMLElement>()
const updateTrigger = ref(0) // Force reactivity updates
const currentSelection = ref<any>(null)
const toolbarVisible = ref(false)
const selectedNote = ref<any>(null)

// Constants
const PAGE_MARGIN_SIDE = computed(() => props.width * (1 / 21))
const PAGE_MARGIN_TOP = computed(() => props.height * (1 / 29.7))
const paddingLeft = PAGE_MARGIN_SIDE
const paddingTop = PAGE_MARGIN_TOP
const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
const pageWidth = props.width
const pageHeight = props.height
const rowHeight = 120

// Computed properties
const songTitle = computed(() => Song.songDescription?.title || 'Untitled')
const songAuthor = computed(() => Song.songDescription?.author || 'Unknown Artist')
const showTabInfo = computed(() => true)

const tabRows = computed(() => {
  // Add reactivity trigger to force re-computation
  updateTrigger.value // This ensures the computed re-runs when updateTrigger changes
  
  console.log('=== COMPUTING TAB ROWS ===')
  console.log('Update trigger:', updateTrigger.value)
  
  interface TabRowData {
    id: number
    measures: any[]
    startBlockId: number
    endBlockId: number
    yOffset: number
  }
  
  const rows: TabRowData[] = []
  
  // Debug logging
  console.log('Song object:', Song)
  console.log('Song.measures:', Song.measures)
  console.log('TrackId:', props.trackId, 'VoiceId:', props.voiceId)
  
  // Initialize Song if needed
  if (!Song.measures || Song.measures.length === 0) {
    console.log('Initializing empty song...')
    Song.initEmptySong()
  }
  
  // Get measures from Song data
  const measures = Song.measures?.[props.trackId] || []
  console.log('Measures for track:', measures)
  console.log('Number of measures:', measures.length)
  
  if (measures.length === 0) {
    console.log('No measures found, creating sample data...')
    // Create some sample measures for demonstration
    rows.push({
      id: 0,
      measures: [
        // Sample measure data
        [
          { duration: 'quarter', notes: [null, null, { fret: 3, string: 3 }, null, null, null] },
          { duration: 'quarter', notes: [null, null, null, { fret: 2, string: 2 }, null, null] },
          { duration: 'quarter', notes: [{ fret: 0, string: 0 }, null, null, null, null, null] },
          { duration: 'quarter', notes: [null, null, null, null, null, null] }
        ]
      ],
      startBlockId: 0,
      endBlockId: 0,
      yOffset: 0
    })
    console.log('=== END COMPUTING TAB ROWS ===')
    return rows
  }

  // Simple implementation - put 4 measures per row
  const measuresPerRow = 4
  for (let i = 0; i < measures.length; i += measuresPerRow) {
    const rowMeasures = measures.slice(i, i + measuresPerRow)
    
    // Get the voice data for each measure - the data structure is [blockId][voiceId][beatId]
    const measureData = rowMeasures.map((measure, measureIndex) => {
      const actualBlockId = i + measureIndex
      console.log(`Processing measure ${actualBlockId}:`, measure)
      
      if (measure && measure[props.voiceId]) {
        const voiceData = measure[props.voiceId] // This gives us the beats for this voice
        console.log(`Voice ${props.voiceId} data for measure ${actualBlockId}:`, voiceData)
        return voiceData
      }
      return []
    })
    
    console.log('Row measure data:', measureData)
    
    rows.push({
      id: Math.floor(i / measuresPerRow),
      measures: measureData,
      startBlockId: i,
      endBlockId: Math.min(i + measuresPerRow - 1, measures.length - 1),
      yOffset: 0 // Will be calculated in getRowYOffset
    })
  }
  
  console.log('Final tab rows:', rows)
  console.log('=== END COMPUTING TAB ROWS ===')
  return rows
})

const totalHeight = computed(() => {
  const headerHeight = 80
  const tabContentHeight = tabRows.value.length * rowHeight
  return headerHeight + tabContentHeight + 100 // Some bottom padding
})

// Methods
function getRowYOffset(rowIndex: number): number {
  const headerHeight = 80
  return headerHeight + (rowIndex * rowHeight)
}

function handleMouseDown(event: MouseEvent) {
  // Handle tab interaction - simplified for now
  console.log('Tab clicked', event)
}

function handleMouseMove(event: MouseEvent) {
  // Handle hover effects
}

function handleMouseUp(event: MouseEvent) {
  // Handle selection end
}

function handleKeyDown(event: KeyboardEvent) {
  console.log('Key pressed:', event.key)
  
  // Handle number keys for fret input
  if (event.key >= '0' && event.key <= '9') {
    const fretNumber = parseInt(event.key, 10)
    if (currentSelection.value) {
      console.log(`Setting fret ${fretNumber} at current selection`)
      setNoteAtCurrentSelection(fretNumber)
      event.preventDefault()
    }
  }
  
  // Handle special keys
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      if (currentSelection.value) {
        console.log('Deleting note at current selection')
        setNoteAtCurrentSelection(-1) // -1 means delete
        event.preventDefault()
      }
      break
      
    case 't':
    case 'T':
      toolbarVisible.value = !toolbarVisible.value
      console.log('Toolbar toggled:', toolbarVisible.value)
      event.preventDefault()
      break
      
    case 'h':
    case 'H':
      console.log('Help: Click strings to select, then press 0-9 for fret numbers, Delete to remove, T for toolbar')
      break
      
    case 'Escape':
      currentSelection.value = null
      toolbarVisible.value = false
      console.log('Selection cleared and toolbar hidden')
      break
  }
}

// Listen for note selection events
function handleNoteSelection(event: Event) {
  const detail = (event as CustomEvent).detail
  currentSelection.value = detail
  
  // Get the selected note data for the toolbar
  if (detail) {
    const { trackId, voiceId, blockId, beatIndex, stringIndex } = detail
    const beat = Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
    const note = beat?.notes?.[stringIndex]
    selectedNote.value = note || null
    console.log('Selected note for toolbar:', selectedNote.value)
  } else {
    selectedNote.value = null
  }
  
  console.log('Note selected:', detail)
}

// Lifecycle
onMounted(() => {
  console.log('Tab view mounted', {
    trackId: props.trackId,
    voiceId: props.voiceId,
    measures: Song.measures?.[props.trackId]?.length || 0
  })
  
  // Add some sample notes for demonstration
  addSampleNotes()
  
  // Listen for Song data changes
  window.addEventListener('songDataChanged', handleSongDataChange)
  
  // Listen for note selection events
  window.addEventListener('noteSelected', handleNoteSelection)
  
  // Focus the SVG element to receive keyboard events
  if (tabContainer.value) {
    const svgElement = tabContainer.value.querySelector('svg')
    if (svgElement) {
      svgElement.focus()
    }
  }
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('songDataChanged', handleSongDataChange)
  window.removeEventListener('noteSelected', handleNoteSelection)
})

// Handle Song data changes
function handleSongDataChange(event: Event) {
  console.log('Song data changed:', (event as CustomEvent).detail)
  updateTrigger.value++ // Force Vue to re-render
}

// Helper function to add sample notes
function addSampleNotes() {
  // Initialize if needed
  if (!Song.measures || Song.measures.length === 0) {
    Song.initEmptySong()
  }
  
  const trackId = props.trackId
  const voiceId = props.voiceId
  
  // Add some sample notes to demonstrate the components
  if (Song.measures[trackId] && Song.measures[trackId][0] && Song.measures[trackId][0][voiceId]) {
    // First measure - simple chord
    Song.measures[trackId][0][voiceId][0] = {
      ...Song.defaultMeasure(),
      duration: 'quarter',
      notes: [
        null,
        null, 
        { ...Song.defaultNote(), fret: 3, string: 2 }, // G string, 3rd fret
        { ...Song.defaultNote(), fret: 2, string: 3 }, // D string, 2nd fret  
        { ...Song.defaultNote(), fret: 0, string: 4 }, // A string, open
        null
      ]
    }
    
    // Second beat - single note
    Song.measures[trackId][0][voiceId][1] = {
      ...Song.defaultMeasure(),
      duration: 'quarter',
      notes: [
        null,
        null,
        null,
        null,
        null,
        { ...Song.defaultNote(), fret: 3, string: 5 } // Low E string, 3rd fret
      ]
    }
    
    // Third beat - with effects
    Song.measures[trackId][0][voiceId][2] = {
      ...Song.defaultMeasure(),
      duration: 'eighth',
      notes: [
        null,
        { ...Song.defaultNote(), fret: 5, string: 1, vibrato: true }, // High E, 5th fret with vibrato
        null,
        null,
        null,
        null
      ]
    }
    
    // Fourth beat - ghost note
    Song.measures[trackId][0][voiceId][3] = {
      ...Song.defaultMeasure(),
      duration: 'eighth',
      notes: [
        null,
        null,
        { ...Song.defaultNote(), fret: 7, string: 2, ghost: true }, // Ghost note
        null,
        null,
        null
      ]
    }
  }
  
  // Add notes to second measure
  if (Song.measures[trackId] && Song.measures[trackId][1] && Song.measures[trackId][1][voiceId]) {
    Song.measures[trackId][1][voiceId][0] = {
      ...Song.defaultMeasure(),
      duration: 'quarter',
      notes: [
        { ...Song.defaultNote(), fret: 0, string: 0 }, // High E open
        null,
        null,
        null,
        null,
        null
      ]
    }
    
    Song.measures[trackId][1][voiceId][1] = {
      ...Song.defaultMeasure(),
      duration: 'quarter', 
      notes: [
        null,
        { ...Song.defaultNote(), fret: 2, string: 1 }, // B string, 2nd fret
        null,
        null,
        null,
        null
      ]
    }
  }
  
  console.log('Sample notes added to Song')
}

function setNoteAtCurrentSelection(fretNumber: number) {
  if (!currentSelection.value) return
  
  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  
  console.log('=== SETTING NOTE ===')
  console.log('Setting note:', { trackId, voiceId, blockId, beatIndex, stringIndex, fretNumber })
  
  // Ensure the measure structure exists
  if (!Song.measures[trackId]) {
    Song.measures[trackId] = []
    console.log('Created track array for trackId:', trackId)
  }
  if (!Song.measures[trackId][blockId]) {
    Song.measures[trackId][blockId] = []
    console.log('Created block array for blockId:', blockId)
  }
  if (!Song.measures[trackId][blockId][voiceId]) {
    Song.measures[trackId][blockId][voiceId] = []
    console.log('Created voice array for voiceId:', voiceId)
  }
  if (!Song.measures[trackId][blockId][voiceId][beatIndex]) {
    Song.measures[trackId][blockId][voiceId][beatIndex] = {
      ...Song.defaultMeasure(),
      duration: 'quarter'
    }
    console.log('Created beat object for beatIndex:', beatIndex)
  }
  
  const beat = Song.measures[trackId][blockId][voiceId][beatIndex]
  console.log('Current beat before modification:', beat)
  
  // Ensure notes array exists
  if (!beat.notes) {
    beat.notes = new Array(6).fill(null)
    console.log('Created notes array')
  }
  
  if (fretNumber === -1) {
    // Remove note
    beat.notes[stringIndex] = null
    console.log(`Removed note from string ${stringIndex}`)
  } else {
    // Set note
    const newNote = {
      ...Song.defaultNote(),
      fret: fretNumber,
      string: stringIndex
    }
    beat.notes[stringIndex] = newNote
    console.log(`Set note: fret ${fretNumber} on string ${stringIndex}`, newNote)
  }
  
  console.log('Beat after modification:', beat)
  console.log('Full measure structure:', Song.measures[trackId][blockId][voiceId])
  
  // Force reactivity update
  updateTrigger.value++
  console.log('Update trigger incremented to:', updateTrigger.value)
  
  // Also dispatch the event for other components
  const event = new CustomEvent('songDataChanged', {
    detail: { trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber }
  })
  window.dispatchEvent(event)
  console.log('songDataChanged event dispatched')
  console.log('=== END SETTING NOTE ===')
}

function forceRefresh() {
  console.log('Force refresh button clicked')
  updateTrigger.value++ // Force Vue to re-render
}

function debugSongData() {
  console.log('Debug data button clicked')
  console.log('Current Song data:', Song)
}

function handleApplyEffect(effect: string) {
  console.log('Applying effect:', effect)
  // Implementation of handleApplyEffect
}

function handleSetDuration(duration: string) {
  console.log('Setting duration:', duration)
  // Implementation of handleSetDuration
}

function handleClearSelection() {
  console.log('Clearing selection')
  currentSelection.value = null
  // Implementation of handleClearSelection
}

function handleCopySelection() {
  console.log('Copying selection')
  // Implementation of handleCopySelection
}

function handlePasteSelection() {
  console.log('Pasting selection')
  // Implementation of handlePasteSelection
}

function handleDeleteSelection() {
  console.log('Deleting selection')
  currentSelection.value = null
  // Implementation of handleDeleteSelection
}
</script>

<style scoped>
.guitar-tab-view {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.tab-svg {
  display: block;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style> 