<template>
  <g class="chord-diagram" :transform="`translate(${xOffset}, ${yOffset})`">
    <!-- Chord name -->
    <text
      :x="diagramWidth / 2"
      y="-5"
      font-family="Source Sans Pro"
      font-size="14px"
      font-weight="bold"
      fill="#000"
      text-anchor="middle"
      class="chord-name"
    >
      {{ chordData.name }}
    </text>
    
    <!-- Chord diagram grid -->
    <g class="diagram-grid">
      <!-- Fret lines (horizontal) -->
      <line
        v-for="fret in visibleFrets"
        :key="`fret-${fret}`"
        :x1="0"
        :x2="diagramWidth"
        :y1="(fret - startFret) * fretHeight"
        :y2="(fret - startFret) * fretHeight"
        stroke="#333"
        :stroke-width="fret === 0 ? 3 : 1"
      />
      
      <!-- String lines (vertical) -->
      <line
        v-for="stringIndex in numStrings"
        :key="`string-${stringIndex}`"
        :x1="(stringIndex - 1) * stringSpacing"
        :x2="(stringIndex - 1) * stringSpacing"
        :y1="0"
        :y2="diagramHeight"
        stroke="#333"
        stroke-width="1"
      />
    </g>
    
    <!-- Finger positions -->
    <g class="finger-positions">
      <circle
        v-for="(position, index) in fingerPositions"
        :key="`finger-${index}`"
        :cx="position.x"
        :cy="position.y"
        :r="6"
        fill="#333"
        stroke="#fff"
        stroke-width="1"
        class="finger-dot"
      />
      
      <!-- Finger numbers -->
      <text
        v-for="(position, index) in fingerPositions"
        :key="`finger-num-${index}`"
        :x="position.x"
        :y="position.y + 4"
        font-family="Source Sans Pro"
        font-size="10px"
        font-weight="bold"
        fill="#fff"
        text-anchor="middle"
        class="finger-number"
        v-if="position.finger > 0"
      >
        {{ position.finger }}
      </text>
    </g>
    
    <!-- Muted/Open string indicators -->
    <g class="string-indicators">
      <text
        v-for="(indicator, index) in stringIndicators"
        :key="`indicator-${index}`"
        :x="indicator.x"
        :y="indicator.y"
        font-family="Source Sans Pro"
        font-size="12px"
        font-weight="bold"
        :fill="indicator.type === 'muted' ? '#f00' : '#000'"
        text-anchor="middle"
        class="string-indicator"
      >
        {{ indicator.symbol }}
      </text>
    </g>
    
    <!-- Fret number indicator -->
    <text
      v-if="startFret > 0"
      :x="-10"
      :y="fretHeight + 4"
      font-family="Source Sans Pro"
      font-size="10px"
      fill="#666"
      text-anchor="middle"
      class="fret-number"
    >
      {{ startFret + 1 }}fr
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ChordData {
  name: string
  frets: number[]
  fingers?: number[]
  capo?: number
  display?: boolean
}

// Props
interface Props {
  chordData: ChordData
  xOffset: number
  yOffset: number
  numStrings?: number
}

const props = withDefaults(defineProps<Props>(), {
  numStrings: 6
})

// Constants
const stringSpacing = 12
const fretHeight = 15
const diagramWidth = computed(() => (props.numStrings - 1) * stringSpacing)
const diagramHeight = 4 * fretHeight
const numFrets = 4

// Computed properties
const startFret = computed(() => {
  if (!props.chordData.frets) return 0
  
  const playedFrets = props.chordData.frets.filter(fret => fret > 0)
  if (playedFrets.length === 0) return 0
  
  const minFret = Math.min(...playedFrets)
  return minFret > 4 ? minFret - 1 : 0
})

const visibleFrets = computed(() => {
  const frets = []
  for (let i = startFret.value; i <= startFret.value + numFrets; i++) {
    frets.push(i)
  }
  return frets
})

const fingerPositions = computed(() => {
  if (!props.chordData.frets) return []
  
  const positions: Array<{x: number, y: number, finger: number}> = []
  
  props.chordData.frets.forEach((fret, stringIndex) => {
    if (fret > 0) {
      const x = stringIndex * stringSpacing
      const y = (fret - startFret.value - 0.5) * fretHeight
      const finger = props.chordData.fingers?.[stringIndex] || 0
      
      // Only show if within diagram bounds
      if (y >= 0 && y <= diagramHeight) {
        positions.push({ x, y, finger })
      }
    }
  })
  
  return positions
})

const stringIndicators = computed(() => {
  if (!props.chordData.frets) return []
  
  const indicators: Array<{x: number, y: number, symbol: string, type: string}> = []
  
  props.chordData.frets.forEach((fret, stringIndex) => {
    const x = stringIndex * stringSpacing
    const y = -15
    
    if (fret === 0) {
      // Open string
      indicators.push({
        x,
        y,
        symbol: 'o',
        type: 'open'
      })
    } else if (fret === -1) {
      // Muted string
      indicators.push({
        x,
        y,
        symbol: 'x',
        type: 'muted'
      })
    }
  })
  
  return indicators
})
</script>

<style scoped>
.chord-diagram {
  /* SVG styles handled by attributes */
}

.chord-name {
  font-weight: bold;
}

.finger-dot {
  fill: #333;
}

.finger-number {
  font-weight: bold;
  font-size: 10px;
}

.string-indicator {
  font-weight: bold;
}

.fret-number {
  font-size: 10px;
  opacity: 0.7;
}
</style> 