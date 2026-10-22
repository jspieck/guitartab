<template>
  <BaseModal :modal-id="MODALS.DRUM_INFO.id">
    <template #title>Drum map</template>
    <div class="drum-map">
      <p class="drum-map-hint">
        On a drum track the fret number is the General MIDI note. Click a piece to place it at the cursor.
      </p>
      <section v-for="group in groups" :key="group.name" class="drum-map-group">
        <h3 class="drum-map-heading">{{ group.name }}</h3>
        <div class="drum-map-grid">
          <button v-for="piece in group.pieces" :key="piece.note" type="button" class="drum-map-item"
            :title="`Place ${piece.name} (note ${piece.note})`" @click="placeNote(piece.note)">
            <span class="drum-map-note">{{ piece.note }}</span>
            <span class="drum-map-name">{{ piece.name }}</span>
          </button>
        </div>
      </section>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { selectionState } from '../stores/selectionState';
import BaseModal from "./BaseModal.vue";
import audioEngine from "../assets/js/audioEngine";
import AppManager from "../assets/js/appManager";
import { MODALS } from "../assets/js/modals/modalTypes";

const GROUPS: { name: string, test: RegExp }[] = [
  { name: 'Kicks & snares', test: /kick|snare|clap|stick/i },
  { name: 'Toms', test: /tom/i },
  { name: 'Hi-hats & cymbals', test: /hi-hat|crash|ride|cymbal|splash/i },
  { name: 'Percussion', test: /.*/ },
];

const pieces = Array.from(audioEngine.noteToDrum.entries()).map(([note, info]) => ({ note, name: info[0] }));
const groups = GROUPS.map((group, index) => ({
  name: group.name,
  pieces: pieces.filter((piece) => GROUPS.findIndex((g) => g.test.test(piece.name)) === index),
}));

function placeNote(midiNote: number) {
  // Read the cursor now, not when the modal was mounted.
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor;
  AppManager.placeNote(trackId, blockId, voiceId, beatId, string, midiNote);
}
</script>

<style scoped>
.drum-map {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.drum-map-hint {
  margin: 0;
  color: var(--modal-text-muted);
  font-size: 12px;
}
.drum-map-heading {
  margin: 0 0 6px;
  color: var(--modal-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.drum-map-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
.drum-map-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--modal-card-border);
  border-radius: 6px;
  background: var(--modal-card-subtle);
  color: var(--modal-text-strong);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}
.drum-map-item:hover {
  border-color: var(--modal-accent);
  background: var(--modal-card-hover);
}
.drum-map-item:focus-visible {
  outline: 2px solid var(--modal-accent);
  outline-offset: 1px;
}
.drum-map-note {
  min-width: 18px;
  color: var(--modal-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.drum-map-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
