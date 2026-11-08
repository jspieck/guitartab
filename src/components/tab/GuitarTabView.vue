<template>
  <div class="guitar-tab-view" ref="tabContainer">
    <svg 
      ref="svgRoot"
      :width="pageWidth" 
      :height="totalHeight"
      class="tab-svg"
      @mousedown="handleMouseDown"
      @contextmenu.prevent="handleContextMenu"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @keydown="handleKeyDown"
      tabindex="0"
      role="application"
      aria-roledescription="tablature editor"
      aria-label="Tablature. Arrow keys move the cursor, digits enter frets, question mark lists all shortcuts."
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
        
        <!-- Score view: a bracket over each system, the track names at its staves -->
        <g v-if="scoreStaves.length > 0" class="score-labels" pointer-events="none">
          <path
            v-for="system in scoreBrackets"
            :key="`bracket-${system.id}`"
            :d="`M -2 ${system.top} H -5 V ${system.bottom} H -2`"
            class="score-bracket"
          />
          <text
            v-for="staff in scoreStaves"
            :key="staff.key"
            x="-9"
            :y="staff.middle + 4"
            font-family="Source Sans Pro"
            font-size="11px"
            text-anchor="end"
            class="score-track-name"
            :class="{ 'score-track-name--edited': staff.edited }"
          >
            {{ staff.name }}
          </text>
        </g>

        <!-- Simple tab rows -->
        <TabRow
          v-for="row in visibleTabRows"
          :key="`row-${row.trackId ?? trackId}-${row.id}-${row.startBlockId}`"
          :row-data="row"
          :track-id="row.trackId ?? trackId"
          :voice-id="row.voiceId ?? voiceId"
          :svg-root="svgRoot"
          :y-offset="row.yOffset"
          :width="tabGroupWidth"
          :label-gutter="row.labelGutter ?? row.id === 0"
          :on-string-pointer-down="handleStringPointerDown"
          :on-loop-handle-down="handleLoopHandleDown"
        />

        <!-- Vue playback bar -->
        <g
          ref="playbackBarGroup"
          id="playBackBarGroup0"
          :style="playbackBarStyle"
        >
          <rect x="0" :y="playheadSpan.top" width="2" :height="playheadSpan.height" style="fill: var(--tab-playhead)" />
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
import { useTabSelectionBridge } from '../../composables/useTabSelectionBridge'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import editorCore from '../../services/editor/editorCore'
import { layoutModeState } from '../../stores/layoutModeState'
import { noteMenuState, openNoteMenu } from '../../stores/toolbarUiState'
import { openNoteMenuAtCursor } from '../../services/editor/noteMenu'
import { switchTrack } from '../../services/editor/trackLoading'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import Song from '../../stores/song'

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

const { reactiveSongData } = useSongData()

const {
  currentSelection,
  clearSelection,
  setSelection,
} = useTabSelection()

const { playbackBarState } = usePlaybackBarState()
const { registerNavigationSelectionBridge } = useTabSelectionBridge(setSelection)

const tabContainer = ref<HTMLElement | null>(null)
const svgRoot = ref<SVGSVGElement | null>(null)
const playbackBarGroup = ref<SVGGElement | null>(null)
let unregisterSelectionBridge = () => {}

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
} = useGuitarTabLayout(props)

const { visibleTabRows } = useVisibleTabRows(tabRows, paddingTop, svgRoot)

/** Bottom string line of a row, relative to its top string. */
function stringsHeight(trackId: number): number {
  return (editorCore.getTrackStringCount(trackId) - 1) * TAB_CONSTANTS.STRING_SPACING
}

/** "Rhythm Guitar" -> "Rhythm"; names are drawn in the page margin left of the staff. */
function shortTrackName(trackId: number): string {
  const name = (Song.tracks[trackId]?.name || `Track ${trackId + 1}`).trim()
  const first = name.split(/\s+/)[0]
  return first.length > 8 ? `${first.slice(0, 7)}.` : first
}

const scoreStaves = computed(() =>
  visibleTabRows.value
    .filter((row) => row.trackId != null)
    .map((row) => ({
      key: `name-${row.trackId}-${row.id}`,
      name: shortTrackName(row.trackId!),
      middle: row.yOffset + stringsHeight(row.trackId!) / 2,
      edited: row.trackId === props.trackId,
    })),
)

/** Each system's staves, from the top string of the first to the bottom string of the last. */
const scoreSystemSpans = computed(() => {
  const spans = new Map<number, { id: number; top: number; bottom: number }>()
  for (const row of tabRows.value) {
    if (row.trackId == null) continue
    const bottom = row.yOffset + stringsHeight(row.trackId)
    const span = spans.get(row.id)
    if (span == null) spans.set(row.id, { id: row.id, top: row.yOffset, bottom })
    else {
      span.top = Math.min(span.top, row.yOffset)
      span.bottom = Math.max(span.bottom, bottom)
    }
  }
  return spans
})

const scoreBrackets = computed(() => {
  const shown = new Set(visibleTabRows.value.map((row) => row.id))
  return [...scoreSystemSpans.value.values()].filter((system) => shown.has(system.id))
})

/** The playhead, relative to the playing row's top string: across the whole system in the score view. */
const playheadSpan = computed(() => {
  const y = playbackBarState.y
  const row = tabRows.value.find((candidate) => candidate.yOffset === y && (candidate.trackId ?? props.trackId) === props.trackId)
  const system = row != null ? scoreSystemSpans.value.get(row.id) : undefined
  if (system == null) return { top: -5, height: getPlaybackBarHeight(y) + 5 }
  return { top: system.top - y - 5, height: system.bottom - system.top + 10 }
})

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
  handleLoopHandleDown,
  selectForContextMenu,
  clearRangeSelection,
} = useTabRangeSelection({
  svgRoot,
  tabRows,
  trackId: () => props.trackId,
  voiceId: () => props.voiceId,
  rowHeight,
  getMeasureContentPadding,
  onSingleSelect: (selection) => {
    clearRangeSelection()
    // a click in another track of the score, or on a faint note of the other voice, edits that
    if (selection.trackId !== props.trackId || selection.voiceId !== props.voiceId) {
      switchTrack(selection.trackId, selection.voiceId)
    }
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

/** Right-click or long-press on a string: select the beat and open the note menu there (Shift+F10: at the cursor). */
function handleContextMenu(event: MouseEvent) {
  if (noteMenuState.open) return
  const string = (event.target as Element | null)?.getAttribute?.('data-string')
  if (string != null && selectForContextMenu(event, Number(string))) {
    // On a phone (a long-press, services/touchGestures.ts) it is a bottom sheet.
    openNoteMenu(event.clientX, event.clientY, { sheet: layoutModeState.compact })
  } else {
    openNoteMenuAtCursor()
  }
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

  svgRoot.value?.focus()
})

onUnmounted(() => {
  unregisterSelectionBridge()
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

.score-bracket {
  fill: none;
  stroke: var(--tab-primary);
  stroke-width: 2;
}

.score-track-name {
  fill: var(--tab-secondary);
}

.score-track-name--edited {
  fill: var(--tab-primary);
  font-weight: 600;
}

.tab-empty-hint {
  fill: var(--tab-subtle);
  pointer-events: none;
}
</style> 