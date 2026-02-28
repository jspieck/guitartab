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

        <!-- Playback Bar (for legacy svgDrawer support) -->
        <g id="playBackBarGroup0" style="display: none; pointer-events: none; transition: transform linear;">
          <rect x="0" y="-5" width="2" height="100" fill="rgba(49, 156, 217, 0.6)" />
        </g>
      </g>
    </svg>

    <!-- Note Context Menu (Single instance outside SVG) -->
    <NoteContextMenu
      :is-visible="contextMenuState.visible"
      :note="contextMenuState.note"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      @close="hideContextMenu"
      @toggle-effect="handleToggleEffect"
      @set-duration="handleContextMenuSetDuration"
      @delete-note="handleDeleteNote"
      @copy-note="handleCopyNote"
      @paste-note="handlePasteNote"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import TabRow from './TabRow.vue'
import NoteContextMenu from '../NoteContextMenu.vue'
import Song from '../../assets/js/songData'
import { Tab, tab } from '../../assets/js/tab'
import Helper from '../../assets/js/helper'
import { svgDrawer } from '../../assets/js/svgDrawer'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import { useDurationHandler } from '../../composables/useDurationHandler'
import { typedEventBus } from '../../utils/typedEventBus'
import { getPageMargins } from '../../utils/tabLayout'

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

// Use composables
const { 
  reactiveSongData, 
  songDataVersion, 
  syncSongData, 
  setNote
} = useSongData()

const {
  currentSelection,
  selectedNote,
  toolbarVisible,
  contextMenuState,
  setSelection,
  clearSelection,
  toggleToolbar,
  hideContextMenu,
  copySelection,
  pasteSelection,
  durationToCode,
  codeToDuration,
  handleNoteSelectionEvent
} = useTabSelection()

const { changeDuration } = useDurationHandler(syncSongData)

// Refs
const tabContainer = ref<HTMLElement>()
const updateTrigger = ref(0)

// Layout constants
const margins = computed(() => getPageMargins(props.width, props.height))
const paddingLeft = computed(() => margins.value.left)
const paddingTop = computed(() => margins.value.top)
const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
const pageWidth = props.width
const rowHeight = 120

// Song info
const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')
const showTabInfo = computed(() => true)

// Tab rows layout computation
const tabRows = computed(() => {
  // Dependencies for reactivity
  updateTrigger.value
  songDataVersion.value
  
  interface TabRowData {
    id: number
    measures: any[]
    startBlockId: number
    endBlockId: number
    yOffset: number
  }
  
  const rows: TabRowData[] = []
  
  // Initialize Song if needed
  if (!Song.measures || Song.measures.length === 0) {
    Song.initEmptySong()
    syncSongData()
  }
  
  const measures = reactiveSongData.measures?.[props.trackId] || []
  
  if (measures.length === 0) {
    return rows
  }

  // Layout logic
  const availableWidth = tabGroupWidth.value
  let currentRowMeasures: any[] = []
  let currentWidth = 32 // TAB label offset
  let startBlockId = 0

  // Initialize mapping data for legacy svgDrawer support
  const trackId = props.trackId
  const voiceId = props.voiceId
  
  svgDrawer.blockToPage = []
  if (!svgDrawer.blockToX[trackId]) svgDrawer.blockToX[trackId] = []
  if (!svgDrawer.rowToY[trackId]) svgDrawer.rowToY[trackId] = []
  if (!svgDrawer.rowToY[trackId][voiceId]) svgDrawer.rowToY[trackId][voiceId] = []
  if (!svgDrawer.heightOfRow[trackId]) svgDrawer.heightOfRow[trackId] = []
  if (!svgDrawer.heightOfRow[trackId][voiceId]) svgDrawer.heightOfRow[trackId][voiceId] = []
  
  if (!tab.blockToRow[trackId]) tab.blockToRow[trackId] = []
  if (!tab.blockToRow[trackId][voiceId]) tab.blockToRow[trackId][voiceId] = []
  
  if (!tab.finalBlockWidths[trackId]) tab.finalBlockWidths[trackId] = []
  if (!tab.finalBlockWidths[trackId][voiceId]) tab.finalBlockWidths[trackId][voiceId] = []
  
  if (!tab.measureOffset[trackId]) tab.measureOffset[trackId] = []

  svgDrawer.trackCreated = true
  svgDrawer.paddingTop = paddingTop.value
  svgDrawer.tabInformationHeight = 80

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]
    
    let measureWidth = 200
    let minOffset = 40
    try {
      // Ensure measureMoveHelper is populated for playback bar
      Helper.groupMeasureBeats(trackId, i, voiceId)
      
      const widthInfo = Tab.computeWidthOfBlock(trackId, i, voiceId)
      measureWidth = widthInfo.minWidth
      minOffset = widthInfo.minOffset
      
      // Populate mapping data
      svgDrawer.blockToPage[i] = 0 // All on page 0 for now
      if (!svgDrawer.blockToX[trackId][i]) svgDrawer.blockToX[trackId][i] = []
      svgDrawer.blockToX[trackId][i][voiceId] = currentWidth
      
      tab.blockToRow[trackId][voiceId][i] = {
        rowId: rows.length,
        numInRow: currentRowMeasures.length
      }
      
      tab.finalBlockWidths[trackId][voiceId][i] = measureWidth
      if (!tab.measureOffset[trackId][i]) tab.measureOffset[trackId][i] = []
      tab.measureOffset[trackId][i][voiceId] = minOffset
      
    } catch (e) {
      console.error('Error computing measure width:', e)
    }
    
    // Start new row if current exceeds width
    if (currentWidth + measureWidth > availableWidth && currentRowMeasures.length > 0) {
      // Update row mapping
      svgDrawer.rowToY[trackId][voiceId][rows.length] = getRowYOffset(rows.length)
      svgDrawer.heightOfRow[trackId][voiceId][rows.length] = rowHeight
      
      rows.push({
        id: rows.length,
        measures: currentRowMeasures,
        startBlockId,
        endBlockId: i - 1,
        yOffset: 0
      })
      currentRowMeasures = []
      currentWidth = 0
      startBlockId = i
      
      // Re-populate mapping for the first measure of the new row
      if (svgDrawer.blockToX[trackId][i]) {
        svgDrawer.blockToX[trackId][i][voiceId] = 0
      }
      if (tab.blockToRow[trackId][voiceId][i]) {
        tab.blockToRow[trackId][voiceId][i].rowId = rows.length
        tab.blockToRow[trackId][voiceId][i].numInRow = 0
      }
    }
    
    currentRowMeasures.push({
      data: measure?.[voiceId] || [],
      width: measureWidth
    })
    currentWidth += measureWidth
  }
  
  // Add remaining measures
  if (currentRowMeasures.length > 0) {
    svgDrawer.rowToY[trackId][voiceId][rows.length] = getRowYOffset(rows.length)
    svgDrawer.heightOfRow[trackId][voiceId][rows.length] = rowHeight
    rows.push({
      id: rows.length,
      measures: currentRowMeasures,
      startBlockId,
      endBlockId: measures.length - 1,
      yOffset: 0
    })
  }

  svgDrawer.numRows = rows.length
  svgDrawer.numPages = 1
  
  return rows
})

