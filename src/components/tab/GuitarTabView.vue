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
          
        </g>
        
        <!-- Simple tab rows -->
        <TabRow
          v-for="(row, rowIndex) in tabRows"
          :key="`row-${rowIndex}-${songDataVersion}`"
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
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import TabRow from './TabRow.vue'
import Song from '../../assets/js/songData'
import TabToolbar from './TabToolbar.vue'
import EventBus from '../../assets/js/eventBus'
import { Tab } from '../../assets/js/tab'

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
const songDataVersion = ref(0) // Track version changes to force re-render

onMounted(() => {
  EventBus.on('song-data-changed', syncSongData)
})

onUnmounted(() => {
  EventBus.off('song-data-changed', syncSongData)
})

// Create a reactive proxy of Song data for Vue components
const reactiveSongData = reactive({
  measures: Song.measures,
  songDescription: Song.songDescription,
  tracks: Song.tracks
})

// Function to sync Song data to reactive proxy
function syncSongData() {
  // Deep copy to ensure reactivity detects changes
  reactiveSongData.measures = JSON.parse(JSON.stringify(Song.measures))
  reactiveSongData.songDescription = { ...Song.songDescription }
  reactiveSongData.tracks = [...Song.tracks]
  songDataVersion.value++
  console.log('Song data synced to reactive proxy, version:', songDataVersion.value)
}

// Watch for changes to the original Song data and sync to reactive proxy
watch(() => Song.measures, (newMeasures) => {
  console.log('Song.measures changed, syncing...')
  syncSongData()
}, { deep: true })

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
const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')
const showTabInfo = computed(() => true)

const tabRows = computed(() => {
  // Add reactivity trigger to force re-computation
  updateTrigger.value // This ensures the computed re-runs when updateTrigger changes
  songDataVersion.value // Track changes to song data
  
  console.log('=== COMPUTING TAB ROWS ===')
  console.log('Update trigger:', updateTrigger.value)
  console.log('Song data version:', songDataVersion.value)
  
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
  console.log('Reactive measures:', reactiveSongData.measures)
  console.log('TrackId:', props.trackId, 'VoiceId:', props.voiceId)
  
  // Initialize Song if needed
  if (!Song.measures || Song.measures.length === 0) {
    console.log('Initializing empty song...')
    Song.initEmptySong()
    // Sync to reactive proxy using the sync function
    syncSongData()
  }
  
  // Get measures from Song data - use the reactive proxy to ensure updates propagate
  const measures = reactiveSongData.measures?.[props.trackId] || []
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

  // Layout logic using Tab.computeWidthOfBlock
  const availableWidth = tabGroupWidth.value
  let currentRowMeasures: any[] = []
  let currentWidth = 0
  let startBlockId = 0
  
  // Initial offset for the first row (TAB label etc)
  const START_OFFSET = 32
  currentWidth = START_OFFSET

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]
    
    let measureWidth = 200
    try {
      const widthInfo = Tab.computeWidthOfBlock(props.trackId, i, props.voiceId)
      measureWidth = widthInfo.minWidth
    } catch (e) {
      console.error('Error computing measure width:', e)
    }
    
    // Check if adding this measure exceeds available width
    if (currentWidth + measureWidth > availableWidth && currentRowMeasures.length > 0) {
      // Start new row
      rows.push({
        id: rows.length,
        measures: currentRowMeasures,
        startBlockId: startBlockId,
        endBlockId: i - 1,
        yOffset: 0
      })
      currentRowMeasures = []
      currentWidth = 0
      startBlockId = i
    }
    
    // Add measure to current row
    let voiceData: any[] = []
    if (measure && measure[props.voiceId]) {
      voiceData = measure[props.voiceId]
    }
    
    currentRowMeasures.push({
      data: voiceData,
      width: measureWidth
    })
    currentWidth += measureWidth
  }
  
  // Add last row
  if (currentRowMeasures.length > 0) {
    rows.push({
      id: rows.length,
      measures: currentRowMeasures,
      startBlockId: startBlockId,
      endBlockId: measures.length - 1,
      yOffset: 0
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
    
    // Create a composite object that includes note data AND beat duration
    // We need this because duration is on the beat, not the note
    selectedNote.value = {
      ...(note || {}),
      duration: beat?.duration || 'quarter',
      // If it's a rest or empty, we still want to be able to set duration
      isEmpty: !note
    }
    
    console.log('Selected note for toolbar:', selectedNote.value)
    console.log('Selection details:', detail)
    console.log('Current beat data:', beat)
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
  syncSongData() // Sync the new data to the reactive proxy
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
  
  // Sync the changes to reactive proxy
  syncSongData()
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
  
  // Sync Song data to reactive proxy to trigger Vue reactivity
  syncSongData()
  
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
  
  if (!currentSelection.value) return
  
  const { trackId, voiceId, blockId, beatIndex } = currentSelection.value
  
  // Update the beat duration in Song data
  if (Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatIndex]) {
    Song.measures[trackId][blockId][voiceId][beatIndex].duration = duration
    console.log(`Updated beat duration to ${duration}`)
    
    // Update selectedNote so toolbar reflects change immediately
    if (selectedNote.value) {
      selectedNote.value.duration = duration
    }
    
    // Sync and notify
    syncSongData()
    updateTrigger.value++
    
    // Dispatch event
    const event = new CustomEvent('songDataChanged', {
      detail: { trackId, blockId, voiceId, beatIndex, duration }
    })
    window.dispatchEvent(event)
  }
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