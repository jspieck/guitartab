<template>
  <BaseModal :modal-id="MODALS.TEMPO.id">
    <template #title>Tempo</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label>Tempo (BPM)</label>
        <div id="tempoMeterModal" class="modal-inline-display modal-surface-block disable-select">90</div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="bpmSelectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
</script>
