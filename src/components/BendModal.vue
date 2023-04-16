<template>
  <BaseModal>
    <template #title>Bend</template>
    <svg id="bendEditor"></svg>
    <label class="labelRightMargin">Presets:</label>
    <div class="select">
      <select id="bendSelection">
        <option value="0">Bending</option>
        <option value="1">Bend/Release</option>
        <option value="2">Bend/Release/Bend</option>
        <option value="3">PreBend</option>
        <option value="4">PreBend/Release</option>
      </select>
      <div class="select__arrow"></div>
    </div>
    <svg
      id="selectButton"
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
