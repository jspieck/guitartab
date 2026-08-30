<template>
  <BaseModal :modal-id="MODALS.TIME_METER.id">
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
import { MODALS } from '../assets/js/modals/modalTypes'
import { TimeMeterModalHandler } from '../assets/js/modals/timeMeterModalHandler'
import SubmitButton from './SubmitButton.vue'
import { modalManager } from '../assets/js/modals/modalManager'

const denominators = [1, 2, 4, 8, 16, 32]
const handler = modalManager.getHandler(MODALS.TIME_METER.id) as TimeMeterModalHandler

function handleSubmit() {
  handler.handleSubmit()
  handler.closeModal()
}

onMounted(() => {
  handler.setTimeMeterState()
})
</script>
