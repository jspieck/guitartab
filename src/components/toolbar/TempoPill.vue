<template>
  <input
    v-if="editing"
    ref="inputRef"
    v-model.number="draft"
    class="tb-pill tb-tempo tb-tempo--input"
    type="number"
    :min="TEMPO_MIN"
    :max="TEMPO_MAX"
    aria-label="Song tempo in beats per minute"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
    @blur="commit"
  />
  <!-- Drag up or down to change the tempo; a click types it. The ♩ is CSS, so the text is the number. -->
  <div
    v-else
    id="tempoMeter"
    class="tb-pill tb-tempo"
    role="button"
    tabindex="0"
    :aria-label="`${currentTempo} BPM song tempo (drag up or down, or click to type)`"
    data-tip="Song tempo: drag up or down, or click to type"
    @pointerdown="onPointerDown"
    @keydown.enter.prevent="startEditing"
    @keydown.space.prevent="startEditing"
  >{{ currentTempo }}</div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import Song from '../../stores/song'
import { useTempoState } from '../../stores/tempoState'
import { clampTempo, TEMPO_MAX, TEMPO_MIN } from '../../utils/tempo'
import { setSongTempo } from '../../services/editor/songSettingsCommands'

/** Pixels the pointer moves before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3

const { currentTempo } = useTempoState()
const editing = ref(false)
const draft = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

let startY = 0
let startBpm = 0
let dragging = false
let pointerId: number | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  startY = event.clientY
  startBpm = Song.bpm
  dragging = false
  pointerId = event.pointerId
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
  document.body.classList.add('disableMouseEffects')
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return
  const delta = startY - event.clientY
  if (!dragging && Math.abs(delta) < DRAG_THRESHOLD) return
  dragging = true
  // One beat per minute per pixel, upwards is faster.
  Song.setTempo(clampTempo(startBpm + Math.round(delta)))
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return
  stopListening()
  if (dragging) {
    // One undo step per drag; this also marks the song as changed for autosave.
    setSongTempo(Song.bpm, startBpm)
  } else if (event.type === 'pointerup') {
    void startEditing()
  }
}

function stopListening(): void {
  pointerId = null
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerUp)
  document.body.classList.remove('disableMouseEffects')
}

async function startEditing(): Promise<void> {
  draft.value = Song.bpm
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function commit(): void {
  if (!editing.value) return
  editing.value = false
  const bpm = Number(draft.value)
  if (Number.isFinite(bpm) && bpm > 0 && clampTempo(Math.round(bpm)) !== Song.bpm) {
    setSongTempo(Math.round(bpm))
  }
}

function cancel(): void {
  editing.value = false
}

onBeforeUnmount(stopListening)
</script>