const totalHeight = computed(() => {
  const headerHeight = 80
  return headerHeight + tabRows.value.length * rowHeight + 100
})

// Methods
function getRowYOffset(rowIndex: number): number {
  const headerHeight = 80
  return headerHeight + (rowIndex * rowHeight)
}

function handleMouseDown(event: MouseEvent) {
  // Handle tab interaction
}

function handleMouseMove(event: MouseEvent) {
  // Handle hover effects
}

function handleMouseUp(event: MouseEvent) {
  // Handle selection end
}

function handleKeyDown(event: KeyboardEvent) {
  // Number keys for fret input
  if (event.key >= '0' && event.key <= '9' && currentSelection.value) {
    setNoteAtCurrentSelection(parseInt(event.key, 10))
    event.preventDefault()
    event.stopPropagation()  // Prevent AppManager from also handling this
    return
  }
  
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      if (currentSelection.value) {
        setNoteAtCurrentSelection(-1)
        event.preventDefault()
        event.stopPropagation()
      }
      break
    case 't':
    case 'T':
      toggleToolbar()
      event.preventDefault()
      break
    case 'Escape':
      clearSelection()
      break
  }
}

function handleNoteSelection(selection: any) {
  if (selection) handleNoteSelectionEvent({ detail: selection } as any)
}

function setNoteAtCurrentSelection(fretNumber: number) {
  if (!currentSelection.value) return
  
  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  setNote(trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber)
  updateTrigger.value++
}

function handleSongDataChange() {
  syncSongData()
  updateTrigger.value++
}

function handleRenderBlock() {
  syncSongData()
  updateTrigger.value++
}

// Event handlers for Context Menu
function handleToggleEffect(effectId: string) {
  if (!contextMenuState.value.note) return
  
  const note = contextMenuState.value.note
  
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
  
  syncSongData()
  updateTrigger.value++
  typedEventBus.emit('song-data-changed')
}

function handleContextMenuSetDuration(durationId: string) {
  if (!contextMenuState.value.note || !currentSelection.value) return

  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value

  tab.changeNoteDuration(
    trackId, blockId, voiceId, beatIndex, stringIndex, durationId as any, false
  )

  syncSongData()
  updateTrigger.value++
  typedEventBus.emit('song-data-changed')
}

function handleDeleteNote() {
  if (!contextMenuState.value.note || !currentSelection.value) return
  
  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  setNote(trackId, blockId, voiceId, beatIndex, stringIndex, -1)
  
  syncSongData()
  updateTrigger.value++
  hideContextMenu()
}

