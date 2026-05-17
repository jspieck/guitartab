<template>
  <g class="tab-durations">
    <!-- Duration beams connecting notes -->
    <g v-if="beams.length > 0" class="duration-beams">
      <path
        v-for="(beam, index) in beams"
        :key="`beam-${index}`"
        :d="beam.path"
        :stroke-width="BEAM_THICKNESS"
        fill="none"
        class="beam-path"
      />
    </g>
    
    <!-- Note stems (vertical lines from note to beam/flag) -->
    <g v-if="stems.length > 0" class="note-stems">
      <line
        v-for="(stem, index) in stems"
        :key="`stem-${index}`"
        :x1="stem.x"
        :x2="stem.x"
        :y1="stem.y1"
        :y2="stem.y2"
        stroke-width="1"
        class="stem-line"
      />
    </g>
    
    <!-- Note flags (tails for single eighth/sixteenth notes) -->
    <g v-if="flags.length > 0" class="note-flags">
      <g v-for="(flag, index) in flags" :key="`flag-${index}`">
        <path
          v-for="(flagPath, fIndex) in flag.paths"
          :key="`flag-${index}-${fIndex}`"
          :d="flagPath"
          :stroke-width="BEAM_THICKNESS"
          fill="none"
          class="flag-path"
        />
      </g>
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
          stroke-width="1"
          fill="none"
          class="tuplet-bracket"
        />
        <text
          :x="tuplet.textX"
          :y="tuplet.textY"
          font-family="Source Sans Pro"
          font-size="12px"
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
import type { TabBeat } from '../../types/tab'
import { getDisplayWidth } from '../../utils/tabLayout'
import {
  getRestSymbol,
  getBeamCount,
  beatHasNotes,
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

interface Flag {
  x: number
  paths: string[]  // Multiple paths for multiple flags (16th = 2 flags, etc.)
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

interface Props {
  measureData: TabBeat[]
  trackId: number
  voiceId: number
  blockId: number
  xOffset: number
  stringSpacing: number
  numStrings: number
  measureWidth: number
}

const props = defineProps<Props>()

const BEAM_OFFSET_FROM_BOTTOM = 15  // Distance below the last string
const BEAM_SPACING = 6  // Vertical spacing between multiple beams (needs room for 2+ beams)
const BEAM_THICKNESS = 2  // Thickness of beam lines

function getBeamY(): number {
  return (props.numStrings - 1) * props.stringSpacing + BEAM_OFFSET_FROM_BOTTOM
}

function calculateBeatX(beatIndex: number): number {
  let cumulativeX = 0
  for (let i = 0; i < beatIndex; i++) {
    const beat = props.measureData[i]
    cumulativeX += getDisplayWidth(beat?.duration)
  }
  return props.xOffset + cumulativeX + 10
}

function getNoteCenterX(beatIndex: number): number {
  const beat = props.measureData[beatIndex]
  const displayWidth = getDisplayWidth(beat?.duration)
  const beatStartX = calculateBeatX(beatIndex)
  // Notes are centered in their display width
  return beatStartX + displayWidth / 2 - 5
}

/**
 * Create beam paths for a group of connected notes
 * Properly handles multiple beam levels (8th=1, 16th=2, 32nd=3, 64th=4)
 * 
 * Beaming rules:
 * - Primary beam (level 0) spans all notes in the group
 * - Secondary beams only connect ADJACENT pairs of notes that share that level
 * - For a note with fewer beams, secondary beams break at that note
 */
function createBeamPaths(beamGroup: BeatPosition[]): Beam[] {
  if (beamGroup.length < 2) return []
  
  const maxBeamCount = Math.max(...beamGroup.map(b => b.beamCount))
  if (maxBeamCount <= 0) return []
  
  const beams: Beam[] = []
  const beamY = getBeamY()
  
  // Primary beam (level 0) always spans the entire group
  const primaryY = beamY
  beams.push({ 
    path: `M${beamGroup[0].x} ${primaryY}L${beamGroup[beamGroup.length - 1].x} ${primaryY}` 
  })
  
  // Secondary beams (level 1+) - only connect adjacent notes that BOTH have this level
  for (let level = 1; level < maxBeamCount; level++) {
    const y = beamY + (level * BEAM_SPACING)
    
    for (let i = 0; i < beamGroup.length - 1; i++) {
      const current = beamGroup[i]
      const next = beamGroup[i + 1]
      
      // Both notes must have at least this many beams
      if (current.beamCount > level && next.beamCount > level) {
        beams.push({ path: `M${current.x} ${y}L${next.x} ${y}` })
      } else if (current.beamCount > level) {
        // Current note has more beams than next - draw a short "flag" beam
        // This is a partial beam pointing toward the next note
        const flagLength = Math.min(8, (next.x - current.x) / 3)
        beams.push({ path: `M${current.x} ${y}L${current.x + flagLength} ${y}` })
      } else if (next.beamCount > level && i === 0) {
        // First note doesn't have this level but next does - draw partial beam pointing back
        const flagLength = Math.min(8, (next.x - current.x) / 3)
        beams.push({ path: `M${next.x - flagLength} ${y}L${next.x} ${y}` })
      }
    }
    
    // Handle last note if it has more beams than second-to-last
    const lastIdx = beamGroup.length - 1
    const last = beamGroup[lastIdx]
    const secondLast = beamGroup[lastIdx - 1]
    if (last.beamCount > level && secondLast.beamCount <= level) {
      const flagLength = Math.min(8, (last.x - secondLast.x) / 3)
      beams.push({ path: `M${last.x - flagLength} ${y}L${last.x} ${y}` })
    }
  }
  
  return beams
}

function createTupletBracket(group: { beatIndex: number; x: number }[], number: number): Tuplet {
  const startX = group[0].x - 5
  const endX = group[group.length - 1].x + 5
  const beamY = getBeamY()
  const y = beamY + 25
  const bracketHeight = 8
  
  return {
    bracketPath: `M${startX} ${y}L${startX} ${y + bracketHeight}L${endX} ${y + bracketHeight}L${endX} ${y}`,
    textX: (startX + endX) / 2,
    textY: y + bracketHeight + 12,
    number
  }
}

const beamedBeatIndices = computed((): Set<number> => {
  const indices = new Set<number>()
  let currentGroup: number[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const beamCount = getBeamCount(beat.duration)
    const hasNotes = beatHasNotes(beat)
    
    if (beamCount > 0 && hasNotes) {
      currentGroup.push(beatIndex)
    } else {
      // Only mark as beamed if there are 2+ notes in the group
      if (currentGroup.length >= 2) {
        currentGroup.forEach(idx => indices.add(idx))
      }
      currentGroup = []
    }
  })
  
  // Handle remaining group
  if (currentGroup.length >= 2) {
    currentGroup.forEach(idx => indices.add(idx))
  }
  
  return indices
})

/**
 * Calculate beam paths for connected eighth/sixteenth/etc notes
 * Groups consecutive beamable notes and creates beams for groups of 2+
 */
const beams = computed((): Beam[] => {
  const result: Beam[] = []
  let currentGroup: BeatPosition[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const beamCount = getBeamCount(beat.duration)
    const hasNotes = beatHasNotes(beat)
    
    // Only beam notes (not rests) with beam count > 0 (eighth notes or shorter)
    if (beamCount > 0 && hasNotes) {
      currentGroup.push({
        beatIndex,
        x: getNoteCenterX(beatIndex),
        beamCount
      })
    } else {
      // End current beam group when we hit a non-beamable beat
      if (currentGroup.length >= 2) {
        result.push(...createBeamPaths(currentGroup))
      }
      currentGroup = []
    }
  })
  
  // Handle any remaining group at end of measure
  if (currentGroup.length >= 2) {
    result.push(...createBeamPaths(currentGroup))
  }
  
  return result
})

