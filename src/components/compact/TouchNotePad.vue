<template>
  <section id="touchNotePad" class="note-pad" aria-label="Note entry">
    <div class="note-pad__header">
      <span class="note-pad__position" aria-live="polite">{{ positionLabel }}</span>
      <button type="button" class="note-pad__icon" aria-label="Undo" @click="undo()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
      </button>
      <button type="button" class="note-pad__icon" aria-label="Redo" @click="redo()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>
      </button>
      <button type="button" class="note-pad__done" @click="setCompactEditing(false)">Done</button>
    </div>

    <div class="note-pad__nav">
      <button type="button" aria-label="Previous beat" @click="move('left')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" aria-label="Higher string" @click="move('up')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-7 7 7" /></svg>
      </button>
      <button type="button" aria-label="Lower string" @click="move('down')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
      </button>
      <button type="button" aria-label="Next beat" @click="move('right')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
      <button type="button" class="note-pad__delete" aria-label="Delete note" @click="deleteNote">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9l-5 6 5 6h11z" /><path d="M12 9l5 6M17 9l-5 6" /></svg>
      </button>
    </div>

    <label v-if="isDrumTrack" class="note-pad__drums">
      <span>Drum</span>
      <select id="touchDrumSelect" :value="currentFret ?? ''" @change="placeFret(Number(($event.target as HTMLSelectElement).value))">
        <option value="" disabled>Choose a drum…</option>
        <option v-for="piece in drumPieces" :key="piece.note" :value="piece.note">{{ piece.name }}</option>
      </select>
    </label>
    <div v-else class="note-pad__frets" role="group" aria-label="Fret">
      <button
        v-for="fret in visibleFrets"
        :key="fret"
        type="button"
        class="note-pad__fret"
        :class="{ 'is-current': fret === currentFret }"
        :data-fret="fret"
        @click="placeFret(fret)"
      >{{ fret }}</button>
      <button type="button" class="note-pad__fret note-pad__page" :aria-label="highFrets ? 'Frets 0 to 13' : 'Frets 12 to 24'" @click="highFrets = !highFrets">
        {{ highFrets ? '0–13' : '12–24' }}
      </button>
    </div>

    <div class="note-pad__lengths" role="group" aria-label="Note length">
      <button
        v-for="length in LENGTHS"
        :key="length.code"
        type="button"
        :class="{ 'is-current': length.code === currentLength }"
        :aria-label="length.label"
        :data-length="length.code"
        @click="setLength(length.code)"
      ><span class="note-pad__glyph">{{ length.glyph }}</span></button>
      <button type="button" :class="{ 'is-current': isDotted }" aria-label="Dotted" @click="toggleDot">
        <span class="note-pad__glyph">♩.</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { selectionState } from '../../stores/selectionState'
import { computed, onMounted, ref } from 'vue'
import AppManager from '../../assets/js/appManager'
import { audioEngine } from '../../assets/js/audioEngine'
import { useUndoRedo } from '../../composables/useUndoRedo'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import { applyNoteLengthSelection } from '../../services/menuActionCommands'
import { noteLengthSpecialSelect } from '../../services/editor/durationModifierCommands'
import { setCompactEditing } from '../../stores/layoutModeState'
import { typedEventBus } from '../../utils/typedEventBus'
import type { NoteLengthCode } from '../../types/tab'

const LENGTHS: { code: NoteLengthCode, glyph: string, label: string }[] = [
  { code: 'w', glyph: '𝅝', label: 'Whole note' },
  { code: 'h', glyph: '𝅗𝅥', label: 'Half note' },
  { code: 'q', glyph: '♩', label: 'Quarter note' },
  { code: 'e', glyph: '♪', label: 'Eighth note' },
  { code: 's', glyph: '𝅘𝅥𝅯', label: 'Sixteenth note' },
  { code: 't', glyph: '𝅘𝅥𝅰', label: 'Thirty-second note' },
]
const LOW_FRETS = Array.from({ length: 14 }, (_, fret) => fret)
const HIGH_FRETS = Array.from({ length: 13 }, (_, index) => index + 12)

const { reactiveSongData } = useSongData()
const { currentSelection } = useTabSelection()
const { undo, redo } = useUndoRedo()
const highFrets = ref(false)

