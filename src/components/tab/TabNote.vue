<template>
  <g class="tab-note" :transform="`translate(${xOffset}, 0)`">
    <!-- Notes on each string -->
    <text
      v-for="(note, stringIndex) in notesToRender"
      :key="`note-${beatIndex}-${stringIndex}-${note.fret}-${beatDataHash}`"
      :x="noteX"
      :y="note.string * stringSpacing + 6"
      font-family="Source Sans Pro"
      :font-size="getFontSize(note)"
      fill="#000"
      text-anchor="middle"
      class="note-text"
      :class="getNoteClasses(note)"
    >
      {{ getNoteDisplay(note) }}
    </text>
    
    <!-- Grace notes -->
    <text
      v-for="(note, stringIndex) in graceNotes"
      :key="`grace-${beatIndex}-${stringIndex}-${beatDataHash}`"
      :x="noteX - 12"
      :y="note.string * stringSpacing + 6"
      font-family="Source Sans Pro"
      font-size="11px"
      fill="#666"
      text-anchor="middle"
      class="grace-note"
    >
      {{ note.graceObj.fret }}
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getDisplayWidth } from '../../utils/tabLayout'

interface Props {
  beatData: any
  beatIndex: number
  xOffset: number
  stringSpacing: number
  numStrings: number
}

const props = defineProps<Props>()

const noteX = computed(() => {
  const duration = props.beatData?.duration || 'q'
  return getDisplayWidth(duration) / 2
})

const beatDataHash = computed(() => {
  if (!props.beatData || !props.beatData.notes) return 0
  
  // Create a simple hash based on the notes content
  let hash = 0
  props.beatData.notes.forEach((note: any, index: number) => {
    if (note) {
      hash += (note.fret || 0) * (index + 1) * 17
      hash += note.string * (index + 1) * 13
    }
  })
  return hash
})

const notesToRender = computed(() => {
  if (!props.beatData || !props.beatData.notes) {
    return []
  }
  
  // Filter out null notes and add string index information
  const notes = props.beatData.notes
    .map((note: any, stringIndex: number) => {
      if (note === null) return null
      return {
        ...note,
        string: stringIndex
      }
    })
    .filter((note: any) => note !== null && !note.tied)
  return notes
})

const graceNotes = computed(() =>
  notesToRender.value.filter((note: any) => note.gracePresent && note.graceObj)
)

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
</script>

<style scoped>
.tab-note {}

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