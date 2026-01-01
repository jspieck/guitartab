<template>
  <g class="tab-effects">
    <!-- Slides -->
    <g v-if="hasSlides" class="slides">
      <path
        v-for="(slide, index) in slides"
        :key="`slide-${index}`"
        :d="slide.path"
        stroke="#4f7cbb"
        stroke-width="1.5"
        fill="none"
        class="slide-path"
      />
    </g>
    
    <!-- Bends -->
    <g v-if="hasBends" class="bends">
      <g v-for="(bend, index) in bends" :key="`bend-group-${index}`">
        <path
          :d="bend.path"
          stroke="#111"
          stroke-width="1"
          fill="none"
          class="bend-path"
        />
        <!-- Bend value text -->
        <text
          v-if="bend.valueText"
          :x="bend.textX"
          :y="bend.textY"
          font-family="Source Sans Pro"
          font-size="10px"
          fill="#111"
          text-anchor="middle"
        >
          {{ bend.valueText }}
        </text>
        <!-- Bend arrow -->
        <path
          v-if="bend.arrowPath"
          :d="bend.arrowPath"
          stroke="#111"
          stroke-width="1"
          fill="#111"
          class="bend-arrow"
        />
      </g>
    </g>
    
    <!-- Ties/Bows (for hammer-on, pull-off, tied notes) -->
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

    <!-- Pull-offs / Hammer-ons indicators -->
    <g v-if="hasPullDowns" class="pull-downs">
      <path
        v-for="(pd, index) in pullDowns"
        :key="`pd-${index}`"
        :d="pd.path"
        stroke="#111"
        stroke-width="1"
        fill="none"
        class="pulldown-path"
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

    <!-- Trill -->
    <g v-if="hasTrill" class="trill">
      <g v-for="(trill, index) in trills" :key="`trill-group-${index}`">
        <text
          :x="trill.textX"
          :y="trill.textY"
          font-family="Source Sans Pro"
          font-size="11px"
          font-style="italic"
          fill="#111"
        >
          tr
        </text>
        <path
          :d="trill.path"
          stroke="#111"
          stroke-width="1"
          fill="none"
          class="trill-wave"
        />
      </g>
    </g>

    <!-- Tremolo Bar -->
    <g v-if="hasTremoloBar" class="tremolo-bar">
      <path
        v-for="(tb, index) in tremoloBars"
        :key="`tb-${index}`"
        :d="tb.path"
        stroke="#111"
        stroke-width="1"
        fill="none"
        class="tremolo-bar-path"
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

    <!-- Let Ring indicator -->
    <g v-if="hasLetRing" class="let-ring">
      <g v-for="(lr, index) in letRings" :key="`let-ring-${index}`">
        <text
          :x="lr.x"
          :y="lr.y"
          font-family="Source Sans Pro"
          font-size="10px"
          font-style="italic"
          fill="#555"
        >
          let ring
        </text>
        <line
          :x1="lr.x + 35"
          :y1="lr.y - 3"
          :x2="lr.lineEndX"
          :y2="lr.y - 3"
          stroke="#555"
          stroke-width="1"
          stroke-dasharray="3,2"
        />
      </g>
    </g>

    <!-- Natural Harmonics -->
    <g v-if="hasHarmonics" class="harmonics">
      <g v-for="(harm, index) in harmonics" :key="`harmonic-${index}`">
        <text
          :x="harm.x"
          :y="harm.y"
          font-family="Source Sans Pro"
          font-size="10px"
          fill="#111"
        >
          {{ harm.text }}
        </text>
      </g>
    </g>

    <!-- Tremolo Picking -->
    <g v-if="hasTremoloPicking" class="tremolo-picking">
      <g v-for="(tp, index) in tremoloPickings" :key="`tp-${index}`" :transform="`translate(${tp.x}, ${tp.y})`">
        <path d="M2 4L12 2" stroke="#111" stroke-width="2" fill="none" />
        <path v-if="tp.lines >= 2" d="M2 8L12 6" stroke="#111" stroke-width="2" fill="none" />
        <path v-if="tp.lines >= 3" d="M2 12L12 10" stroke="#111" stroke-width="2" fill="none" />
      </g>
    </g>

    <!-- Grace Notes (small note before main note) -->
    <g v-if="hasGraceNotes" class="grace-notes">
      <g v-for="(gn, index) in graceNotes" :key="`grace-${index}`">
        <text
          :x="gn.x"
          :y="gn.y"
          font-family="Source Sans Pro"
          font-size="10px"
          fill="#666"
          text-anchor="middle"
        >
          {{ gn.fret }}
        </text>
        <!-- Grace note slur/arc -->
        <path
          :d="gn.slurPath"
          stroke="#666"
          stroke-width="1"
          fill="none"
        />
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getDisplayWidth, TAB_CONSTANTS } from '../../utils/tabLayout'

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

