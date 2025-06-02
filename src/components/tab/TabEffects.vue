<template>
  <g class="tab-effects">
    <!-- Slides -->
    <g v-if="hasSlides" class="slides">
      <path
        v-for="(slide, index) in slides"
        :key="`slide-${index}`"
        :d="slide.path"
        stroke="#4f7cbb"
        stroke-width="1"
        fill="none"
        class="slide-path"
      />
    </g>
    
    <!-- Bends -->
    <g v-if="hasBends" class="bends">
      <path
        v-for="(bend, index) in bends"
        :key="`bend-${index}`"
        :d="bend.path"
        stroke="#111"
        stroke-width="1"
        fill="none"
        class="bend-path"
      />
      <!-- Bend arrows -->
      <path
        v-for="(bend, index) in bends"
        :key="`bend-arrow-${index}`"
        :d="bend.arrowPath"
        stroke="#111"
        stroke-width="1"
        fill="#000"
        class="bend-arrow"
        v-if="bend.arrowPath"
      />
    </g>
    
    <!-- Ties/Bows -->
    <g v-if="hasTies" class="ties">
      <path
        v-for="(tie, index) in ties"
        :key="`tie-${index}`"
        :d="tie.path"
        stroke="#111"
        stroke-width="1"
        fill="none"
        class="tie-path"
      />
    </g>
    
    <!-- Vibrato -->
    <g v-if="hasVibrato" class="vibrato">
      <path
        v-for="(vibrato, index) in vibratos"
        :key="`vibrato-${index}`"
        :d="vibrato.path"
        stroke="#111"
        stroke-width="1"
        fill="none"
        class="vibrato-path"
      />
    </g>
    
    <!-- Text effects (P.M., T, etc.) -->
    <g v-if="hasTextEffects" class="text-effects">
      <text
        v-for="(effect, index) in textEffects"
        :key="`text-effect-${index}`"
        :x="effect.x"
        :y="effect.y"
        font-family="Source Sans Pro"
        :font-size="effect.fontSize"
        fill="#000"
        text-anchor="middle"
        class="effect-text"
      >
        {{ effect.text }}
      </text>
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

// Computed properties for different effect types
const slides = computed(() => {
  const slideEffects = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.slide) {
          const startX = props.xOffset + (beatIndex * 40) + 14
          const endX = startX + 30 // Default slide length
          const yPos = (props.numStrings - 1 - stringIndex) * props.stringSpacing
          
          // Determine slide direction
          let pathData = `M${startX} ${yPos + 4}L${endX} ${yPos + 4}` // Horizontal slide
          
          slideEffects.push({
            path: pathData,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return slideEffects
})

const bends = computed(() => {
  const bendEffects = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.bendPresent && note?.bendObj) {
          const startX = props.xOffset + (beatIndex * 40) + 15
          const startY = (props.numStrings - 1 - stringIndex) * props.stringSpacing - 40
          
          let pathData = `M${startX} ${startY + 40}`
          let arrowPath = ''
          
          // Simple bend curve
          note.bendObj.forEach((bendPoint: any, index: number) => {
            const x = startX + (bendPoint.bendPosition || 0) / 3
            const y = startY + 40 - (bendPoint.bendValue || 0) / 7
            
            if (index === 0) {
              pathData += `M${x} ${y}`
            } else {
              pathData += `L${x} ${y}`
            }
            
            // Create arrow for last point
            if (index === note.bendObj.length - 1 && bendPoint.bendValue > 0) {
              arrowPath = `M${x} ${y}L${x - 2} ${y - 3}L${x + 2} ${y - 3}Z`
            }
          })
          
          bendEffects.push({
            path: pathData,
            arrowPath,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return bendEffects
})

const ties = computed(() => {
  const tieEffects = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.tied || note?.tieBegin) {
          const startX = props.xOffset + (beatIndex * 40) + 12
          const endX = startX + 40 // Tie to next beat
          const yPos = (props.numStrings - 1 - stringIndex) * props.stringSpacing
          
          // Create tie curve
          const pathData = `M${startX} ${yPos}C${startX} ${yPos + 5}, ${endX} ${yPos + 5}, ${endX} ${yPos}`
          
          tieEffects.push({
            path: pathData,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return tieEffects
})

const vibratos = computed(() => {
  const vibratoEffects = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.vibrato) {
          const startX = props.xOffset + (beatIndex * 40) + 7
          const yPos = (props.numStrings - 1 - stringIndex) * props.stringSpacing - 20
          const width = 30
          
          // Create vibrato wave
          let pathData = `M${startX} ${yPos + 3}`
          for (let i = 3; i < width; i += 3) {
            if (i % 6 === 0) {
              pathData += `L${startX + i} ${yPos + 5}`
            } else {
              pathData += `L${startX + i} ${yPos + 1}`
            }
          }
          
          vibratoEffects.push({
            path: pathData,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return vibratoEffects
})

const textEffects = computed(() => {
  const effects = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      const beatEffects = []
      
      beat.notes.forEach((note: any) => {
        if (note?.palmMute) beatEffects.push('P.M.')
        if (note?.tap) beatEffects.push('T')
        if (note?.pop) beatEffects.push('P')
        if (note?.slap) beatEffects.push('S')
        if (note?.stacatto) beatEffects.push('•')
        if (note?.fadeIn) beatEffects.push('≺')
        if (note?.accentuated) beatEffects.push('>')
      })
      
      // Remove duplicates and create effect objects
      const uniqueEffects = [...new Set(beatEffects)]
      uniqueEffects.forEach((effectText, index) => {
        effects.push({
          text: effectText,
          x: props.xOffset + (beatIndex * 40) + 10,
          y: -30 - (index * 15), // Stack multiple effects
          fontSize: getFontSizeForEffect(effectText),
          beatIndex
        })
      })
    }
  })
  
  return effects
})

// Helper computed properties
const hasSlides = computed(() => slides.value.length > 0)
const hasBends = computed(() => bends.value.length > 0)
const hasTies = computed(() => ties.value.length > 0)
const hasVibrato = computed(() => vibratos.value.length > 0)
const hasTextEffects = computed(() => textEffects.value.length > 0)

// Helper functions
function getFontSizeForEffect(effectText: string): string {
  switch (effectText) {
    case '•':
      return '20px'
    case 'P.M.':
      return '12px'
    default:
      return '16px'
  }
}
</script>

<style scoped>
.tab-effects {
  /* SVG styles handled by attributes */
}

.slide-path {
  stroke: #4f7cbb;
}

.bend-path {
  stroke: #111;
}

.tie-path {
  stroke: #111;
}

.vibrato-path {
  stroke: #111;
}

.effect-text {
  user-select: none;
}
</style> 