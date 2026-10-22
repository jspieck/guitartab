<template>
  <BaseModal :modal-id="MODALS.REPETITION.id">
    <template #title>Number Repetitions</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="repetition-count">Number of repetitions</label>
        <input id="repetition-count" v-model.number="handler.form.count" type="number" min="1" />
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
import { MODALS } from '../assets/js/modals/modalTypes'
import { modalManager } from '../assets/js/modals/modalManager'
import type { RepetitionModalHandler } from '../assets/js/modals/effectModals'

const handler = modalManager.getHandler<InstanceType<typeof RepetitionModalHandler>>(MODALS.REPETITION.id)
</script>