// Helper to get beat X position based on actual durations
function getBeatX(beatIndex: number): number {
  let x = props.xOffset
  for (let i = 0; i < beatIndex; i++) {
    const beat = props.measureData[i]
    x += getDisplayWidth(beat?.duration)
  }
  return x
}

// Helper to get string Y position
function getStringY(stringIndex: number): number {
  return (props.numStrings - 1 - stringIndex) * props.stringSpacing
}

// ============ SLIDES ============
const slides = computed(() => {
  const slideEffects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.slide) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const startX = beatX + beatWidth / 2 + 8
          const yPos = getStringY(stringIndex)
          
          // Determine next note's fret to know slide direction
          const nextBeat = props.measureData[beatIndex + 1]
          const nextNote = nextBeat?.notes?.[stringIndex]
          const slideUp = nextNote && nextNote.fret > note.fret
          
          const slideLength = Math.min(beatWidth * 0.6, 25)
          const yOffset = slideUp ? -3 : 3
          
          const pathData = `M${startX} ${yPos + 4 + yOffset}L${startX + slideLength} ${yPos + 4 - yOffset}`
          
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

// ============ BENDS ============
const bends = computed(() => {
  const bendEffects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.bendPresent && note?.bendObj && note.bendObj.length > 0) {
          const beatX = getBeatX(beatIndex)
          const startX = beatX + getDisplayWidth(beat.duration) / 2 + 5
          const startY = getStringY(stringIndex) - 8
          
          let pathData = `M${startX} ${startY + 10}`
          let arrowPath = ''
          let maxBendValue = 0
          let lastX = startX
          let lastY = startY + 10
          
          // Calculate bend curve
          note.bendObj.forEach((bendPoint: any, index: number) => {
            const posOffset = (bendPoint.bendPosition || 0) / 4
            const bendHeight = (bendPoint.bendValue || 0) / 5
            const x = startX + posOffset
            const y = startY + 10 - bendHeight
            
            if (bendPoint.bendValue > maxBendValue) {
              maxBendValue = bendPoint.bendValue
            }
            
            if (index === 0 && bendPoint.bendPosition === 0) {
              pathData = `M${x} ${y + bendHeight}`
            }
            
            pathData += `L${x} ${y}`
            lastX = x
            lastY = y
          })
          
          // Arrow at the end of bend
          if (maxBendValue > 0) {
            arrowPath = `M${lastX - 3} ${lastY + 4}L${lastX} ${lastY}L${lastX + 3} ${lastY + 4}`
          }
          
          // Bend value text (full, 1/2, 1/4, etc.)
          let valueText = ''
          if (maxBendValue >= 100) valueText = 'full'
          else if (maxBendValue >= 75) valueText = '3/4'
          else if (maxBendValue >= 50) valueText = '1/2'
          else if (maxBendValue >= 25) valueText = '1/4'
          
          bendEffects.push({
            path: pathData,
            arrowPath,
            valueText,
            textX: lastX,
            textY: lastY - 5,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return bendEffects
})

// ============ TIES (for tied notes) ============
const ties = computed(() => {
  const tieEffects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.tied && beatIndex > 0) {
          // Draw tie from previous beat to this beat
          const prevBeatX = getBeatX(beatIndex - 1)
          const prevBeatWidth = getDisplayWidth(props.measureData[beatIndex - 1]?.duration)
          const thisBeatX = getBeatX(beatIndex)
          const thisBeatWidth = getDisplayWidth(beat.duration)
          
          const startX = prevBeatX + prevBeatWidth / 2 + 8
          const endX = thisBeatX + thisBeatWidth / 2 - 5
          const yPos = getStringY(stringIndex) + 8
          const curveHeight = 5
          
          const pathData = `M${startX} ${yPos}C${startX} ${yPos + curveHeight}, ${endX} ${yPos + curveHeight}, ${endX} ${yPos}`
          
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

// ============ PULL DOWNS (hammer-on/pull-off) ============
const pullDowns = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.pullDown && beatIndex < props.measureData.length - 1) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const nextBeatX = getBeatX(beatIndex + 1)
          const nextBeatWidth = getDisplayWidth(props.measureData[beatIndex + 1]?.duration)
          
          const startX = beatX + beatWidth / 2 + 8
          const endX = nextBeatX + nextBeatWidth / 2 - 5
          const yPos = getStringY(stringIndex) - 12
          const curveHeight = 6
          
          // Arc above the notes
          const pathData = `M${startX} ${yPos}C${startX} ${yPos - curveHeight}, ${endX} ${yPos - curveHeight}, ${endX} ${yPos}`
          
          effects.push({
            path: pathData,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return effects
})

// ============ VIBRATO ============
const vibratos = computed(() => {
  const vibratoEffects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.vibrato) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const startX = beatX + beatWidth / 2 + 5
          const yPos = getStringY(stringIndex) - 18
          const width = Math.min(beatWidth * 0.7, 30)
          
          // Create vibrato wave pattern
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

// ============ TRILL ============
const trills = computed(() => {
  const trillEffects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes?.some((n: any) => n?.trillPresent)) {
      const beatX = getBeatX(beatIndex)
      const beatWidth = getDisplayWidth(beat.duration)
      const startX = beatX + beatWidth / 2
      const yPos = -25
      const width = Math.min(beatWidth * 0.6, 25)
      
      // Create trill wave
      let pathData = `M${startX + 12} ${yPos + 3}`
      for (let i = 3; i < width; i += 3) {
        if (i % 6 === 0) {
          pathData += `L${startX + 12 + i} ${yPos + 5}`
        } else {
          pathData += `L${startX + 12 + i} ${yPos + 1}`
        }
      }
      
      trillEffects.push({
        textX: startX,
        textY: yPos + 5,
        path: pathData,
        beatIndex
      })
    }
  })
  
  return trillEffects
})

// ============ TREMOLO BAR ============
const tremoloBars = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.tremoloBarPresent && beat?.tremoloBar) {
      const beatX = getBeatX(beatIndex)
      const beatWidth = getDisplayWidth(beat.duration)
      const startX = beatX + beatWidth / 2
      const startY = props.numStrings * props.stringSpacing + 10
      
      let pathData = `M${startX} ${startY}`
      
      beat.tremoloBar.forEach((point: any, index: number) => {
        const x = startX + (point.position || 0) / 4
        const y = startY + (point.value || 0) / 10
        pathData += `L${x} ${y}`
      })
      
      effects.push({
        path: pathData,
        beatIndex
      })
    }
  })
  
  return effects
})

