<template>
  <BaseModal :modal-id="DIALOGS.TREMOLO_PICKING.id">
    <template #title>Tremolo picking</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="tremolo-picking-length">Note length</label>
        <div class="select">
          <select id="tremolo-picking-length" v-model="handler.form.length">
            <option value="e">Eighth</option>
            <option value="s">Sixteenth</option>
            <option value="t">Thirty-second</option>
          </select>
        </div>
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
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { TremoloPickingModalHandler } from '../services/dialogs/effectModals'

const handler = getDialogHandler<InstanceType<typeof TremoloPickingModalHandler>>(DIALOGS.TREMOLO_PICKING.id)
</script>
