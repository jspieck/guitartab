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
          :track-id="trackId"
          :voice-id="voiceId"
          :y-offset="row.yOffset"
          :width="tabGroupWidth"
          :is-first-row="rowIndex === 0"
        />

        <!-- Playback Bar (for legacy svgDrawer support) -->
        <g
          id="playBackBarGroup0"
          :transform="playbackBarTransform"
          :style="playbackBarStyle"
        >
          <rect x="0" y="-5" width="2" :height="playbackBarHeight" fill="rgba(49, 156, 217, 0.6)" />
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import NoteContextMenu from '../NoteContextMenu.vue'
import TabRow from './TabRow.vue'
import { usePlaybackBarState } from '../../composables/usePlaybackBarState'
import { useDurationHandler } from '../../composables/useDurationHandler'
import { useTabRenderLayout } from '../../composables/useTabRenderLayout'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import legacyEditorCore from '../../services/legacy/editorCoreAdapter'
import type { RenderedTabRow, TabBeat, TabNoteData } from '../../types/tab'
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
  height: 1600,
})

const HEADER_HEIGHT = 80
const ROW_HEIGHT = 120

const {
  reactiveSongData,
  songDataVersion,
  syncSongData,
  setNote,
} = useSongData()

const {
  currentSelection,
  selectedNote,
  contextMenuState,
  clearSelection,
  toggleToolbar,
  hideContextMenu,
  copySelection,
  pasteSelection,
} = useTabSelection()

const { changeDuration } = useDurationHandler()
const { getTrackLayout } = useTabRenderLayout()
const { playbackBarState } = usePlaybackBarState()

const tabContainer = ref<HTMLElement | null>(null)
const renderVersion = ref(0)

const margins = computed(() => getPageMargins(props.width, props.height))
const paddingLeft = computed(() => margins.value.left)
const paddingTop = computed(() => margins.value.top)
const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
const pageWidth = props.width
const renderLayout = computed(() => getTrackLayout(props.trackId, props.voiceId))

const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')
const showTabInfo = true

const tabRows = computed<RenderedTabRow[]>(() => {
  const renderRevision = renderVersion.value + songDataVersion.value
  void renderRevision

  if (legacyEditorCore.ensureSongInitialized()) {
    syncSongData()
  }

  return legacyEditorCore.buildModernTabRows(
    props.trackId,
    props.voiceId,
    reactiveSongData.measures?.[props.trackId] || [],
    {
      availableWidth: tabGroupWidth.value,
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
      paddingTop: paddingTop.value,
      tabInformationHeight: HEADER_HEIGHT,
    },
  )
})

const playbackBarHeight = computed(() => {
  const rowLayouts = renderLayout.value?.rowLayouts
  if (!rowLayouts || rowLayouts.length === 0) {
    return ROW_HEIGHT
  }

  const lastRow = rowLayouts[rowLayouts.length - 1]
  return Math.max(ROW_HEIGHT, lastRow.yOffset + lastRow.height)
})

const totalHeight = computed(() => HEADER_HEIGHT + tabRows.value.length * ROW_HEIGHT + 100)
const playbackBarTransform = computed(() => `translate(${playbackBarState.x}, ${playbackBarState.y})`)
const playbackBarStyle = computed(() => ({
  display: playbackBarState.visible ? 'block' : 'none',
  pointerEvents: 'none',
  transition: `transform ${playbackBarState.transitionDuration}s ${playbackBarState.transitionTimingFunction}`,
}))

function handleMouseDown(_event: MouseEvent) {
  // Reserved for drag selection.
}

function handleMouseMove(_event: MouseEvent) {
  // Reserved for hover interactions.
}

function handleMouseUp(_event: MouseEvent) {
  // Reserved for drag selection.
}

function getCurrentSelectionNote(): TabNoteData | null {
  if (!currentSelection.value) {
    return null
  }

  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  return legacyEditorCore.getNote(trackId, blockId, voiceId, beatIndex, stringIndex) as TabNoteData | null | undefined ?? null
}

