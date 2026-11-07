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

    <!-- Drum tracks: a pad per line of the drum map (top line first); a tap turns the hit on or off -->
    <div v-if="isDrumTrack" id="touchDrumPads" class="note-pad__drums" role="group" aria-label="Drums">
      <button
        v-for="midi in drumPads"
        :key="midi"
        type="button"
        class="note-pad__drum"
        :class="{ 'is-current': beatDrums.has(midi) }"
        :aria-pressed="beatDrums.has(midi)"
        :data-drum="midi"
        @click="toggleDrumAtCursor(midi)"
      >
        <span class="note-pad__drum-label">{{ drumLabel(midi) }}</span>
        <span class="note-pad__drum-name">{{ drumName(midi) }}</span>
      </button>
    </div>
    <div v-if="!isDrumTrack" class="note-pad__mode" role="group" aria-label="Fret input">
      <button type="button" :class="{ 'is-current': !useFretboard }" :aria-pressed="!useFretboard" @click="Settings.touchFretboard = false">Frets</button>
      <button type="button" :class="{ 'is-current': useFretboard }" :aria-pressed="useFretboard" @click="Settings.touchFretboard = true">Fretboard</button>
    </div>
    <Fretboard
      v-if="!isDrumTrack && useFretboard"
      id="touchFretboard"
      class="note-pad__fretboard"
      input
      :num-strings="numStrings"
      :capo="capo"
      :marks="beatMarks"
      :selected-string="currentSelection?.stringIndex ?? null"
      :focus-neck-fret="focusNeckFret"
      @pick="placeOnString"
    />
    <div v-else-if="!isDrumTrack" class="note-pad__frets" role="group" aria-label="Fret">
      <button
        v-for="fret in visibleFrets"
        :key="fret"
        type="button"
        class="note-pad__fret"
        :class="{ 'is-current': fret === currentFret }"
        :data-fret="fret"
        @click="placeFret(fret)"
      >{{ fret }}</button>
      <button type="button" class="note-pad__fret note-pad__page" :aria-label="highFrets ? 'Show frets 0–13' : 'Show frets 12–24'" @click="highFrets = !highFrets">
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
      ><AppIcon :name="length.icon" :size="26" /></button>
      <button type="button" :class="{ 'is-current': isDotted }" aria-label="Dotted" @click="toggleDot">
        <AppIcon name="dotted" :size="26" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { selectionState } from '../../stores/selectionState'
import { computed, onMounted, ref } from 'vue'
import { deleteSelectedNotes, hasExplicitNoteSelection, moveSelection, placeNote, placeNoteOnString } from '../../services/editor/noteEntry'
import { toggleDrumAtCursor } from '../../services/editor/drumTracks'
import { drumLabel, drumName } from '../../utils/drumMap'
import { useUndoRedo } from '../../composables/useUndoRedo'
import { useSongData } from '../../composables/useSongData'
import { useTabSelection } from '../../composables/useTabSelection'
import { applyNoteLengthSelection } from '../../services/menuActionCommands'
import { noteLengthSpecialSelect } from '../../services/editor/durationModifierCommands'
import { setCompactEditing } from '../../stores/layoutModeState'
import { typedEventBus } from '../../utils/typedEventBus'
import type { NoteLengthCode } from '../../types/tab'
import { formatCursorPosition } from '../../utils/positionLabel'
import Settings from '../../stores/settingsState'
import type { FretboardMark } from '../../utils/fretboard'
import Fretboard from '../Fretboard.vue'
import AppIcon from '../AppIcon.vue'
import type { IconName } from '../../assets/icons/icons'