// ============ TEXT EFFECTS ============
const textEffects = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      const beatEffects: string[] = []
      const beatX = getBeatX(beatIndex)
      const beatWidth = getDisplayWidth(beat.duration)
      
      beat.notes.forEach((note: any) => {
        if (note?.palmMute) beatEffects.push('P.M.')
        if (note?.tap) beatEffects.push('T')
        if (note?.pop) beatEffects.push('P')
        if (note?.slap) beatEffects.push('S')
        if (note?.stacatto) beatEffects.push('•')
        if (note?.fadeIn) beatEffects.push('≺')
        if (note?.accentuated) beatEffects.push('>')
        if (note?.heavyAccentuated) beatEffects.push('^')
      })
      
      // Remove duplicates and create effect objects
      const uniqueEffects = [...new Set(beatEffects)]
      uniqueEffects.forEach((effectText, index) => {
        effects.push({
          text: effectText,
          x: beatX + beatWidth / 2,
          y: -25 - (index * 12),
          fontSize: getFontSizeForEffect(effectText),
          beatIndex
        })
      })
    }
  })
  
  return effects
})

// ============ LET RING ============
const letRings = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes?.some((n: any) => n?.letRing)) {
      const beatX = getBeatX(beatIndex)
      const beatWidth = getDisplayWidth(beat.duration)
      
      // Find how long the let ring continues
      let endBeatIndex = beatIndex
      for (let i = beatIndex + 1; i < props.measureData.length; i++) {
        if (props.measureData[i]?.notes?.some((n: any) => n?.letRing)) {
          endBeatIndex = i
        } else {
          break
        }
      }
      
      const endX = getBeatX(endBeatIndex) + getDisplayWidth(props.measureData[endBeatIndex]?.duration)
      
      // Only add if this is the start of a let ring section
      if (beatIndex === 0 || !props.measureData[beatIndex - 1]?.notes?.some((n: any) => n?.letRing)) {
        effects.push({
          x: beatX + beatWidth / 2,
          y: props.numStrings * props.stringSpacing + 15,
          lineEndX: endX
        })
      }
    }
  })
  
  return effects
})

