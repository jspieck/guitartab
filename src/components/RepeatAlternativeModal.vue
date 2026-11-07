<template>
  <BaseModal :modal-id="DIALOGS.REPEAT_ALTERNATIVE.id">
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
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { RepeatAlternativeModalHandler } from '../services/dialogs/effectModals'

const handler = getDialogHandler<InstanceType<typeof RepeatAlternativeModalHandler>>(
  DIALOGS.REPEAT_ALTERNATIVE.id,
)
</script>

<style scoped>
.repeat-alternative-list {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