/**
 * Calculate stems for notes that need them
 * Stems are shown for all notes except whole notes
 * - Quarter notes get just a stem (no flag)
 * - Eighth notes get stem + 1 flag/beam
 * - Sixteenth notes get stem + 2 flags/beams
 */
const stems = computed((): Stem[] => {
  const result: Stem[] = []
  const beamY = getBeamY()
  const lastStringY = (props.numStrings - 1) * props.stringSpacing
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const hasNotes = beatHasNotes(beat)
    if (!hasNotes) return
    
    // Get base duration (without 'r' suffix)
    const baseDuration = beat.duration?.replace('r', '') || 'q'
    
    // Whole notes (w) and half notes (h) don't need stems in tab
    // Quarter notes (q) and shorter need stems
    if (baseDuration === 'w' || baseDuration === 'h' || baseDuration === 'whole' || baseDuration === 'half') {
      return
    }
    
    const x = getNoteCenterX(beatIndex)
    // Stem goes from just below the last string to the beam line
    const y1 = lastStringY + 5
    const y2 = beamY
    
    result.push({ x, y1, y2 })
  })
  
  return result
})

/**
 * Calculate flags for single notes that aren't connected by beams
 * Flags are the "tails" on eighth/sixteenth notes when not beamed
 */
const flags = computed((): Flag[] => {
  const result: Flag[] = []
  const FLAG_LENGTH = 10  // Length of the flag curve
  const beamY = getBeamY()
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat) return
    
    const beamCount = getBeamCount(beat.duration)
    const hasNotes = beatHasNotes(beat)
    
    // Only add flags for notes that:
    // 1. Have a beam count > 0 (eighth notes or shorter)
    // 2. Have notes (not a rest)
    // 3. Are NOT part of a beam group
    if (beamCount === 0 || !hasNotes || beamedBeatIndices.value.has(beatIndex)) return
    
    const x = getNoteCenterX(beatIndex)
    const paths: string[] = []
    
    // Create curved flag paths (one for each beam level)
    for (let level = 0; level < beamCount; level++) {
      const startY = beamY + (level * BEAM_SPACING)
      // Create a curved flag that goes to the right and down
      const path = `M${x} ${startY}Q${x + FLAG_LENGTH} ${startY + 3} ${x + FLAG_LENGTH - 2} ${startY + 10}`
      paths.push(path)
    }
    
    result.push({ x, paths })
  })
  
  return result
})

/**
 * Calculate rest symbols to display
 * Shows rests ONLY when beat has no notes at all
 * Never show rest if any note exists on the beat
 */
const rests = computed((): Rest[] => {
  const result: Rest[] = []
  const centerY = ((props.numStrings - 1) * props.stringSpacing) / 2
  
  props.measureData.forEach((beat, beatIndex) => {
    if (!beat?.duration) return
    
    // Check if this beat has any notes - be very thorough
    const hasNotes = beatHasNotes(beat)
    
    // Skip if beat has any notes - never show rest over notes
    if (hasNotes) return
    
    // Only show rest for beats with no notes
    result.push({
      x: calculateBeatX(beatIndex),
      y: centerY + 5,
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
.beam-path {
  stroke: var(--tab-muted);
}

.stem-line {
  stroke: var(--tab-muted);
}

.flag-path {
  stroke: var(--tab-muted);
}

.rest-symbol {
  fill: var(--tab-muted);
  user-select: none;
}

.tuplet-bracket {
  stroke: var(--tab-muted);
}

.tuplet-number {
  fill: var(--tab-muted);
}
</style>
