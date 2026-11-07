<template>
  <Teleport to="body">
    <input
      id="lyricsEntryField"
      ref="field"
      v-model="value"
      class="lyrics-entry-field"
      :class="{ 'lyrics-entry-field--hidden': position == null }"
      :style="position ? { left: `${position.x}px`, top: `${position.y}px`, fontSize: `${position.fontSize}px` } : undefined"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :aria-label="`Lyrics, verse ${lyricsEntryState.verse + 1}. Space or Tab: next note, hyphen: next syllable, Enter: done`"
      @input="handleInput"
      @keydown="handleKeyDown"
      @blur="handleBlur"
    />
    <span
      v-if="position"
      class="lyrics-entry-verse"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      aria-hidden="true"
    >Verse {{ lyricsEntryState.verse + 1 }}</span>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { lyricsEntryState } from '../../stores/lyricsEntryState'
import { selectionState } from '../../stores/selectionState'
import {
  cursorLyric,
  enterLyrics,
  enterLyricsAndAdvance,
  moveLyricCursor,
  setLyricVerse,
  stopLyricsEntry,
} from '../../services/editor/lyricsEntry'

/**
 * The lyric field: an input over the lyrics line of the cursor's beat (keys in
 * `services/editor/lyricsEntry.ts`). It follows the cursor through scrolling and re-layout
 * by reading the cursor's position every frame while it is open.
 */

const field = ref<HTMLInputElement | null>(null)
const value = ref('')
const position = ref<{ x: number; y: number; fontSize: number } | null>(null)
let frame = 0
// Set while the field writes itself, so the blur from re-focusing doesn't close it.
let committing = false

function load(): void {
  value.value = cursorLyric()
  void nextTick(() => {
    field.value?.focus({ preventScroll: true })
    field.value?.select()
  })
}

function track(): void {
  const indicator = document.querySelector<SVGGElement>('.selection-indicator')
  const rect = indicator?.querySelector('rect')?.getBoundingClientRect()
  if (indicator == null || rect == null || rect.height === 0) {
    position.value = null
  } else {
    // The cursor box is 16 units high; it gives the zoom of the sheet.
    const scale = rect.height / 16
    const dy = Number(indicator.dataset.lyricsDy ?? 0)
    position.value = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2 + dy * scale,
      fontSize: Math.max(12, 12 * scale),
    }
  }
  frame = requestAnimationFrame(track)
}

function stored(): boolean {
  return value.value === cursorLyric()
}

function commit(): void {
  if (!stored()) enterLyrics(value.value)
}

/** Stores the field and moves on; at the end of the track it stays on the last note. */
function commitAndAdvance(text: string): void {
  committing = true
  try {
    if (!enterLyricsAndAdvance(text)) value.value = cursorLyric()
  } finally {
    committing = false
  }
}

function handleInput(): void {
  const text = value.value
  // A space or a syllable ending in "-" finishes the syllable (also from phone keyboards,
  // which send no usable keydown); a pasted line flows onto the following notes.
  if (/\s/.test(text) || (text.length > 1 && text.endsWith('-') && !text.endsWith('--'))) {
    commitAndAdvance(text)
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  let handled = true
  if (event.key === 'Tab') {
    if (event.shiftKey) {
      commit()
      moveLyricCursor(-1)
    } else {
      commitAndAdvance(value.value)
    }
  } else if (event.key === 'Enter') {
    commit()
    stopLyricsEntry()
  } else if (event.key === 'Escape') {
    stopLyricsEntry()
  } else if (event.key === 'Backspace' && value.value === '') {
    commit()
    moveLyricCursor(-1)
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    commit()
    setLyricVerse(lyricsEntryState.verse + (event.key === 'ArrowDown' ? 1 : -1))
  } else {
    handled = false
  }
  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handleBlur(): void {
  if (committing || !lyricsEntryState.active) return
  commit()
  stopLyricsEntry()
}

watch(
  () => [
    selectionState.cursor.trackId,
    selectionState.cursor.voiceId,
    selectionState.cursor.blockId,
    selectionState.cursor.beatId,
    lyricsEntryState.verse,
  ],
  load,
)

onMounted(() => {
  load()
  frame = requestAnimationFrame(track)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<style>
.lyrics-entry-field {
  position: fixed;
  z-index: 40;
  transform: translateX(-50%);
  width: 6em;
  padding: 1px 4px;
  font-family: 'Source Sans Pro', sans-serif;
  text-align: center;
  color: var(--color-text);
  background: var(--color-field);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  outline: none;
}

/* Not visibility: hidden, which can't take focus (the field is hidden until first placed). */
.lyrics-entry-field--hidden {
  opacity: 0;
  pointer-events: none;
}

.lyrics-entry-verse {
  position: fixed;
  z-index: 40;
  transform: translate(-50%, -100%);
  padding: 0 4px;
  font-size: 10px;
  color: var(--color-text-muted);
  pointer-events: none;
}
</style>