function handleCopyNote() {
  if (!contextMenuState.value.note) return
  copySelection()
  hideContextMenu()
}

function handlePasteNote() {
  const clipboardData = pasteSelection()
  if (!clipboardData || !currentSelection.value) return

  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  const sourceBeat = clipboardData.beat
  const sourceStringIndex = clipboardData.position.stringIndex

  // Find the note on the same string in the source beat
  const sourceNote = sourceBeat.notes.find((n: any) => n.string === sourceStringIndex)
  
  if (sourceNote) {
    setNote(trackId, blockId, voiceId, beatIndex, stringIndex, sourceNote.fret)
    updateTrigger.value++
  }
  
  hideContextMenu()
}

// Close context menu on click outside
function handleGlobalClick(event: MouseEvent) {
  if (contextMenuState.value.visible) {
    const target = event.target as HTMLElement
    if (target.closest('.note-context-menu') || target.closest('.string-click-area')) {
      return
    }
    hideContextMenu()
  }
}

// Event handlers
function handleApplyEffect(effect: string) {
  // TODO: Implement effect application
}

function handleSetDuration(duration: string) {
  if (!currentSelection.value) return
  
  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  
  const success = changeDuration(trackId, blockId, voiceId, beatIndex, stringIndex, duration)
  
  if (success && selectedNote.value) {
    selectedNote.value.duration = duration
  }
  
  updateTrigger.value++
}

function handleClearSelection() {
  clearSelection()
}

function handleCopySelection() {
  copySelection()
}

function handlePasteSelection() {
  // TODO: Implement paste
}

function handleDeleteSelection() {
  if (currentSelection.value) {
    setNoteAtCurrentSelection(-1)
  }
  clearSelection()
}

// Sample notes for demo
function addSampleNotes() {
  if (!Song.measures || Song.measures.length === 0) {
    Song.initEmptySong()
  }
  
  const { trackId, voiceId } = props
  
  // First measure - chord
  if (Song.measures[trackId]?.[0]?.[voiceId]) {
    Song.measures[trackId][0][voiceId][0] = {
      ...Song.defaultMeasure(),
      duration: 'q',
      notes: [
        null, null, 
        { ...Song.defaultNote(), fret: 3, string: 2 },
        { ...Song.defaultNote(), fret: 2, string: 3 },
        { ...Song.defaultNote(), fret: 0, string: 4 },
        null
      ]
    }
    
    Song.measures[trackId][0][voiceId][1] = {
      ...Song.defaultMeasure(),
      duration: 'q',
      notes: [null, null, null, null, null, { ...Song.defaultNote(), fret: 3, string: 5 }]
    }
    
    Song.measures[trackId][0][voiceId][2] = {
      ...Song.defaultMeasure(),
      duration: 'e',
      notes: [null, { ...Song.defaultNote(), fret: 5, string: 1, vibrato: true }, null, null, null, null]
    }
    
    Song.measures[trackId][0][voiceId][3] = {
      ...Song.defaultMeasure(),
      duration: 'e',
      notes: [null, null, { ...Song.defaultNote(), fret: 7, string: 2, ghost: true }, null, null, null]
    }
  }
  
  // Second measure
  if (Song.measures[trackId]?.[1]?.[voiceId]) {
    Song.measures[trackId][1][voiceId][0] = {
      ...Song.defaultMeasure(),
      duration: 'q',
      notes: [{ ...Song.defaultNote(), fret: 0, string: 0 }, null, null, null, null, null]
    }
    
    Song.measures[trackId][1][voiceId][1] = {
      ...Song.defaultMeasure(),
      duration: 'q',
      notes: [null, { ...Song.defaultNote(), fret: 2, string: 1 }, null, null, null, null]
    }
  }
  
  syncSongData()
}

// Lifecycle
onMounted(() => {
  addSampleNotes()
  
  // Initialize playback bar for legacy svgDrawer support
  const mGroup = document.getElementById('playBackBarGroup0') as unknown as SVGGElement
  if (mGroup) {
    svgDrawer.playBackBarObjects = [mGroup]
  }
  
  window.addEventListener('mousedown', handleGlobalClick)

  typedEventBus.on('song-data-changed', handleSongDataChange)
  typedEventBus.on('selection.changed', handleNoteSelection as any)
  typedEventBus.on('render.block', handleRenderBlock)
  typedEventBus.on('render.all', handleRenderBlock)
  
  // Focus SVG for keyboard events
  tabContainer.value?.querySelector('svg')?.focus()
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick)

  typedEventBus.off('song-data-changed', handleSongDataChange)
  typedEventBus.off('selection.changed', handleNoteSelection as any)
  typedEventBus.off('render.block', handleRenderBlock)
  typedEventBus.off('render.all', handleRenderBlock)
})
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