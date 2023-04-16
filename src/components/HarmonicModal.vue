<template>
  <BaseModal>
    <template #title>Harmonic</template>
    <div class="harmonicSelect">
      <div class="select">
        <select id="harmonicSelection">
          <option value="N.H.">Natural Harmonic (N.H.)</option>
          <option value="A.H.">Artificial Harmonic (A.H.)</option>
          <option value="T.H.">Tapped Harmonic (T.H.)</option>
          <option value="P.H.">Pinch Harmonic (P.H.)</option>
          <option value="S.H.">Semi Harmonic (S.H.)</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <svg
      id="harmonicSelectButton"
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
