<template>
  <g class="tab-measure" :transform="`translate(${xOffset}, 0)`">
    <!-- Measure number -->
    <text 
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
    
    <!-- Duration beams/rests -->
    <TabDurations
      :measure-data="measureData"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="blockId"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :measure-width="measureWidth"
      :lanes="lanes"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabNote from './TabNote.vue'
import TabEffects from './TabEffects.vue'
import ChordDiagram from './ChordDiagram.vue'
import TabDurations from './TabDurations.vue'
import type { TabBeat, TabChordData } from '../../types/tab'
import { getMeasureBeatWidth, getMeasureBeatX } from '../../utils/measureBeatLayout'
import { beatKey, LANE_HEIGHTS, MEASURE_NUMBER_STRIP, type RowLanes } from '../../utils/tabRowLanes'
import { CHORD_DIAGRAM_NAME_HEIGHT, CHORD_DIAGRAM_WIDTH } from './chordDiagramGeometry'

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
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 0,
  width: 200
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
        x: getBeatXOffset(beatIndex) + getBeatWidth(beatIndex) / 2 - CHORD_DIAGRAM_WIDTH / 2,
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

.block-number {
  font-size: 10px;
  opacity: 0.7;
  fill: var(--tab-secondary);
}
</style> 