// ============ HARMONICS ============
const harmonics = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.artificialPresent || note?.naturalHarmonic) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const yPos = getStringY(stringIndex) - 15
          
          const text = note.naturalHarmonic ? 'N.H.' : 'A.H.'
          
          effects.push({
            x: beatX + beatWidth / 2,
            y: yPos,
            text,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return effects
})

// ============ TREMOLO PICKING ============
const tremoloPickings = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.tremoloPicking) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const yPos = props.numStrings * props.stringSpacing + 3
          
          // Determine number of lines based on tremolo picking length
          let lines = 1 // Default for eighth notes (e)
          if (note.tremoloPickingLength === 's') lines = 2 // Sixteenth
          if (note.tremoloPickingLength === 't') lines = 3 // Thirty-second
          
          effects.push({
            x: beatX + beatWidth / 2 - 5,
            y: yPos,
            lines,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return effects
})

// ============ GRACE NOTES ============
const graceNotes = computed(() => {
  const effects: any[] = []
  
  props.measureData.forEach((beat, beatIndex) => {
    if (beat?.notes) {
      beat.notes.forEach((note: any, stringIndex: number) => {
        if (note?.gracePresent && note?.graceObj) {
          const beatX = getBeatX(beatIndex)
          const beatWidth = getDisplayWidth(beat.duration)
          const yPos = getStringY(stringIndex)
          
          const graceX = beatX + 3
          const mainNoteX = beatX + beatWidth / 2
          
          // Create slur arc from grace note to main note
          const slurPath = `M${graceX + 5} ${yPos - 5}C${graceX + 10} ${yPos - 12}, ${mainNoteX - 5} ${yPos - 12}, ${mainNoteX} ${yPos - 5}`
          
          effects.push({
            x: graceX,
            y: yPos + 4,
            fret: note.graceObj.fret,
            slurPath,
            beatIndex,
            stringIndex
          })
        }
      })
    }
  })
  
  return effects
})

// Helper computed properties
const hasSlides = computed(() => slides.value.length > 0)
const hasBends = computed(() => bends.value.length > 0)
const hasTies = computed(() => ties.value.length > 0)
const hasPullDowns = computed(() => pullDowns.value.length > 0)
const hasVibrato = computed(() => vibratos.value.length > 0)
const hasTrill = computed(() => trills.value.length > 0)
const hasTremoloBar = computed(() => tremoloBars.value.length > 0)
const hasTextEffects = computed(() => textEffects.value.length > 0)
const hasLetRing = computed(() => letRings.value.length > 0)
const hasHarmonics = computed(() => harmonics.value.length > 0)
const hasTremoloPicking = computed(() => tremoloPickings.value.length > 0)
const hasGraceNotes = computed(() => graceNotes.value.length > 0)

// Helper functions
function getFontSizeForEffect(effectText: string): string {
  switch (effectText) {
    case '•':
      return '20px'
    case 'P.M.':
      return '11px'
    case '>':
    case '^':
      return '18px'
    default:
      return '14px'
  }
}
</script>

<style scoped>
.tab-effects {
  pointer-events: none;
}

.slide-path {
  stroke-linecap: round;
}

.bend-path {
  stroke-linecap: round;
}

.tie-path {
  stroke-linecap: round;
}

.pulldown-path {
  stroke-linecap: round;
}

.vibrato-path {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trill-wave {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.effect-text {
  user-select: none;
}
</style> 