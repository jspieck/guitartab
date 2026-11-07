<template>
  <g class="tab-note" :transform="`translate(${xOffset}, 0)`">
    <!-- Slash notation: the beat's rhythm only, a slash across the middle of the strings -->
    <path
      v-if="beatData?.slash"
      :d="slashPath"
      class="slash-head"
      :class="{ 'slash-head--open': slashIsOpen, 'voice2-note': voiceId === 1 }"
    />
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
import { drumSymbol } from '../../utils/drumMap'
import { beatNoteOffset } from '../../utils/measureBeatLayout'
import Settings from '../../stores/settingsState'
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
  /** Voice 2 is drawn in its own colour. */
  voiceId?: number
  /** A drum track: hits are x (cymbals) and o (drums), not numbers. */
  drums?: boolean
}

const props = defineProps<Props>()

const noteX = computed(() => beatNoteOffset(props.beatData, props.beatWidth))

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

/** Middle of the strings, where slashes sit (as on the staff's middle line). */
const middleY = computed(() => ((props.numStrings - 1) * props.stringSpacing) / 2)

const slashIsOpen = computed(() => /^[wh]/.test(props.beatData?.duration ?? ''))

/** A slanted bar, like the slash note head (open for half and whole notes). */
const slashPath = computed(() => {
  const x = noteX.value
  const y = middleY.value
  return `M${x - 7} ${y + 6}L${x + 3} ${y - 6}L${x + 7} ${y - 6}L${x - 3} ${y + 6}Z`
})

const notesToRender = computed<RenderableTabNote[]>(() => {
  if (!props.beatData?.notes || props.beatData.slash) {
    return []
  }

  return props.beatData.notes.flatMap((note: TabNoteData | null, stringIndex: number) => {
    if (!note || (note.tied && !Settings.tiedNotesInParentheses)) {
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
  
  if (props.drums) return drumSymbol(note.fret, note)
  if (note.dead) return 'x'
  if (note.ghost || note.tied) return `(${note.fret})`
  // Guitar Pro draws natural harmonics in angle brackets
  if (note.artificialStyle === 'N.H.') return `<${note.fret}>`

  return note.fret.toString()
}

function getFontSize(note: RenderableTabNote | null | undefined): string {
  if (!note) return '16px'
  
  const display = getNoteDisplay(note)
  if (display.length > 3) return '12px'
  if (display.length > 1) return '14px'
  
  return '16px'
}

function getNoteClasses(note: RenderableTabNote): string {
  const classes: string[] = []
  if (props.voiceId === 1) classes.push('voice2-note')
  if (props.drums) classes.push('drum-hit')
  if (note.dead) classes.push('dead-note')
  if (note.ghost) classes.push('ghost-note')
  if (note.tied) classes.push('tied-note')
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

.voice2-note {
  fill: var(--tab-voice2);
}

/* Dead and ghost notes look like Guitar Pro's: an x and a fret in parentheses, in the note
   colour (the shape tells them apart); palm muting is the P.M. line above, not a bold digit. */
.tied-note {
  fill: var(--tab-secondary);
}

.slash-head {
  fill: var(--tab-primary);
  stroke: var(--tab-primary);
  stroke-width: 1;
}

.slash-head.voice2-note {
  fill: var(--tab-voice2);
  stroke: var(--tab-voice2);
}

.slash-head.slash-head--open {
  fill: var(--tab-bg);
}

</style> 