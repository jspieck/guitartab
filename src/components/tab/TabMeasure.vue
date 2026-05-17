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
      :y-offset="-120"
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
      :x-offset="0"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :measure-width="measureWidth"
    />
    
    <!-- Duration beams/rests -->
    <TabDurations
      :measure-data="measureData"
      :track-id="trackId"
      :voice-id="voiceId"
      :block-id="blockId"
      :x-offset="contentPadding + START_PADDING"
      :string-spacing="stringSpacing"
      :num-strings="numStrings"
      :measure-width="measureWidth"
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
import { getDisplayWidth, TAB_CONSTANTS } from '../../utils/tabLayout'

interface RenderedChordDiagramData {
  name: string
  frets: number[]
  fingers: number[]
  display: boolean
}

interface RenderedChordPlacement {
  data: RenderedChordDiagramData
  x: number
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
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 0,
  width: 200
})

// Constants
const { START_PADDING } = TAB_CONSTANTS
const measureWidth = computed(() => props.width)

// Computed properties
const chordsToShow = computed<RenderedChordPlacement[]>(() => {
  const chords: RenderedChordPlacement[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    const chord = beat?.chord as TabChordData | null | undefined

    if (beat?.chordPresent && chord) {
      chords.push({
        data: {
          name: chord.name || 'Unknown',
          frets: chord.frets || [],
          fingers: chord.fingers || [],
          display: chord.display !== false,
        },
        x: getBeatXOffset(beatIndex),
      })
    }
  })
  
  return chords
})

// Methods
function getBeatXOffset(beatIndex: number): number {
  let x = 0
  for (let i = 0; i < beatIndex; i++) {
    const beat = props.measureData[i]
    x += getDisplayWidth(beat?.duration)
  }
  return props.contentPadding + START_PADDING + x
}
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