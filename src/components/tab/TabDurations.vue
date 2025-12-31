<template>
  <g class="tab-durations">
    <!-- Duration beams connecting notes -->
    <g v-if="beams.length > 0" class="duration-beams">
      <path
        v-for="(beam, index) in beams"
        :key="`beam-${index}`"
        :d="beam.path"
        stroke="#333"
        stroke-width="2"
        fill="none"
      />
    </g>
    
    <!-- Note stems -->
    <g v-if="stems.length > 0" class="note-stems">
      <line
        v-for="(stem, index) in stems"
        :key="`stem-${index}`"
        :x1="stem.x"
        :x2="stem.x"
        :y1="stem.y1"
        :y2="stem.y2"
        stroke="#333"
        stroke-width="1"
      />
    </g>
    
    <!-- Rest symbols -->
    <g v-if="rests.length > 0" class="rests">
      <text
        v-for="(rest, index) in rests"
        :key="`rest-${index}`"
        :x="rest.x"
        :y="rest.y"
        font-family="Bravura, Sonata, serif"
        font-size="24px"
        fill="#333"
        text-anchor="middle"
        class="rest-symbol"
      >
        {{ rest.symbol }}
      </text>
    </g>
    
    <!-- Tuplet brackets -->
    <g v-if="tuplets.length > 0" class="tuplets">
      <g v-for="(tuplet, index) in tuplets" :key="`tuplet-${index}`">
        <path
          :d="tuplet.bracketPath"
          stroke="#333"
          stroke-width="1"
          fill="none"
        />
        <text
          :x="tuplet.textX"
          :y="tuplet.textY"
          font-family="Source Sans Pro"
          font-size="12px"
          fill="#333"
          text-anchor="middle"
        >
          {{ tuplet.number }}
        </text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import {
  getDurationBeats,
  getRestSymbol,
  getBeamCount,
  isRest,
  beatHasNotes,
  getNoteStringPositions,
  isRestDuration
} from '../../utils/durationUtils'

// =============================================================================
// Types
// =============================================================================

interface Beam {
  path: string
}

interface Stem {
  x: number
  y1: number
  y2: number
}

interface Rest {
  x: number
  y: number
  symbol: string
}

interface Tuplet {
  bracketPath: string
  textX: number
  textY: number
  number: number
}

interface BeatPosition {
  beatIndex: number
  x: number
  beamCount: number
}

// =============================================================================
// Props
// =============================================================================

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

// =============================================================================
// Constants
// =============================================================================

const { BEAT_WIDTH } = TAB_CONSTANTS
const STEM_TOP_OFFSET = 30
const STEM_BOTTOM_OFFSET = 5
const BEAM_Y_START = -35
const BEAM_Y_SPACING = 4

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate X position for a beat based on cumulative duration
 */
function calculateBeatX(beatIndex: number): number {
  let cumulativeBeats = 0
  for (let i = 0; i < beatIndex; i++) {
    const beat = props.measureData[i]
    cumulativeBeats += getDurationBeats(beat?.duration)
  }
  return props.xOffset + (cumulativeBeats * BEAT_WIDTH) + 10
}

/**
 * Calculate Y position for a string
 */
function stringToY(stringIndex: number): number {
  return (props.numStrings - 1 - stringIndex) * props.stringSpacing
}

/**
 * Create beam paths for a group of connected notes
 */
function createBeamPaths(beamGroup: BeatPosition[]): Beam[] {
  if (beamGroup.length < 2) return []
  
  const minBeamCount = Math.min(...beamGroup.map(b => b.beamCount))
  const beams: Beam[] = []
  
  for (let level = 0; level < minBeamCount; level++) {
    const startX = beamGroup[0].x
    const endX = beamGroup[beamGroup.length - 1].x
    const y = BEAM_Y_START - (level * BEAM_Y_SPACING)
    beams.push({ path: `M${startX} ${y}L${endX} ${y}` })
  }
  
  return beams
}

/**
 * Create a tuplet bracket
 */
