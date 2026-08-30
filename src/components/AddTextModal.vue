<template>
  <BaseModal :modal-id="MODALS.TEXT.id">
    <template #title>Add Text</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label>Text</label>
        <textarea 
          v-model="handler.getModalState().text"
          @input="(e: Event) => handler.updateText((e.target as HTMLTextAreaElement).value)"
          placeholder="Enter your text here"
        ></textarea>
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
import { TextModalHandler } from "../assets/js/modals/textModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const handler = modalManager.getHandler(MODALS.TEXT.id) as TextModalHandler;

const handleSubmit = () => {
  handler.applyText();
  handler.closeModal();
};
</script>
