<template>
  <BaseModal :modal-id="MODALS.TREMOLO_PICKING.id">
    <template #title>Tremolo picking</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="tremolo-picking-length">Note length</label>
        <div class="select">
          <select
            id="tremolo-picking-length"
            :value="handler.getModalState().tremoloPickingLength"
            @change="(e: Event) => handler.updateTremoloPickingLength((e.target as HTMLSelectElement).value)"
          >
            <option value="e">Eighth</option>
            <option value="s">Sixteenth</option>
            <option value="t">Thirty-second</option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handleSubmit" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
import { TremoloPickingModalHandler } from '../assets/js/modals/tremoloPickingModalHandler'
import { modalManager } from '../assets/js/modals/modalManager'

const handler = modalManager.getHandler(MODALS.TREMOLO_PICKING.id) as TremoloPickingModalHandler

function handleSubmit() {
  handler.applyTremoloPicking()
  handler.closeModal()
}
</script>
