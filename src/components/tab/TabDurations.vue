<template>
  <g class="tab-durations">
    <!-- Duration beams -->
    <g v-if="hasBeams" class="duration-beams">
      <path
        v-for="(beam, index) in durationBeams"
        :key="`beam-${index}`"
        :d="beam.path"
        stroke="#333"
        stroke-width="2"
        fill="none"
        class="duration-beam"
      />
    </g>
    
    <!-- Stems -->
    <g v-if="hasStems" class="note-stems">
      <line
        v-for="(stem, index) in noteStems"
        :key="`stem-${index}`"
        :x1="stem.x"
        :x2="stem.x"
        :y1="stem.y1"
        :y2="stem.y2"
        stroke="#333"
        stroke-width="1"
        class="note-stem"
      />
    </g>
    
    <!-- Rest symbols -->
    <g v-if="hasRests" class="rests">
      <text
        v-for="(rest, index) in restSymbols"
        :key="`rest-${index}`"
        :x="rest.x"
        :y="rest.y"
        font-family="Source Sans Pro"
        font-size="20px"
        fill="#333"
        text-anchor="middle"
        class="rest-symbol"
      >
        {{ rest.symbol }}
      </text>
    </g>
    
    <!-- Tuplet brackets -->
    <g v-if="hasTuplets" class="tuplets">
      <g
        v-for="(tuplet, index) in tupletBrackets"
        :key="`tuplet-${index}`"
        class="tuplet-bracket"
      >
        <!-- Bracket line -->
        <path
          :d="tuplet.bracketPath"
          stroke="#333"
          stroke-width="1"
          fill="none"
        />
        <!-- Tuplet number -->
        <text
          :x="tuplet.textX"
          :y="tuplet.textY"
          font-family="Source Sans Pro"
          font-size="12px"
          fill="#333"
          text-anchor="middle"
          class="tuplet-number"
        >
          {{ tuplet.number }}
        </text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  measureData: any[]
  trackId: number
  voiceId: number
  blockId: number
  xOffset: number
  stringSpacing: number
  numStrings: number
  measureWidth: number
}

const props = defineProps<Props>()

// Duration mapping for beams
const durationBeamCounts = {
  'eighth': 1,
  'sixteenth': 2,
  'thirty-second': 3,
  'sixty-fourth': 4
}

// Computed properties
const durationBeams = computed(() => {
  const beams: Array<{path: string, duration: string}> = []
  let currentBeamGroup: Array<{beatIndex: number, x: number, beamCount: number}> = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat && beat.duration) {
      const beamCount = durationBeamCounts[beat.duration as keyof typeof durationBeamCounts] || 0
      const beatX = props.xOffset + (beatIndex * 40) + 10
      
      if (beamCount > 0) {
        // Check if this note has actual notes (not empty)
        const hasNotes = beat.notes && beat.notes.some((note: any) => note !== null)
        
        if (hasNotes) {
          currentBeamGroup.push({
            beatIndex,
            x: beatX,
            beamCount
          })
        } else if (currentBeamGroup.length > 0) {
          // End current beam group
          if (currentBeamGroup.length > 1) {
            beams.push(...createBeamPaths(currentBeamGroup))
          }
          currentBeamGroup = []
        }
      } else if (currentBeamGroup.length > 0) {
        // End beam group on different duration
        if (currentBeamGroup.length > 1) {
          beams.push(...createBeamPaths(currentBeamGroup))
        }
        currentBeamGroup = []
      }
    }
  })
  
  // Handle remaining beam group
  if (currentBeamGroup.length > 1) {
    beams.push(...createBeamPaths(currentBeamGroup))
  }
  
  return beams
})

const noteStems = computed(() => {
  const stems: Array<{x: number, y1: number, y2: number}> = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat && beat.notes && beat.notes.some((note: any) => note !== null)) {
      const duration = beat.duration
      if (duration && ['eighth', 'sixteenth', 'thirty-second', 'sixty-fourth'].includes(duration)) {
        const beatX = props.xOffset + (beatIndex * 40) + 10
        
        // Find the highest and lowest notes for stem placement
        let highestString = -1
        let lowestString = -1
        
        beat.notes.forEach((note: any, stringIndex: number) => {
          if (note !== null) {
            if (highestString === -1 || stringIndex < highestString) {
              highestString = stringIndex
            }
            if (lowestString === -1 || stringIndex > lowestString) {
              lowestString = stringIndex
            }
          }
        })
        
        if (highestString !== -1) {
          const stemTop = (props.numStrings - 1 - highestString) * props.stringSpacing - 30
          const stemBottom = (props.numStrings - 1 - lowestString) * props.stringSpacing + 5
          
          stems.push({
            x: beatX,
            y1: stemTop,
            y2: stemBottom
          })
        }
      }
    }
  })
  
  return stems
})

