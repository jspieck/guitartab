<template>
  <BaseModal :modal-id="DIALOGS.TIME_METER.id">
    <template #title>Time signature</template>
    <div class="modal-stack">
      <div class="modal-field-grid two-column">
        <div class="modal-field">
          <label for="time-meter-numerator">Numerator</label>
          <div class="select">
            <select
              id="time-meter-numerator"
              :value="handler.getModalState().numerator"
              @change="(e: Event) => handler.updateNumerator(Number((e.target as HTMLSelectElement).value))"
            >
              <option v-for="n in 31" :key="n" :value="n">{{ n }}</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <div class="modal-field">
          <label for="time-meter-denominator">Denominator</label>
          <div class="select">
            <select
              id="time-meter-denominator"
              :value="handler.getModalState().denominator"
              @change="(e: Event) => handler.updateDenominator(Number((e.target as HTMLSelectElement).value))"
            >
              <option v-for="n in denominators" :key="n" :value="n">{{ n }}</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handleSubmit" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { TimeMeterModalHandler } from '../services/dialogs/timeMeterModalHandler'
import SubmitButton from './SubmitButton.vue'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'

const denominators = [1, 2, 4, 8, 16, 32]
const handler = getDialogHandler<TimeMeterModalHandler>(DIALOGS.TIME_METER.id)

function handleSubmit() {
  handler.handleSubmit()
  handler.closeModal()
}

onMounted(() => {
  handler.setTimeMeterState()
})
</script>
