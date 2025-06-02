<template>
  <g class="tab-measure" :transform="`translate(${xOffset}, 0)`">
    <!-- Measure number -->
    <text 
      x="0" 
      y="-5" 
      font-family="Source Sans Pro" 
      font-size="12px" 
      fill="#666"
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
      :x-offset="0"
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

// Props
interface Props {
  measureData: any[] // TODO: Type this properly once we align with existing data
  trackId: number
  voiceId: number
  blockId: number
  xOffset: number
  stringSpacing: number
  numStrings: number
}

const props = defineProps<Props>()

// Constants
const beatWidth = 40 // Base width per beat
const measureWidth = 200 // Total measure width

// Computed properties
const chordsToShow = computed(() => {
  const chords: Array<{data: any, x: number}> = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.chordPresent && beat?.chord) {
      chords.push({
        data: {
          name: beat.chord.name || 'Unknown',
          frets: beat.chord.frets || [],
          fingers: beat.chord.fingers || [],
          display: beat.chord.display !== false
        },
        x: getBeatXOffset(beatIndex)
      })
    }
  })
  
  return chords
})

// Methods
function getBeatXOffset(beatIndex: number): number {
  return beatIndex * beatWidth
}
</script>

<style scoped>
.tab-measure {
  /* SVG styles are handled by attributes */
}

.block-number {
  font-size: 10px;
  opacity: 0.7;
}
</style> 