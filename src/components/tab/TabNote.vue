<template>
  <g class="tab-note" :transform="`translate(${xOffset}, 0)`">
    <!-- Notes on each string -->
    <text
      v-for="(note, stringIndex) in notesToRender"
      :key="`note-${stringIndex}`"
      :x="10"
      :y="(numStrings - 1 - note.string) * stringSpacing + 6"
      font-family="Source Sans Pro"
      :font-size="getFontSize(note)"
      fill="#000"
      text-anchor="middle"
      class="note-text"
      :class="getNoteClasses(note)"
      @click="(event) => handleNoteClick(event, note)"
      @mouseover="(event) => handleNoteHover(event, note, true)"
      @mouseout="(event) => handleNoteHover(event, note, false)"
      style="cursor: pointer"
    >
      {{ getNoteDisplay(note) }}
    </text>
    
    <!-- Grace notes -->
    <text
      v-for="(note, stringIndex) in graceNotes"
      :key="`grace-${stringIndex}`"
      :x="2"
      :y="(numStrings - 1 - note.string) * stringSpacing + 6"
      font-family="Source Sans Pro"
      font-size="11px"
      fill="#666"
      text-anchor="middle"
      class="grace-note"
      @click="(event) => handleGraceClick(event, note)"
      style="cursor: pointer"
    >
      {{ note.graceObj.fret }}
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

// Props
interface Props {
  beatData: any // Beat/Measure data from Song
  beatIndex: number
  xOffset: number
  stringSpacing: number
  numStrings: number
}

const props = defineProps<Props>()

// Watch for changes in beat data
watch(() => props.beatData, (newBeatData, oldBeatData) => {
  console.log('Beat data changed:', {
    beatIndex: props.beatIndex,
    old: oldBeatData,
    new: newBeatData
  })
}, { deep: true })

// Computed properties
const notesToRender = computed(() => {
  console.log('Computing notes to render for beat:', props.beatIndex, props.beatData)
  
  if (!props.beatData || !props.beatData.notes) {
    console.log('No beat data or notes array')
    return []
  }
  
  // Filter out null notes and add string index information
  const notes = props.beatData.notes
    .map((note: any, stringIndex: number) => {
      if (note === null) return null
      return {
        ...note,
        string: stringIndex // Add string index for positioning
      }
    })
    .filter((note: any) => note !== null && !note.tied) // Don't render tied notes
  
  console.log('Notes to render:', notes)
  return notes
})

const graceNotes = computed(() => {
  return notesToRender.value.filter((note: any) => note.gracePresent && note.graceObj)
})

// Methods
function getNoteDisplay(note: any): string {
  if (!note) return ''
  
  if (note.dead) return 'x'
  if (note.ghost) return `(${note.fret})`
  
  return note.fret.toString()
}

function getFontSize(note: any): string {
  if (!note) return '16px'
  
  const display = getNoteDisplay(note)
  if (display.length > 3) return '12px'
  if (display.length > 1 || note.ghost) return '14px'
  
  return '16px'
}

function getNoteClasses(note: any): string {
  const classes = []
  
  if (note.dead) classes.push('dead-note')
  if (note.ghost) classes.push('ghost-note')
  if (note.palmMute) classes.push('palm-mute')
  if (note.slide) classes.push('slide')
  if (note.vibrato) classes.push('vibrato')
  if (note.bendPresent) classes.push('bend')
  
  return classes.join(' ')
}

// Event handlers
function handleNoteClick(event: MouseEvent, note: any) {
  event.stopPropagation()
  console.log('Note clicked:', {
    fret: note.fret,
    string: note.string,
    position: { x: event.clientX, y: event.clientY }
  })
  // TODO: Emit event to parent for note selection/editing
}

function handleNoteHover(event: MouseEvent, note: any, isEntering: boolean) {
  console.log('Note hover:', {
    fret: note.fret,
    string: note.string,
    entering: isEntering
  })
  // TODO: Add hover effects
}

function handleGraceClick(event: MouseEvent, note: any) {
  event.stopPropagation()
  console.log('Grace note clicked:', {
    fret: note.graceObj.fret,
    string: note.string
  })
  // TODO: Emit event for grace note editing
}
</script>

<style scoped>
.tab-note {
  /* SVG styles are handled by attributes */
}

.note-text {
  user-select: none;
}

.dead-note {
  fill: #666;
}

.ghost-note {
  fill: #999;
  font-style: italic;
}

.palm-mute {
  font-weight: bold;
}

.grace-note {
  font-size: 11px;
  opacity: 0.8;
}
</style> 