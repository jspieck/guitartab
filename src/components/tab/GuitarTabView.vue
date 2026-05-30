<template>
  <div class="guitar-tab-view" ref="tabContainer">
    <svg 
      ref="svgRoot"
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
          :svg-root="svgRoot"
          :y-offset="row.yOffset"
          :width="tabGroupWidth"
          :is-first-row="rowIndex === 0"
        />

        <!-- Playback Bar (for legacy svgDrawer support) -->
        <g
          ref="playbackBarGroup"
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
import { useGuitarTabLayout } from '../../composables/useGuitarTabLayout'
import { usePlaybackBarState } from '../../composables/usePlaybackBarState'
import { registerSelectionSurface } from '../../composables/useSelectionSurfaceState'
import { useTabEditorCommands } from '../../composables/useTabEditorCommands'
import { useTabRenderInvalidation } from '../../composables/useTabRenderInvalidation'
import { useTabSelectionBridge } from '../../composables/useTabSelectionBridge'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import legacyEditorCore from '../../services/legacy/editorCoreAdapter'

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

const { syncSongData } = useSongData()

const {
  currentSelection,
  selectedNote,
  contextMenuState,
  clearSelection,
  setSelection,
  toggleToolbar,
  hideContextMenu,
  copySelection,
  pasteSelection,
} = useTabSelection()

const { playbackBarState } = usePlaybackBarState()
const {
  renderVersion,
  registerLegacyRenderInvalidationBridge,
} = useTabRenderInvalidation(syncSongData)
const { registerNavigationSelectionBridge } = useTabSelectionBridge(setSelection)

const tabContainer = ref<HTMLElement | null>(null)
const svgRoot = ref<SVGSVGElement | null>(null)
const playbackBarGroup = ref<SVGGElement | null>(null)
let unregisterSelectionBridge = () => {}
let unregisterRenderInvalidationBridge = () => {}

const showTabInfo = true
const {
  songDataVersion,
  paddingLeft,
  paddingTop,
  tabGroupWidth,
  pageWidth,
  songTitle,
  songAuthor,
  tabRows,
  playbackBarHeight,
  totalHeight,
} = useGuitarTabLayout(props, renderVersion)
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

const {
  handleKeyDown,
  handleToggleEffect,
  handleContextMenuSetDuration,
  handleDeleteNote,
  handleCopyNote,
  handlePasteNote,
  handleGlobalClick,
} = useTabEditorCommands({
  currentSelection,
  selectedNote,
  contextMenuState,
  clearSelection,
  toggleToolbar,
  hideContextMenu,
  copySelection,
  pasteSelection,
})

onMounted(() => {
  legacyEditorCore.setPlaybackBarObject(playbackBarGroup.value)
  registerSelectionSurface(true)
  unregisterSelectionBridge = registerNavigationSelectionBridge()
  unregisterRenderInvalidationBridge = registerLegacyRenderInvalidationBridge()

  window.addEventListener('mousedown', handleGlobalClick)

  svgRoot.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick)
  unregisterSelectionBridge()
  unregisterRenderInvalidationBridge()
  legacyEditorCore.setPlaybackBarObject(null)
  registerSelectionSurface(false)
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