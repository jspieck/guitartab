<template>
  <BaseModal :modal-id="DIALOGS.CLEF.id">
    <template #title>Clef</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label for="clef-select">Clef from this bar</label>
        <select id="clef-select" v-model="handler.form.clef">
          <option v-for="option in CLEFS" :key="option.clef" :value="option.clef">{{ option.label }}</option>
        </select>
      </div>
      <p class="clef-hint">This track only, until its next clef change. Shown on the classical staff.</p>
      <div class="modal-submit-row">
        <SubmitButton button-id="clefSubmit" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { ClefModalHandler } from '../services/dialogs/effectModals'
import { CLEFS } from '../utils/clefs'

const handler = getDialogHandler<InstanceType<typeof ClefModalHandler>>(DIALOGS.CLEF.id)
</script>

<style scoped>
.clef-hint {
  margin: 0;
  max-width: 260px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
