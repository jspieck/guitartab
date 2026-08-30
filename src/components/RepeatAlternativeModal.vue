<template>
  <BaseModal :modal-id="MODALS.REPEAT_ALTERNATIVE.id">
    <template #title>Repeat Alternative</template>
    <div class="modal-stack">
      <p class="modal-body-text">Check all suitable endings.</p>
      <ul class="modal-checkbox-list repeat-alternative-list">
        <li v-for="index in 8" :key="index" class="modal-checkbox-row">
          <input
            class="styled-checkbox"
            :id="`styled-checkbox-${index}`"
            type="checkbox"
          />
          <label :for="`styled-checkbox-${index}`">{{ index }}</label>
        </li>
      </ul>
      <div class="modal-submit-row">
        <SubmitButton button-id="repeatAlternativeSelectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
</script>

<style scoped>
.repeat-alternative-list {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
