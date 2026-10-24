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
          <text
            v-if="trackIsEmpty"
            :x="tabGroupWidth / 2"
            :y="emptyHintY"
            font-family="Source Sans Pro"
            font-size="13px"
            class="tab-empty-hint"
            text-anchor="middle"
          >
            {{ emptyHintText }}
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
          :style="playbackBarStyle"
        >
          <rect x="0" y="-5" width="2" :height="getPlaybackBarHeight(playbackBarState.y) + 5" style="fill: var(--tab-playhead)" />
        </g>
      </g>
    </svg>

    <ClassicalNotationLayer
      :is-active="classicalNotationActive"
      :track-id="trackId"
      :voice-id="voiceId"
      :tab-rows="visibleTabRows"
      :padding-left="paddingLeft"
      :padding-top="paddingTop"
      :tab-group-width="tabGroupWidth"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TabRow from './TabRow.vue'
import ClassicalNotationLayer from './ClassicalNotationLayer.vue'
import { useGuitarTabLayout } from '../../composables/useGuitarTabLayout'
import { useClassicalNotation } from '../../composables/useClassicalNotation'
import { usePlaybackBarState } from '../../stores/playbackBarState'
import { useTabRangeSelection } from '../../composables/useTabRangeSelection'
import { registerSelectionSurface } from '../../stores/selectionSurfaceState'
import { useTabEditorCommands } from '../../composables/useTabEditorCommands'
import { useVisibleTabRows } from '../../composables/useVisibleTabRows'
import { useTabRenderInvalidation } from '../../composables/useTabRenderInvalidation'
import { useTabSelectionBridge } from '../../composables/useTabSelectionBridge'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import editorCore from '../../services/editor/editorCore'
import { layoutModeState } from '../../stores/layoutModeState'

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

const { syncSongData, reactiveSongData } = useSongData()

const {
  currentSelection,
  clearSelection,
  setSelection,
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
  paddingLeft,
  paddingTop,
  tabGroupWidth,
  pageWidth,
  songTitle,
  songAuthor,
  tabRows,
  getPlaybackBarHeight,
  totalHeight,
  rowHeight,
} = useGuitarTabLayout(props, renderVersion)

const { visibleTabRows } = useVisibleTabRows(tabRows, paddingTop, svgRoot)

// Empty-score hint. The scan stops at the first note, so for real songs it reads a few beats.
const trackIsEmpty = computed(() => {
  const blocks = reactiveSongData.measures[props.trackId]
  if (blocks == null || blocks.length === 0) return false
  return blocks.every((voices) =>
    voices.every((beats) => beats.every((beat) => !beat.notes.some((note) => note != null))),
  )
})
const emptyHintText = computed(() =>
  layoutModeState.compact
    ? 'This track is empty. Tap the pencil, then a string, then a fret.'
    : 'This track is empty. Click a line in the tab and type a fret number.',
)
// Between the author line (y 55) and the first row's top lane.
const emptyHintY = computed(() => Math.min(76, (tabRows.value[0]?.top ?? 80) - 4))

// Each mounted ClassicalRowSurface redraws itself when its row changes.
const { isActive: classicalNotationActive } = useClassicalNotation(props.trackId, props.voiceId)

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

// transform and transition are set on the element by usePlaybackBarState (once per beat).
const playbackBarStyle = computed(() => ({
  display: playbackBarState.visible ? 'block' : 'none',
  pointerEvents: 'none',
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
  clearSelection,
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

.tab-empty-hint {
  fill: var(--tab-subtle);
  pointer-events: none;
}
</style> 