<template>
  <BaseModal :modal-id="MODALS.CHORD_MANAGER.id">
    <template #title>Chord Manager</template>
    <div class="modal-stack chord-manager-modal">
      <div class="chord-manager-header">
        <div>
          <p class="chord-manager-caption">Show, hide, or edit saved chord shapes.</p>
        </div>
        <button
          type="button"
          class="modal-secondary-button"
          @click="addNewChord"
          title="Add chord diagram"
        >
          New chord
        </button>
      </div>

      <div v-if="chordEntries.length === 0" class="chord-empty-state modal-surface-block">
        No chord diagrams yet. Create one with <strong>New chord</strong>.
      </div>

      <div v-else class="chords-grid">
        <div
          v-for="[name, chord] in chordEntries"
          :key="name"
          class="chord-box modal-surface-block"
          :class="{ 'chord-box-hidden': !chord.display }"
        >
          <div class="chord-name">{{ name }}</div>
          <svg
            class="chord-diagram"
            width="100"
            height="120"
            viewBox="0 0 100 120"
            :data-chord-name="name"
          >
            <ChordThumbnail :chord="chord" />
          </svg>
          <div class="chord-actions">
            <button
              type="button"
              class="chord-action-button"
              title="Edit chord"
              @click="editChord(name, chord)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4l10.5-10.5a1.8 1.8 0 0 0 0-2.6l-1.4-1.4a1.8 1.8 0 0 0-2.6 0L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="chord-action-button chord-action-button-danger"
              title="Delete chord"
              @click="deleteChord(name)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="chord-action-button"
              :title="chord.display ? 'Hide chord' : 'Show chord'"
              @click="toggleChordVisibility(name)"
            >
              <svg v-if="chord.display" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8" />
                <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.6A4 4 0 0 0 12 16a4 4 0 0 0 3.4-1.8M6.7 6.8C4.1 8.4 2.4 10.6 2 12s3.5 6 10 6c1.8 0 3.4-.4 4.8-1.1M17.3 17.2C19.9 15.6 21.6 13.4 22 12s-3.5-6-10-6c-1.1 0-2.1.2-3 .5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="modal-submit-row">
        <SubmitButton label="Done" variant="secondary" @submitInfo="handleSubmit" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import ChordThumbnail from './ChordThumbnail.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { modalManager } from '../services/dialogs/modalManager'
import type { PlainModalHandler } from '../services/dialogs/baseModalHandler'
import { Song } from '../stores/song'
import { notifySongDataChanged } from '../services/appEvents'
import { typedEventBus } from '../utils/typedEventBus'
import { deleteLibraryChord, toggleLibraryChordDisplay } from '../services/editor/songSettingsCommands'
import type { Chord } from '../types/tab'

const handler = modalManager.getHandler<PlainModalHandler<{ trackId: number }>>(MODALS.CHORD_MANAGER.id)
const managedTrackId = () => handler.params.value?.trackId ?? 0
// Opening the manager (for this or another track) shows that track's chords.
watch(handler.params, () => reloadChords())
const chords = ref<Map<string, Chord>>(new Map())

const chordEntries = computed(() => [...chords.value.entries()].sort(([left], [right]) => left.localeCompare(right)))

function reloadChords() {
  const trackId = managedTrackId()
  const trackChords = Song.chordsMap[trackId]
  chords.value = trackChords ? new Map(trackChords) : new Map()
}

function notifyChordChange() {
  notifySongDataChanged()
}

function editChord(name: string, chord: Chord) {
  modalManager.toggleByModal(MODALS.ADD_CHORD, {
    trackId: managedTrackId(),
    existingChord: { ...chord, name },
  })
}

async function deleteChord(name: string) {
  if (await confirm(`Delete chord ${name}?`)) {
    deleteLibraryChord(managedTrackId(), name)
    reloadChords()
  }
}

function toggleChordVisibility(name: string) {
  toggleLibraryChordDisplay(managedTrackId(), name)
  reloadChords()
}

function addNewChord() {
  modalManager.toggleByModal(MODALS.ADD_CHORD, {
    trackId: managedTrackId(),
  })
}

function handleSubmit() {
  notifyChordChange()
  handler.closeModal()
}

onMounted(() => {
  reloadChords()
  typedEventBus.on('song-data-changed', reloadChords)
  typedEventBus.on('render.chordDiagrams', reloadChords)
})

onUnmounted(() => {
  typedEventBus.off('song-data-changed', reloadChords)
  typedEventBus.off('render.chordDiagrams', reloadChords)
})
</script>

<style scoped>
.chord-manager-modal {
  gap: 14px;
}

.chord-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chord-manager-caption {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.45;
}

.chord-empty-state {
  padding: 18px 14px;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.chords-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding-right: 2px;
}

.chord-box {
  padding: 12px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.chord-box-hidden {
  opacity: 0.55;
}

.chord-name {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
}

.chord-diagram {
  display: block;
}

.chord-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.chord-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chord-action-button svg {
  width: 16px;
  height: 16px;
}

.chord-action-button:hover {
  background: var(--color-active);
  color: var(--color-text);
  border-color: var(--color-text-faint);
}

.chord-action-button-danger:hover {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
}
</style>
