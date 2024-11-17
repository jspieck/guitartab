<template>
  <BaseModal :modal-id="MODALS.CHORD_MANAGER.id">
    <template #title>Chord Manager</template>
        <label>Chord diagrams to display:</label>
        <div id="chordOverviewContainer">
          <div id="chordsContainer"></div>
          <button id="addChordDiagram" data-tooltip="Add Chord Diagram">+</button>
        </div>
        <svg id="chordDiagramSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
</script>