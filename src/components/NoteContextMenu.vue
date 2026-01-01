<template>
  <div
    v-if="isVisible && note"
    :style="menuStyle"
    class="note-context-menu"
    @click.stop
  >
    <div class="menu-header">
      Note {{ note.fret }} on String {{ note.string + 1 }}
    </div>

      <!-- Durations Section -->
      <div class="menu-section">
        <div class="section-title">Duration</div>
        <div class="duration-grid">
          <button 
            v-for="dur in durations" 
            :key="dur.id"
            class="icon-button"
            :class="{ active: currentDuration === dur.id }"
            @click="setDuration(dur.id)"
            :title="dur.label"
          >
            <img :src="dur.icon" :alt="dur.label" class="duration-icon">
          </button>
        </div>
      </div>

      <!-- Effects Section -->
      <div class="menu-section">
        <div class="section-title">Effects</div>
        <div class="effects-grid">
          <button 
            v-for="effect in effectButtons" 
            :key="effect.id"
            class="icon-button"
            :class="{ active: hasEffect(effect.id) }"
            @click="toggleEffect(effect.id)"
            :title="effect.label"
          >
            <img :src="effect.icon" :alt="effect.label" class="effect-icon">
          </button>
        </div>
      </div>

      <!-- Actions Section -->
      <div class="menu-section actions">
        <button class="action-button delete" @click="deleteNote">
          <span class="icon">🗑️</span> Delete
        </button>
        <button class="action-button" @click="copyNote">
          <span class="icon">📋</span> Copy
        </button>
        <button class="action-button" @click="pasteNote">
          <span class="icon">📥</span> Paste
        </button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'

// Import icons
import wholeNoteIcon from '../assets/images/notes/wholeNote.svg'
import halfNoteIcon from '../assets/images/notes/halfNote.svg'
import quarterNoteIcon from '../assets/images/notes/quarterNote.svg'
import eighthNoteIcon from '../assets/images/notes/eighthNote.svg'
import sixteenthNoteIcon from '../assets/images/notes/16thNote.svg'
import thirtySecondNoteIcon from '../assets/images/notes/32ndNote.svg'

import vibratoIcon from '../assets/images/articulations/vibrato.svg'
import bendIcon from '../assets/images/articulations/bend.svg'
import slideIcon from '../assets/images/articulations/Slide.svg'
import ghostIcon from '../assets/images/articulations/brackets.svg'
import deadIcon from '../assets/images/articulations/dead.svg'
import hammerIcon from '../assets/images/articulations/hammerOn.svg'
import palmMuteIcon from '../assets/images/articulations/PalmMute.svg'
import staccatoIcon from '../assets/images/articulations/Stacatto.svg'
import trillIcon from '../assets/images/articulations/Triller.svg'

interface Note {
  fret: number
  string: number
  duration?: string
  tied?: boolean
  tieBegin?: boolean
  gracePresent?: boolean
  graceObj?: { fret: number; duration: string }
  bendPresent?: boolean
  ghost?: boolean
  dead?: boolean
  pullDown?: boolean
  vibrato?: boolean
  trillPresent?: boolean
  trill?: { fret: number; period: number }
  tremoloBar?: boolean
  textEffect?: string
  letRing?: boolean
  artificialPresent?: boolean
  tremoloPickingPresent?: boolean
  palmMute?: boolean
  stacatto?: boolean
  tap?: boolean
  slap?: boolean
  pop?: boolean
  accentuated?: boolean
  heavyAccentuated?: boolean
  fadeIn?: boolean
  slide?: boolean
}

interface Props {
  isVisible: boolean
  note: Note | null
  x?: number
  y?: number
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  note: null,
  x: 0,
  y: 0,
})

const emit = defineEmits(['close', 'toggle-effect', 'set-duration', 'delete-note', 'copy-note', 'paste-note'])

