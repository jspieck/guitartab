<template>
  <BaseModal :modal-id="MODALS.TEXT.id">
    <template #title>Add Text</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label for="beat-text">Text</label>
        <textarea id="beat-text" v-model="handler.form.text" placeholder="Enter your text here"></textarea>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { modalManager } from '../services/dialogs/modalManager'
import type { TextModalHandler } from '../services/dialogs/effectModals'

const handler = modalManager.getHandler<InstanceType<typeof TextModalHandler>>(MODALS.TEXT.id)
</script>