// Icons, not Unicode note glyphs: those fall back to colour emoji fonts on some systems.
const LENGTHS: { code: NoteLengthCode, icon: IconName, label: string }[] = [
  { code: 'w', icon: 'note-whole', label: 'Whole note' },
  { code: 'h', icon: 'note-half', label: 'Half note' },
  { code: 'q', icon: 'note-quarter', label: 'Quarter note' },
  { code: 'e', icon: 'note-eighth', label: 'Eighth note' },
  { code: 's', icon: 'note-16th', label: 'Sixteenth note' },
  { code: 't', icon: 'note-32nd', label: 'Thirty-second note' },
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

/** The drum track's lines, top first, and the drums hit on the cursor's beat. */
const drumPads = computed(() => [...(currentTrack.value?.drumMap ?? [])].reverse())
const beatDrums = computed(() => new Set(Array.from(currentBeat.value?.notes ?? [], (note) => note?.fret)))

const useFretboard = computed(() => Settings.touchFretboard)
const currentTrack = computed(() => {
  const trackId = currentSelection.value?.trackId ?? reactiveSongData.currentTrackId ?? 0
  return reactiveSongData.tracks?.[trackId]
})
const numStrings = computed(() => currentTrack.value?.numStrings ?? 6)
const capo = computed(() => Math.max(0, currentTrack.value?.capo ?? 0))

/** The notes of the beat at the cursor, on the neck (tab fret + capo). */
const beatMarks = computed<FretboardMark[]>(() => {
  const notes = currentBeat.value?.notes ?? []
  const cursorString = currentSelection.value?.stringIndex
  const marks: FretboardMark[] = []
  Array.from(notes, (note, string) => {
    if (note != null && note.fret >= 0) marks.push({ string, neckFret: note.fret + capo.value, current: string === cursorString })
  })
  return marks
})
const focusNeckFret = computed(() => (currentFret.value == null ? null : currentFret.value + capo.value))

const positionLabel = computed(() => {
  const selection = currentSelection.value
  if (!selection) return 'Tap a string in the tab'
  const numStrings = reactiveSongData.tracks?.[selection.trackId]?.numStrings ?? 6
  return formatCursorPosition(
    { blockId: selection.blockId, beatId: selection.beatIndex, string: selection.stringIndex },
    numStrings,
  )
})

function placeFret(fret: number): void {
  if (!hasExplicitNoteSelection() || Number.isNaN(fret)) return
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  placeNote(trackId, blockId, voiceId, beatId, string, fret)
}

function placeOnString(string: number, fret: number): void {
  placeNoteOnString(string, fret)
}

function move(direction: 'left' | 'right' | 'up' | 'down'): void {
  moveSelection(direction)
}

function deleteNote(): void {
  deleteSelectedNotes()
}

function setLength(code: NoteLengthCode): void {
  applyNoteLengthSelection(code)
}

function toggleDot(): void {
  noteLengthSpecialSelect('dotted', 3, null)
}

onMounted(() => {
  // Start at the cursor (the first beat if nothing was picked yet) so the pad works at once.
  if (!hasExplicitNoteSelection()) {
    typedEventBus.emit('navigation.setClickedPos', { ...selectionState.cursor })
  }
})
</script>

<style scoped>
.note-pad {
  flex: 0 0 auto;
  padding: 6px 10px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  user-select: none;
}

.note-pad button {
  min-width: 0;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: var(--color-surface-raised);
  color: inherit;
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
}

.note-pad button:active {
  background: var(--color-accent-soft);
}

/* The pad's own line icons; AppIcon draws itself. */
.note-pad svg:not(.app-icon) {
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
  color: var(--color-text-muted);
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
  background: var(--color-accent) !important;
  color: var(--color-on-accent) !important;
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
  color: var(--color-danger) !important;
}

.note-pad__frets {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin-top: 6px;
}

.note-pad__mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  margin-top: 6px;
  padding: 2px;
  border-radius: 10px;
  background: var(--color-surface-raised);
}

.note-pad .note-pad__mode button {
  min-height: 32px;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
}

.note-pad .note-pad__mode button.is-current {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.note-pad__fretboard {
  margin-top: 6px;
}

.note-pad__fret {
  font-size: 18px !important;
  font-variant-numeric: tabular-nums;
}

.note-pad__page {
  color: var(--color-accent) !important;
  font-size: 13px !important;
}

.note-pad button.is-current {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.note-pad__drums {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 6px;
}

.note-pad__drum {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  min-height: 48px;
}

.note-pad__drum-label {
  font-size: 15px;
  font-weight: 700;
}

.note-pad__drum-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
