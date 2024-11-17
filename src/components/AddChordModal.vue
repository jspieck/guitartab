<template>
  <BaseModal :modal-id="MODALS.CHORD.id">
    <template #title>Chord</template>
    <div class="strokeSelect">
      <label>Choose chord:</label>
      <svg id="chordDisplay" ref="chordDisplayRef"></svg>
      <div class="select">
        <select 
          :value="handler.getChordRoot()"
          @input="(e) => handler.setChordRoot((e.target as HTMLSelectElement).value)"
          @change="handler.drawChordPreset(handler.getChordRoot(), handler.getChordType())"
        >
          <option v-for="note in chordNotes" :key="note" :value="note">
            {{ note }}
          </option>
        </select>
        <div class="select__arrow"></div>
      </div>
      <div class="select">
        <select id="chordTypeSelection">
          <option value="maj">Major</option>
          <option value="min">Minor</option>
        </select>
        <div class="select__arrow"></div>
      </div>
      <label class="labelTopMargin">Capo:</label>
      <input type="number" id="chordCapoInput" />
      <label>Name:</label>
      <input id="chordNameInput" />
      <label>Used Chords:</label>
      <div class="select">
        <select id="usedChordSelection"></select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton :submitInfo="onSelectButtonClick" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BaseModal from "./BaseModal.vue";
import { ChordModalHandler } from "../assets/js/modals/chordModalHandler";
import { Chord } from '../assets/js/songData';
import { MODALS } from "../assets/js/modals/modalTypes";

const props = defineProps({
  trackId: {
    type: Number,
    required: true
  },
  chord: {
    type: Object,
    default: null
  }
});

const chordNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const handler = new ChordModalHandler();
const chordDisplayRef = ref<SVGElement | null>(null);

function onSelectButtonClick() {
  handler.setupGlobalChordSelectButton(props.trackId);
}

onMounted(() => {
  /* handler.openModal({
    trackId: props.trackId,
    chord: props.chord as Chord
  });
  handler.fillChordsPresets(props.trackId);
  
  if (chordDisplayRef.value) {
    handler.drawChordEditor();
  } */
});
</script>

<style scoped>
.strokeSelect {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#chordDisplay {
  width: 100%;
  height: 200px;
  margin: 1rem 0;
}

input[type="number"] {
  width: 60px;
}
</style>
