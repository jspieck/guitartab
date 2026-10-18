<template>
  <g class="tab-note" :transform="`translate(${xOffset}, 0)`">
    <!-- Notes on each string -->
    <text
      v-for="(note, stringIndex) in notesToRender"
      :key="`note-${beatIndex}-${stringIndex}-${note.fret}-${beatDataHash}`"
      :x="noteX"
      :y="stringLine(note.string, numStrings) * stringSpacing + 6"
      font-family="Source Sans Pro"
      :font-size="getFontSize(note)"
      text-anchor="middle"
      class="note-text"
      :class="getNoteClasses(note)"
    >
      {{ getNoteDisplay(note) }}
    </text>
    
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { stringLine } from '../../utils/tabStrings'
import type { TabBeat, TabNoteData } from '../../types/tab'

type RenderableTabNote = TabNoteData & {
  string: number
}

interface Props {
  beatData?: TabBeat
  beatIndex: number
  xOffset: number
  beatWidth: number
  stringSpacing: number
  numStrings: number
}

const props = defineProps<Props>()

const noteX = computed(() => props.beatWidth / 2)

const beatDataHash = computed(() => {
  if (!props.beatData?.notes) return 0
  
  // Create a simple hash based on the notes content
  let hash = 0
  props.beatData.notes.forEach((note: TabNoteData | null, index: number) => {
    if (note) {
      hash += (note.fret || 0) * (index + 1) * 17
      hash += index * (index + 1) * 13
    }
  })
  return hash
})

const notesToRender = computed<RenderableTabNote[]>(() => {
  if (!props.beatData?.notes) {
    return []
  }

  return props.beatData.notes.flatMap((note: TabNoteData | null, stringIndex: number) => {
    if (!note || note.tied) {
      return []
    }

    return [{
      ...note,
      string: stringIndex,
    }]
  })
})

// Grace notes are drawn by TabEffects (fret + slur), not here.

function getNoteDisplay(note: RenderableTabNote | null | undefined): string {
  if (!note) return ''
  
  if (note.dead) return 'x'
  if (note.ghost) return `(${note.fret})`
  
  return note.fret.toString()
}

function getFontSize(note: RenderableTabNote | null | undefined): string {
  if (!note) return '16px'
  
  const display = getNoteDisplay(note)
  if (display.length > 3) return '12px'
  if (display.length > 1 || note.ghost) return '14px'
  
  return '16px'
}

function getNoteClasses(note: RenderableTabNote): string {
  const classes: string[] = []
  if (note.dead) classes.push('dead-note')
  if (note.ghost) classes.push('ghost-note')
  if (note.palmMute) classes.push('palm-mute')
  if (note.slide) classes.push('slide')
  if (note.vibrato) classes.push('vibrato')
  if (note.bendObj != null) classes.push('bend')
  return classes.join(' ')
}
</script>

<style scoped>
.tab-note {}

.note-text {
  user-select: none;
  fill: var(--tab-primary);
}

.dead-note {
  fill: var(--tab-secondary);
}

.ghost-note {
  fill: var(--tab-ghost);
  font-style: italic;
}

.palm-mute {
  font-weight: bold;
}

</style> 