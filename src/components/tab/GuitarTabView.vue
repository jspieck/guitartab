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
          v-for="row in visibleTabRows"
          :key="`row-${row.id}-${row.startBlockId}`"
          :row-data="row"
          :track-id="trackId"
          :voice-id="voiceId"
          :svg-root="svgRoot"
          :y-offset="row.yOffset"
          :width="tabGroupWidth"
          :is-first-row="row.id === 0"
          :on-string-pointer-down="handleStringPointerDown"
        />

        <!-- Vue playback bar -->
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

    <ClassicalNotationLayer
      :is-active="classicalNotationActive"
      :track-id="trackId"
      :tab-rows="tabRows"
      :padding-left="paddingLeft"
      :padding-top="paddingTop"
      :tab-group-width="tabGroupWidth"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import TabRow from './TabRow.vue'
import ClassicalNotationLayer from './ClassicalNotationLayer.vue'
import { useGuitarTabLayout } from '../../composables/useGuitarTabLayout'
import { useClassicalNotation } from '../../composables/useClassicalNotation'
import { usePlaybackBarState } from '../../composables/usePlaybackBarState'
import { useTabRangeSelection } from '../../composables/useTabRangeSelection'
import { registerSelectionSurface } from '../../composables/useSelectionSurfaceState'
import { useTabEditorCommands } from '../../composables/useTabEditorCommands'
import { useVisibleTabRows } from '../../composables/useVisibleTabRows'
import { useTabRenderInvalidation } from '../../composables/useTabRenderInvalidation'
import { useTabSelectionBridge } from '../../composables/useTabSelectionBridge'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import { classicalNotationLayoutState } from '../../stores/classicalNotationLayoutState'
import editorCore from '../../services/editor/editorCore'

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
  clearSelection,
  setSelection,
  toggleToolbar,
  copySelection,
  pasteSelection,
} = useTabSelection()

const { playbackBarState } = usePlaybackBarState()
const {
  renderVersion,
  registerRenderInvalidationBridge,
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
  rowHeight,
} = useGuitarTabLayout(props, renderVersion)

const { visibleTabRows } = useVisibleTabRows(tabRows, rowHeight, paddingTop, svgRoot)

const {
  isActive: classicalNotationActive,
  scheduleRedrawRows,
} = useClassicalNotation(props.trackId, props.voiceId)

watch(
  [tabRows, classicalNotationActive, songDataVersion, () => classicalNotationLayoutState.version],
  () => {
    if (classicalNotationActive.value) {
      void scheduleRedrawRows()
    }
  },
)

function getMeasureContentPadding(blockId: number): number {
  const meta = editorCore.getMeasureMeta(blockId)
  let padding = 10

  if (meta.timeMeterPresent) {
    padding += 25
  }
  if (meta.repeatOpen) {
    padding += 15
  }

  return padding
}

const {
  handleStringPointerDown,
  clearRangeSelection,
} = useTabRangeSelection({
  svgRoot,
  tabRows,
  trackId: props.trackId,
  voiceId: props.voiceId,
  rowHeight,
  getMeasureContentPadding,
  onSingleSelect: (selection) => {
    clearRangeSelection()
    setSelection(selection)
  },
})

const playbackBarTransform = computed(() => `translate(${playbackBarState.x}, ${playbackBarState.y})`)
const playbackBarStyle = computed(() => ({
  display: playbackBarState.visible ? 'block' : 'none',
  pointerEvents: 'none',
  transition: `transform ${playbackBarState.transitionDuration}s ${playbackBarState.transitionTimingFunction}`,
}))

function handleMouseDown(_event: MouseEvent) {
  svgRoot.value?.focus()
}

function handleMouseMove(_event: MouseEvent) {
  // Range drag uses window listeners from useTabRangeSelection.
}

function handleMouseUp(_event: MouseEvent) {
  // Range drag uses window listeners from useTabRangeSelection.
}

const {
  handleKeyDown,
} = useTabEditorCommands({
  currentSelection,
  selectedNote,
  clearSelection,
  toggleToolbar,
  copySelection,
  pasteSelection,
})

onMounted(() => {
  editorCore.setPlaybackBarObject(playbackBarGroup.value)
  registerSelectionSurface(true)
  unregisterSelectionBridge = registerNavigationSelectionBridge()
  unregisterRenderInvalidationBridge = registerRenderInvalidationBridge()

  svgRoot.value?.focus()
})

onUnmounted(() => {
  unregisterSelectionBridge()
  unregisterRenderInvalidationBridge()
  editorCore.setPlaybackBarObject(null)
  registerSelectionSurface(false)
})
</script>

<style scoped>
.guitar-tab-view {
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: visible;
  transform-origin: 0 0;
}

.classical-notation-layer {
  overflow: visible;
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