watch(() => props.isVisible, (newVal) => {
  console.log('NoteContextMenu isVisible changed to:', newVal, 'note:', props.note)
})

const durations = [
  { id: 'w', label: 'Whole', icon: wholeNoteIcon },
  { id: 'h', label: 'Half', icon: halfNoteIcon },
  { id: 'q', label: 'Quarter', icon: quarterNoteIcon },
  { id: 'e', label: '8th', icon: eighthNoteIcon },
  { id: 's', label: '16th', icon: sixteenthNoteIcon },
  { id: 't', label: '32nd', icon: thirtySecondNoteIcon },
]

const effectButtons = [
  { id: 'vibrato', label: 'Vibrato', icon: vibratoIcon },
  { id: 'bend', label: 'Bend', icon: bendIcon },
  { id: 'slide', label: 'Slide', icon: slideIcon },
  { id: 'ghost', label: 'Ghost', icon: ghostIcon },
  { id: 'dead', label: 'Dead', icon: deadIcon },
  { id: 'pullDown', label: 'Hammer/Pull', icon: hammerIcon },
  { id: 'palmMute', label: 'Palm Mute', icon: palmMuteIcon },
  { id: 'stacatto', label: 'Staccato', icon: staccatoIcon },
  { id: 'trill', label: 'Trill', icon: trillIcon },
]

const currentDuration = computed(() => props.note?.duration || 'q')

const menuStyle = computed(() => {
  if (!props.isVisible) {
    return { display: 'none' }
  }

  // Position near the click point
  const x = props.x || 0
  const y = props.y || 0

  return {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 10000,
    transform: 'translate(-50%, -10px)', // Position slightly above the click
    pointerEvents: 'auto'
  }
})

function hasEffect(effectId: string): boolean {
  if (!props.note) return false
  const note = props.note as any
  
  if (effectId === 'bend') return note.bendPresent
  if (effectId === 'trill') return note.trillPresent
  if (effectId === 'pullDown') return note.pullDown
  
  return !!note[effectId]
}

function toggleEffect(effectId: string) {
  emit('toggle-effect', effectId)
}

function setDuration(durationId: string) {
  emit('set-duration', durationId)
}

function deleteNote() {
  emit('delete-note')
  emit('close')
}

function copyNote() {
  emit('copy-note')
  emit('close')
}

function pasteNote() {
  emit('paste-note')
  emit('close')
}

onMounted(() => {
  console.log('NoteContextMenu mounted, isVisible:', props.isVisible, 'note:', props.note, 'x:', props.x, 'y:', props.y)
})
</script>

<style scoped>
.note-context-menu {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: none;
}

.menu-header {
  font-size: 11px;
  font-weight: bold;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  font-size: 10px;
  font-weight: bold;
  color: #aaa;
  text-transform: uppercase;
}

.duration-grid, .effects-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.effects-grid {
  grid-template-columns: repeat(5, 1fr);
}

.icon-button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 4px;
}

.icon-button:hover {
  background: #f0f0f0;
  border-color: #ddd;
}

.icon-button.active {
  background: #e3f2fd;
  border-color: #2196f3;
}

.duration-icon, .effect-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.icon-button.active .duration-icon,
.icon-button.active .effect-icon {
  filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(190deg) brightness(100%) contrast(92%);
}

.menu-section.actions {
  flex-direction: row;
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
  gap: 8px;
}

.action-button {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  background: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.action-button:hover {
  background: #f0f0f0;
}

.action-button.delete:hover {
  background: #ffebee;
  color: #d32f2f;
  border-color: #ffcdd2;
}

.icon {
  font-size: 14px;
}

.effect-icon {
  width: 16px;
  height: 16px;
  opacity: 0.8;
}

/* Scrollbar styling */
.note-context-menu::-webkit-scrollbar {
  width: 6px;
}

.note-context-menu::-webkit-scrollbar-track {
  background: transparent;
}

.note-context-menu::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.note-context-menu::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
