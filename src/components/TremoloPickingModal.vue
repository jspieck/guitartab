<template>
  <BaseModal>
    <template #title>Tremolo Picking</template>
    <label>Choose note length</label>
    <div class="tremoloPickingSelect">
      <div class="select">
        <select id="tremoloPickingSelection">
          <option value="e">Eighth</option>
          <option value="s">Sixteenth</option>
          <option value="t">Thirty-Second</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <svg
      id="tremoloPickingSelectButton"
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
