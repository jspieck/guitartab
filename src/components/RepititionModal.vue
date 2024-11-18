<template>
  <BaseModal :modal-id="MODALS.REPETITION.id">
    <template #title>Number Repetitions</template>
    <div class="repetition-input">
      <label>Number of Repetitions:</label>
      <input 
        type="number"
        v-model="handler.getModalState().numRepetitions"
        @input="(e) => handler.updateRepetitions(Number((e.target as HTMLInputElement).value))"
        min="1"
        :placeholder="handler.getModalState().numRepetitions.toString()"
      />
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
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

<style scoped>
.repetition-input {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>