function refreshSelectionState(): void {
  selectedNote.value = legacyEditorCore.getSelectedNoteState(currentSelection.value)

  if (!contextMenuState.value.visible) {
    return
  }

  if (!currentSelection.value) {
    hideContextMenu()
    return
  }

  const note = getCurrentSelectionNote()
  const { trackId, voiceId, blockId, beatIndex } = currentSelection.value
  const beat = legacyEditorCore.getBeat(trackId, blockId, voiceId, beatIndex) as TabBeat | undefined

  if (!note) {
    hideContextMenu()
    return
  }

  contextMenuState.value.note = {
    ...note,
    duration: beat?.duration || 'q',
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key >= '0' && event.key <= '9' && currentSelection.value) {
    setNoteAtCurrentSelection(Number.parseInt(event.key, 10))
    event.preventDefault()
    event.stopPropagation()
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

function setNoteAtCurrentSelection(fretNumber: number): void {
  if (!currentSelection.value) {
    return
  }

  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  setNote(trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber)
  refreshSelectionState()
}

function handleRenderInvalidation(): void {
  syncSongData()
  renderVersion.value++
}

function handleToggleEffect(effectId: string): void {
  const note = getCurrentSelectionNote()
  if (!note) {
    return
  }

  if (effectId === 'bend') {
    note.bendPresent = !note.bendPresent
    if (note.bendPresent && (!note.bendObj || note.bendObj.length === 0)) {
      note.bendObj = [
        { bendPosition: 0, bendValue: 0, vibrato: 0 },
        { bendPosition: 60, bendValue: 4, vibrato: 0 },
      ]
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

  legacyEditorCore.notifySongDataChanged()
  refreshSelectionState()
}

function handleContextMenuSetDuration(durationId: string): void {
  if (!currentSelection.value) {
    return
  }

  const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
  if (changeDuration(trackId, blockId, voiceId, beatIndex, stringIndex, durationId)) {
    refreshSelectionState()
  }
}

function handleDeleteNote(): void {
  if (!currentSelection.value) {
    return
  }

  setNoteAtCurrentSelection(-1)
  hideContextMenu()
}

function handleCopyNote(): void {
  if (!contextMenuState.value.note) {
    return
  }

  copySelection()
  hideContextMenu()
}

function handlePasteNote(): void {
  const clipboardData = pasteSelection()
  if (!clipboardData || !currentSelection.value) {
    return
  }

  const sourceStringIndex = clipboardData.position.stringIndex
  const sourceNote = clipboardData.beat.notes.find(
    (note): note is TabNoteData => note?.string === sourceStringIndex,
  )

  if (sourceNote) {
    setNoteAtCurrentSelection(sourceNote.fret)
  }

  hideContextMenu()
}

function handleGlobalClick(event: MouseEvent): void {
  if (!contextMenuState.value.visible) {
    return
  }

  const target = event.target as HTMLElement
  if (target.closest('.note-context-menu') || target.closest('.string-click-area')) {
    return
  }

  hideContextMenu()
}

onMounted(() => {
  const playBackBarGroup = document.getElementById('playBackBarGroup0') as SVGGElement | null
  legacyEditorCore.setPlaybackBarObject(playBackBarGroup)

  window.addEventListener('mousedown', handleGlobalClick)
  typedEventBus.on('render.block', handleRenderInvalidation)
  typedEventBus.on('render.all', handleRenderInvalidation)

  tabContainer.value?.querySelector('svg')?.focus()
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick)
  typedEventBus.off('render.block', handleRenderInvalidation)
  typedEventBus.off('render.all', handleRenderInvalidation)
  legacyEditorCore.setPlaybackBarObject(null)
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
  background: var(--tab-bg);
  box-shadow: var(--tab-shadow);
}

.tab-title {
  fill: var(--tab-primary);
}

.tab-author {
  fill: var(--tab-secondary);
}
</style> 