const restSymbols = computed(() => {
  const rests: Array<{x: number, y: number, symbol: string}> = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat && (!beat.notes || beat.notes.every((note: any) => note === null))) {
      // This is a rest
      const beatX = props.xOffset + (beatIndex * 40) + 10
      const restY = ((props.numStrings - 1) * props.stringSpacing) / 2
      
      const symbol = getRestSymbol(beat.duration)
      if (symbol) {
        rests.push({
          x: beatX,
          y: restY,
          symbol
        })
      }
    }
  })
  
  return rests
})

const tupletBrackets = computed(() => {
  const tuplets: Array<{
    bracketPath: string, 
    textX: number, 
    textY: number, 
    number: number
  }> = []
  
  // Find tuplet groups
  let currentTuplet: Array<{beatIndex: number, x: number}> = []
  let tupletValue = 0
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat && beat.tuplet && beat.tuplet > 0) {
      const beatX = props.xOffset + (beatIndex * 40) + 10
      
      if (tupletValue === 0 || tupletValue === beat.tuplet) {
        tupletValue = beat.tuplet
        currentTuplet.push({ beatIndex, x: beatX })
      } else {
        // End current tuplet, start new one
        if (currentTuplet.length > 1) {
          tuplets.push(createTupletBracket(currentTuplet, tupletValue))
        }
        currentTuplet = [{ beatIndex, x: beatX }]
        tupletValue = beat.tuplet
      }
    } else if (currentTuplet.length > 0) {
      // End current tuplet
      if (currentTuplet.length > 1) {
        tuplets.push(createTupletBracket(currentTuplet, tupletValue))
      }
      currentTuplet = []
      tupletValue = 0
    }
  })
  
  // Handle remaining tuplet
  if (currentTuplet.length > 1) {
    tuplets.push(createTupletBracket(currentTuplet, tupletValue))
  }
  
  return tuplets
})

// Helper computed properties
const hasBeams = computed(() => durationBeams.value.length > 0)
const hasStems = computed(() => noteStems.value.length > 0)
const hasRests = computed(() => restSymbols.value.length > 0)
const hasTuplets = computed(() => tupletBrackets.value.length > 0)

// Helper functions
function createBeamPaths(beamGroup: Array<{beatIndex: number, x: number, beamCount: number}>) {
  const beams: Array<{path: string, duration: string}> = []
  const minBeamCount = Math.min(...beamGroup.map(b => b.beamCount))
  
  for (let level = 0; level < minBeamCount; level++) {
    const startX = beamGroup[0].x
    const endX = beamGroup[beamGroup.length - 1].x
    const y = -35 - (level * 4) // Stack beams vertically
    
    const path = `M${startX} ${y}L${endX} ${y}`
    beams.push({ path, duration: 'beam' })
  }
  
  return beams
}

function getRestSymbol(duration: string): string {
  switch (duration) {
    case 'whole': return '■'
    case 'half': return '▪'
    case 'quarter': return '𝄽'
    case 'eighth': return '𝄾'
    case 'sixteenth': return '𝄿'
    default: return '𝄽'
  }
}

function createTupletBracket(
  tupletGroup: Array<{beatIndex: number, x: number}>, 
  number: number
) {
  const startX = tupletGroup[0].x - 5
  const endX = tupletGroup[tupletGroup.length - 1].x + 5
  const y = -50
  const bracketHeight = 8
  
  // Create bracket path (squared bracket shape)
  const bracketPath = `M${startX} ${y}L${startX} ${y - bracketHeight}L${endX} ${y - bracketHeight}L${endX} ${y}`
  
  return {
    bracketPath,
    textX: (startX + endX) / 2,
    textY: y - bracketHeight - 5,
    number
  }
}
</script>

<style scoped>
.tab-durations {
  /* SVG styles handled by attributes */
}

.duration-beam {
  stroke: #333;
}

.note-stem {
  stroke: #333;
}

.rest-symbol {
  user-select: none;
}

.tuplet-number {
  font-size: 12px;
  user-select: none;
}
</style> 