const visibleFrets = computed(() => (highFrets.value ? HIGH_FRETS : LOW_FRETS))
const isDrumTrack = computed(() => {
  const trackId = currentSelection.value?.trackId ?? reactiveSongData.currentTrackId ?? 0
  return reactiveSongData.playBackInstrument?.[trackId]?.instrument === 'drums'
})
const drumPieces = [...audioEngine.noteToDrum.entries()]
  .map(([note, info]) => ({ note, name: `${info[0]} (${note})` }))
  .sort((a, b) => a.note - b.note)

const currentBeat = computed(() => {
  const selection = currentSelection.value
  if (!selection) return null
  return reactiveSongData.measures?.[selection.trackId]?.[selection.blockId]?.[selection.voiceId]?.[selection.beatIndex] ?? null
})
const currentFret = computed(() => {
  const selection = currentSelection.value
  if (!selection) return null
  return currentBeat.value?.notes?.[selection.stringIndex]?.fret ?? null
})
const currentLength = computed(() => (currentBeat.value?.duration ?? '').charAt(0))
const isDotted = computed(() => currentBeat.value?.dotted === true)

const positionLabel = computed(() => {
  const selection = currentSelection.value
  if (!selection) return 'Tap a string in the tab'
  const numStrings = reactiveSongData.tracks?.[selection.trackId]?.numStrings ?? 6
  // String 1 is the highest string, as on the tab and in the tuning dialog.
  const stringNumber = numStrings - selection.stringIndex
  return `Bar ${selection.blockId + 1} · Beat ${selection.beatIndex + 1} · String ${stringNumber}`
})

function placeFret(fret: number): void {
  if (!AppManager.hasExplicitNoteSelection() || Number.isNaN(fret)) return
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  AppManager.placeNote(trackId, blockId, voiceId, beatId, string, fret)
}

function move(direction: 'left' | 'right' | 'up' | 'down'): void {
  AppManager.moveSelection(direction)
}

function deleteNote(): void {
  AppManager.deleteSelectedNotes()
}

function setLength(code: NoteLengthCode): void {
  applyNoteLengthSelection(code)
}

function toggleDot(): void {
  noteLengthSpecialSelect('dotted', 3, null)
}

onMounted(() => {
  // Start at the cursor (the first beat if nothing was picked yet) so the pad works at once.
  if (!AppManager.hasExplicitNoteSelection()) {
    typedEventBus.emit('navigation.setClickedPos', { ...selectionState.cursor })
  }
})
</script>

<style scoped>
.note-pad {
  flex: 0 0 auto;
  padding: 6px 10px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--compact-border);
  background: var(--compact-surface);
  color: var(--compact-text);
  user-select: none;
}

.note-pad button {
  min-width: 0;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: var(--compact-surface-raised);
  color: inherit;
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
}

.note-pad button:active {
  background: var(--compact-accent-soft);
}

.note-pad svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.note-pad__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.note-pad__position {
  flex: 1;
  overflow: hidden;
  color: var(--compact-text-muted);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-pad__icon {
  width: 44px;
  background: transparent !important;
}

.note-pad__done {
  padding: 0 16px;
  background: var(--compact-accent) !important;
  color: #fff !important;
  font-weight: 600 !important;
}

.note-pad__nav,
.note-pad__lengths {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-top: 6px;
}

.note-pad__lengths {
  grid-template-columns: repeat(7, 1fr);
}

.note-pad__delete {
  color: var(--compact-danger) !important;
}

.note-pad__frets {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin-top: 6px;
}

.note-pad__fret {
  font-size: 18px !important;
  font-variant-numeric: tabular-nums;
}

.note-pad__page {
  color: var(--compact-accent) !important;
  font-size: 13px !important;
}

.note-pad button.is-current {
  background: var(--compact-accent);
  color: #fff;
}

.note-pad__glyph {
  font-family: 'Bravura', 'Noto Music', 'Segoe UI Symbol', serif;
  font-size: 22px;
  line-height: 1;
}

.note-pad__drums {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.note-pad__drums select {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--compact-border);
  border-radius: 10px;
  padding: 0 8px;
  background: var(--compact-surface-raised);
  color: inherit;
  font: inherit;
}
</style>
