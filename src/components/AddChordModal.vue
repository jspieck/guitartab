<template>
  <BaseModal>
    <template #title>Chord</template>
    <div class="strokeSelect">
      <label>Choose chord:</label>
      <svg id="chordDisplay"></svg>
      <div class="select">
        <select id="chordRootSelection">
          <option value="C">C</option>
          <option value="C#">C#</option>
          <option value="D">D</option>
          <option value="D#">D#</option>
          <option value="E">E</option>
          <option value="F">F</option>
          <option value="F#">F#</option>
          <option value="G">G</option>
          <option value="G#">G#</option>
          <option value="A">A</option>
          <option value="A#">A#</option>
          <option value="H">H</option>
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
      <label class="labelTopMargin">Capo:</label
      ><input type="number" id="chordCapoInput" /> <label>Name:</label
      ><input id="chordNameInput" />
      <label>Used Chords:</label>
      <div class="select">
        <select id="usedChordSelection"></select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <svg
      id="chordSelectButton"
      class="checkmark selectButton"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 52"
    >
      <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
      <path
        class="checkmark__check"
        fill="none"
        d="M14.1 27.2l7.1 7.2 16.7-16.8"
      />
    </svg>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
</script>
