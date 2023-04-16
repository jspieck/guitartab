<template>
  <BaseModal>
    <template #title>Tremolo Bar</template>
    <svg id="tremoloEditor"></svg>
    <label class="labelRightMargin">Presets:</label>
    <div class="select">
      <select id="tremoloSelection">
        <option value="0">Dive</option>
        <option value="1">Dip</option>
        <option value="2">Release Up</option>
        <option value="3">Inverted Dip</option>
        <option value="4">Return</option>
        <option value="5">Release Down</option>
      </select>
      <div class="select__arrow"></div>
    </div>
    <svg
      id="tremoloSelectButton"
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
