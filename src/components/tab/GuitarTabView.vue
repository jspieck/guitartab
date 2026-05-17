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
            class="tab-title"
            text-anchor="middle"
          >
            {{ songTitle }}
          </text>
          <text 
            :x="tabGroupWidth / 2" 
            y="55" 
            font-family="Source Sans Pro" 
            font-size="16px" 
            class="tab-author"
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
          :track-id="props.trackId"
          :voice-id="props.voiceId"
          :y-offset="row.yOffset"
          :width="tabGroupWidth"
          :is-first-row="rowIndex === 0"
        />

        <!-- Playback bar bridge for the legacy playback engine -->
        <g ref="playbackBarGroup" id="playBackBarGroup0" style="display: none; pointer-events: none; transition: transform linear;">
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TabRow from './TabRow.vue'
import NoteContextMenu from '../NoteContextMenu.vue'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import { legacyEditorCore } from '../../services/legacy/editorCoreAdapter'
import { typedEventBus, type SelectionChangeData } from '../../utils/typedEventBus'
import { getPageMargins } from '../../utils/tabLayout'
import type { TabNoteData } from '../../types/tab'

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
  contextMenuState,
  setSelection,
  clearSelection,
  toggleToolbar,
  hideContextMenu,
  copySelection,
  pasteSelection,
} = useTabSelection()

if (legacyEditorCore.ensureSongInitialized()) {
  syncSongData()
}

// Refs
const tabContainer = ref<HTMLElement | null>(null)
const playbackBarGroup = ref<SVGGElement | null>(null)
const updateTrigger = ref(0)

// Layout constants
const margins = computed(() => getPageMargins(props.width, props.height))
const paddingLeft = computed(() => margins.value.left)
const paddingTop = computed(() => margins.value.top)
const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
const pageWidth = props.width
const headerHeight = 80
const rowHeight = 120

// Song info
const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')
const showTabInfo = computed(() => true)

function trackRenderDependencies(..._versions: number[]) {
  return _versions.length
}

// Tab rows layout computation
const tabRows = computed(() => {
  trackRenderDependencies(updateTrigger.value, songDataVersion.value)
  const measures = reactiveSongData.measures?.[props.trackId] || []

  return legacyEditorCore.buildModernTabRows(props.trackId, props.voiceId, measures, {
    availableWidth: tabGroupWidth.value,
    headerHeight,
    rowHeight,
    paddingTop: paddingTop.value,
    tabInformationHeight: headerHeight,
  })
})

const totalHeight = computed(() => {
  const lastRow = tabRows.value[tabRows.value.length - 1]
  return lastRow ? lastRow.yOffset + rowHeight + 100 : headerHeight + 100
})

// Methods

function handleMouseDown(_event: MouseEvent) {
  // Handle tab interaction
}

function handleMouseMove(_event: MouseEvent) {
  // Handle hover effects
}

function handleMouseUp(_event: MouseEvent) {
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

function handleNoteSelection(selection: SelectionChangeData | null) {
  if (selection) {
    setSelection({
      trackId: selection.trackId,
      voiceId: selection.voiceId,
      blockId: selection.blockId,
      beatIndex: selection.beatIndex,
      stringIndex: selection.stringIndex,
    })
    return
  }

  clearSelection()
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
  
  const note = contextMenuState.value.note as TabNoteData
  
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

  legacyEditorCore.changeNoteDuration(trackId, blockId, voiceId, beatIndex, stringIndex, durationId)

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
  const sourceNote = sourceBeat.notes.find(
    (note: TabNoteData | null): note is TabNoteData => note !== null && note.string === sourceStringIndex,
  )
  
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

// Lifecycle
onMounted(() => {
  legacyEditorCore.setPlaybackBarObject(playbackBarGroup.value)

  window.addEventListener('mousedown', handleGlobalClick)

  typedEventBus.on('song-data-changed', handleSongDataChange)
  typedEventBus.on('selection.changed', handleNoteSelection)
  typedEventBus.on('render.block', handleRenderBlock)
  typedEventBus.on('render.all', handleRenderBlock)
  
  // Focus SVG for keyboard events
  tabContainer.value?.querySelector('svg')?.focus()
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick)

  legacyEditorCore.setPlaybackBarObject(null)

  typedEventBus.off('song-data-changed', handleSongDataChange)
  typedEventBus.off('selection.changed', handleNoteSelection)
  typedEventBus.off('render.block', handleRenderBlock)
  typedEventBus.off('render.all', handleRenderBlock)
})
</script>

<style scoped>
.guitar-tab-view {
  width: 100%;
  height: 100%;
  overflow: auto;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #f7f8fb 0%, #eef1f5 100%);
  padding: 24px 0 48px;
}

.tab-svg {
  display: block;
  margin: 0 auto;
  background: var(--tab-bg);
  box-shadow: var(--tab-shadow);
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.tab-title {
  fill: var(--tab-primary);
}

.tab-author {
  fill: var(--tab-secondary);
}
</style> 