function createTupletBracket(group: { beatIndex: number; x: number }[], number: number): Tuplet {
  const startX = group[0].x - 5
  const endX = group[group.length - 1].x + 5
  const y = -50
  const bracketHeight = 8
  
  return {
    bracketPath: `M${startX} ${y}L${startX} ${y - bracketHeight}L${endX} ${y - bracketHeight}L${endX} ${y}`,
    textX: (startX + endX) / 2,
    textY: y - bracketHeight - 5,
    number
  }
}

// =============================================================================
// Computed Properties
// =============================================================================

/**
 * Calculate beam paths for connected eighth/sixteenth/etc notes
 */
const beams = computed((): Beam[] => {
  const result: Beam[] = []
  let currentGroup: BeatPosition[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const beamCount = getBeamCount(beat.duration)
    const hasNotes = beatHasNotes(beat)
    
    if (beamCount > 0 && hasNotes) {
      // Add to current beam group
      currentGroup.push({
        beatIndex,
        x: calculateBeatX(beatIndex),
        beamCount
      })
    } else if (currentGroup.length > 0) {
      // End current beam group
      result.push(...createBeamPaths(currentGroup))
      currentGroup = []
    }
  })
  
  // Handle remaining group
  if (currentGroup.length > 0) {
    result.push(...createBeamPaths(currentGroup))
  }
  
  return result
})

/**
 * Calculate stems for notes that need them
 */
const stems = computed((): Stem[] => {
  const result: Stem[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const beamCount = getBeamCount(beat.duration)
    if (beamCount === 0) return // No stem for quarter notes and longer
    
    const positions = getNoteStringPositions(beat)
    if (!positions) return // No notes
    
    const x = calculateBeatX(beatIndex)
    const y1 = stringToY(positions.highest) - STEM_TOP_OFFSET
    const y2 = stringToY(positions.lowest) + STEM_BOTTOM_OFFSET
    
    result.push({ x, y1, y2 })
  })
  
  return result
})

/**
 * Calculate rest symbols to display
 * Only shows rests for beats that are explicitly rests (duration ends with 'r')
 */
const rests = computed((): Rest[] => {
  const result: Rest[] = []
  const centerY = ((props.numStrings - 1) * props.stringSpacing) / 2
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat?.duration) return
    
    // Only show rest if duration explicitly ends with 'r'
    // This prevents showing rests for empty placeholder beats
    if (!isRestDuration(beat.duration)) return
    
    result.push({
      x: calculateBeatX(beatIndex),
      y: centerY + 5, // Slight offset for better centering
      symbol: getRestSymbol(beat.duration)
    })
  })
  
  return result
})

/**
 * Calculate tuplet brackets
 */
const tuplets = computed((): Tuplet[] => {
  const result: Tuplet[] = []
  let currentGroup: { beatIndex: number; x: number }[] = []
  let currentTupletValue = 0
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const tupletValue = beat.tuplet || 0
    
    if (tupletValue > 0) {
      if (currentTupletValue === 0 || currentTupletValue === tupletValue) {
        // Continue or start group
        currentTupletValue = tupletValue
        currentGroup.push({
          beatIndex,
          x: calculateBeatX(beatIndex)
        })
      } else {
        // Different tuplet value - end current and start new
        if (currentGroup.length > 1) {
          result.push(createTupletBracket(currentGroup, currentTupletValue))
        }
        currentTupletValue = tupletValue
        currentGroup = [{ beatIndex, x: calculateBeatX(beatIndex) }]
      }
    } else if (currentGroup.length > 0) {
      // End current tuplet group
      if (currentGroup.length > 1) {
        result.push(createTupletBracket(currentGroup, currentTupletValue))
      }
      currentGroup = []
      currentTupletValue = 0
    }
  })
  
  // Handle remaining group
  if (currentGroup.length > 1) {
    result.push(createTupletBracket(currentGroup, currentTupletValue))
  }
  
  return result
})
</script>

<style scoped>
.rest-symbol {
  user-select: none;
}
</style>
