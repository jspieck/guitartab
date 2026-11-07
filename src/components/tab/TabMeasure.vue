<template>
  <g v-if="!hidden" class="tab-measure" :transform="`translate(${xOffset}, 0)`">
    <!-- Measure number -->
    <text
      v-if="barNumber"
      x="0" 
      y="-5" 
      font-family="Source Sans Pro" 
      font-size="12px" 
      class="block-number"
    >
      {{ blockId }}
    </text>
    
    <!-- Chord diagrams -->
    <ChordDiagram
      v-for="(chord, index) in chordsToShow"
      :key="`chord-${index}`"
      :chord-data="chord.data"
      :x-offset="chord.x"
      :y-offset="chord.y"
      :num-strings="numStrings"
    />
    
    <!-- Notes -->
    <g class="notes">
      <TabNote
        v-for="(beat, beatIndex) in measureData"
        :key="`beat-${beatIndex}`"
        :beat-data="beat"
        :beat-index="beatIndex"
        :x-offset="getBeatXOffset(beatIndex)"
        :beat-width="getBeatWidth(beatIndex)"
        :string-spacing="stringSpacing"
        :num-strings="numStrings"
        :voice-id="voiceId"
        :drums="drums"
      />
    </g>
    
    <!-- Effects -->
    <TabEffects
      :measure-data="measureData"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="blockId"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :measure-width="measureWidth"
      :lanes="lanes"
    />
    
    <!-- Multi-bar rest: an H-bar across the bar, the number of bars above the strings -->
    <g v-if="multiRest" class="multi-rest">
      <rect :x="multiRestBox.left" :y="multiRestBox.y - 4" :width="multiRestBox.right - multiRestBox.left" height="8" class="multi-rest-bar" />
      <line :x1="multiRestBox.left" :x2="multiRestBox.left" :y1="multiRestBox.y - 9" :y2="multiRestBox.y + 9" stroke-width="2" class="multi-rest-end" />
      <line :x1="multiRestBox.right" :x2="multiRestBox.right" :y1="multiRestBox.y - 9" :y2="multiRestBox.y + 9" stroke-width="2" class="multi-rest-end" />
      <text :x="(multiRestBox.left + multiRestBox.right) / 2" y="-3" font-family="Source Sans Pro" font-size="14px" font-weight="bold" text-anchor="middle" class="multi-rest-count">{{ multiRest }}</text>
    </g>

    <!-- Duration beams/rests -->
    <TabDurations
      v-if="!multiRest"
      :measure-data="measureData"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="blockId"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :measure-width="measureWidth"
      :lanes="lanes"
      :stems-up="stemsUp"
    />

    <!-- The other voice, faint, over the rests (utils/otherVoiceNotes.ts) -->
    <g v-if="otherNotes.length > 0" class="other-voice-notes" :class="{ 'other-voice-notes--voice2': voiceId === 0 }">
      <text
        v-for="(note, index) in otherNotes"
        :key="`other-${index}`"
        :x="note.x"
        :y="stringLine(note.string, numStrings) * stringSpacing + 5"
        font-family="Source Sans Pro"
        font-size="13px"
        text-anchor="middle"
        class="other-voice-note"
      >
        {{ drums && /^\d+$/.test(note.text) ? drumSymbol(Number(note.text)) : note.text }}
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabNote from './TabNote.vue'
import { drumSymbol } from '../../utils/drumMap'
import TabEffects from './TabEffects.vue'
import ChordDiagram from './ChordDiagram.vue'
import TabDurations from './TabDurations.vue'
import type { TabBeat, TabChordData } from '../../types/tab'
import {
  barLeftOffset,
  barOtherVoiceNotes,
  beatNoteOffset,
  getMeasureBeatWidth,
  getMeasureBeatX,
} from '../../utils/measureBeatLayout'
import { beatKey, LANE_HEIGHTS, MEASURE_NUMBER_STRIP, type RowLanes } from '../../utils/tabRowLanes'
import { CHORD_DIAGRAM_NAME_HEIGHT, CHORD_DIAGRAM_WIDTH } from './chordDiagramGeometry'
import Song from '../../stores/song'
import { tabStemsGoUp } from '../../utils/otherVoiceNotes'
import Settings from '../../stores/settingsState'
import { stringLine } from '../../utils/tabStrings'

