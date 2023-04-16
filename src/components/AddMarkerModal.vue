<template>
  <BaseModal>
    <template #title>Add Marker</template>
    <div class="strokeSelect">
      <label class="labelTopMargin">Title:</label>
      <input id="markerSelection" />
      <label class="labelTopMargin">Color:</label>
      <input id="markerColorPicker" readonly="readonly" />
    </div>
    <svg
      id="markerSelectButton"
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
