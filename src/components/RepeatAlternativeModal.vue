<template>
  <BaseModal :modal-id="MODALS.REPEAT_ALTERNATIVE.id">
    <template #title>Repeat Alternative</template>
    <label>Check all suitable endings</label>
    <div id="alternativeContainer">
      <ul class="unstyled centered">
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-1"
            type="checkbox"
          /><label for="styled-checkbox-1">1</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-2"
            type="checkbox"
          /><label for="styled-checkbox-2">2</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-3"
            type="checkbox"
          /><label for="styled-checkbox-3">3</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-4"
            type="checkbox"
          /><label for="styled-checkbox-4">4</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-5"
            type="checkbox"
          /><label for="styled-checkbox-5">5</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-6"
            type="checkbox"
          /><label for="styled-checkbox-6">6</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-7"
            type="checkbox"
          /><label for="styled-checkbox-7">7</label>
        </li>
        <li>
          <input
            class="styled-checkbox"
            id="styled-checkbox-8"
            type="checkbox"
          /><label for="styled-checkbox-8">8</label>
        </li>
      </ul>
    </div>
    <svg
      id="repeatAlternativeSelectButton"
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
import { MODALS } from "../assets/js/modals/modalTypes";
</script>