interface RenderedChordDiagramData {
  name: string
  frets: number[]
  fingers: number[]
  display: boolean
}

interface RenderedChordPlacement {
  data: RenderedChordDiagramData
  x: number
  y: number
}

// Props
interface Props {
  measureData: TabBeat[]
  trackId: number
  voiceId: number
  blockId: number
  xOffset: number
  stringSpacing: number
  numStrings: number
  contentPadding?: number
  width?: number
  lanes?: RowLanes
  /** Multi-bar rest: the number of empty bars this bar stands for. */
  multiRest?: number
  /** Inside a multi-bar rest after its first bar: nothing is drawn. */
  hidden?: boolean
  /** Score view: only a system's top staff numbers its bars. */
  barNumber?: boolean
  /** A drum track: hits drawn as x and o. */
  drums?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 0,
  width: 200,
  multiRest: undefined,
  hidden: false,
  barNumber: true,
  drums: false,
})

// Constants
const measureWidth = computed(() => props.width)

// Methods
function getBeatXOffset(beatIndex: number): number {
  return getMeasureBeatX(
    props.trackId,
    props.voiceId,
    props.blockId,
    beatIndex,
    props.measureData,
  )
}

function getBeatWidth(beatIndex: number): number {
  return getMeasureBeatWidth(
    props.trackId,
    props.voiceId,
    props.blockId,
    beatIndex,
    props.measureData,
  )
}

const multiRestBox = computed(() => ({
  left: barLeftOffset(props.blockId) + 4,
  right: props.width - 14,
  y: ((props.numStrings - 1) * props.stringSpacing) / 2,
}))

const otherNotes = computed(() =>
  barOtherVoiceNotes(props.trackId, props.voiceId, props.blockId, props.measureData),
)

const stemsUp = computed(() =>
  tabStemsGoUp(
    Settings.tabRhythmOnStems,
    props.voiceId,
    Song.measures[props.trackId]?.[props.blockId]?.[props.voiceId === 0 ? 1 : 0],
  ),
)

const chordsToShow = computed<RenderedChordPlacement[]>(() => {
  const chords: RenderedChordPlacement[] = []

  props.measureData.forEach((beat, beatIndex) => {
    const chord = beat?.chord as TabChordData | null | undefined

    if (chord) {
      // Diagrams sit in the row's chord lane (one line per horizontal clash), centred on the beat.
      const lane = props.lanes?.above.chord
      const line = props.lanes?.chordLine[beatKey(props.blockId, beatIndex)] ?? 0
      const laneTop = lane?.top ?? -MEASURE_NUMBER_STRIP - LANE_HEIGHTS.chord
      chords.push({
        data: {
          name: chord.name || 'Unknown',
          frets: chord.frets || [],
          fingers: chord.fingers || [],
          display: chord.display !== false,
        },
        x: getBeatXOffset(beatIndex) + beatNoteOffset(beat, getBeatWidth(beatIndex)) - CHORD_DIAGRAM_WIDTH / 2,
        y: laneTop + line * LANE_HEIGHTS.chord + CHORD_DIAGRAM_NAME_HEIGHT,
      })
    }
  })

  return chords
})
</script>

<style scoped>
.tab-measure {
  /* SVG styles are handled by attributes */
}

/* The halo in the page colour keeps them readable over a rest of the edited voice. */
.other-voice-note {
  fill: var(--tab-primary);
  fill-opacity: 0.4;
  stroke: var(--tab-bg);
  stroke-width: 3px;
  paint-order: stroke;
  user-select: none;
}

.other-voice-notes--voice2 .other-voice-note {
  fill: var(--tab-voice2);
  fill-opacity: 0.6;
}

.multi-rest-bar {
  fill: var(--tab-primary);
}

.multi-rest-end {
  stroke: var(--tab-primary);
}

.multi-rest-count {
  fill: var(--tab-primary);
}

.block-number {
  font-size: 10px;
  opacity: 0.7;
  fill: var(--tab-secondary);
}
</style> 