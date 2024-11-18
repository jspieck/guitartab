<template>
  <BaseModal :modal-id="MODALS.TEXT.id">
    <template #title>Add Text</template>
    <div class="strokeSelect">
      <label>Enter text:</label>
      <textarea 
        v-model="handler.getModalState().text"
        @input="(e) => handler.updateText((e.target as HTMLTextAreaElement).value)"
        placeholder="Enter your text here"
      ></textarea>
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { TextModalHandler } from "../assets/js/modals/textModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const handler = modalManager.getHandler(MODALS.TEXT.id) as TextModalHandler;

const handleSubmit = () => {
  handler.applyText();
  handler.closeModal();
};
</script>

<style scoped>
.strokeSelect {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

textarea {
  width: 100%;
  min-height: 100px;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
}
</style>
