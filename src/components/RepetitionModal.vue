<template>
  <BaseModal :modal-id="MODALS.REPETITION.id">
    <template #title>Number Repetitions</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="repetition-count">Number of repetitions</label>
        <input
          id="repetition-count"
          type="number"
          v-model="handler.getModalState().numRepetitions"
          @input="(e: Event) => handler.updateRepetitions(Number((e.target as HTMLInputElement).value))"
          min="1"
          :placeholder="handler.getModalState().numRepetitions.toString()"
        />
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handleSubmit" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { RepetitionModalHandler } from "../assets/js/modals/repetitionModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const handler = modalManager.getHandler(MODALS.REPETITION.id) as RepetitionModalHandler;

const handleSubmit = () => {
  handler.applyRepetitions();
  handler.closeModal();
};
</script>
