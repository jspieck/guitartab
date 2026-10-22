<template>
  <BaseModal :modal-id="MODALS.REPEAT_ALTERNATIVE.id">
    <template #title>Repeat Alternative</template>
    <div class="modal-stack">
      <p class="modal-body-text">Check all suitable endings.</p>
      <ul class="modal-checkbox-list repeat-alternative-list">
        <li v-for="(_, index) in handler.form.endings" :key="index" class="modal-checkbox-row">
          <input
            :id="`styled-checkbox-${index + 1}`"
            v-model="handler.form.endings[index]"
            class="styled-checkbox"
            type="checkbox"
          />
          <label :for="`styled-checkbox-${index + 1}`">{{ index + 1 }}</label>
        </li>
      </ul>
      <div class="modal-submit-row">
        <SubmitButton button-id="repeatAlternativeSelectButton" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
import { modalManager } from '../assets/js/modals/modalManager'
import type { RepeatAlternativeModalHandler } from '../assets/js/modals/effectModals'

const handler = modalManager.getHandler<InstanceType<typeof RepeatAlternativeModalHandler>>(
  MODALS.REPEAT_ALTERNATIVE.id,
)
</script>

<style scoped>
.repeat-alternative-list {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
