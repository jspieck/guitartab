<template>
  <BaseModal :modal-id="MODALS.TEMPO.id">
    <template #title>Tempo</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label for="tempo-bpm">Tempo (BPM)</label>
        <div
          id="tempoMeterModal"
          class="modal-inline-display modal-surface-block disable-select"
          title="Drag up or down"
          @pointerdown="startDrag"
        >{{ handler.form.bpm }}</div>
        <input id="tempo-bpm" v-model.number="handler.form.bpm" type="number" :min="TEMPO_MIN" :max="TEMPO_MAX" />
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="bpmSelectButton" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { modalManager } from '../services/dialogs/modalManager'
import type { TempoModalHandler } from '../services/dialogs/effectModals'
import { TEMPO_MAX, TEMPO_MIN, clampTempo } from '../utils/tempo'

const handler = modalManager.getHandler<InstanceType<typeof TempoModalHandler>>(MODALS.TEMPO.id)

/** Dragging the number up or down changes the tempo by one BPM per pixel. */
function startDrag(event: PointerEvent) {
  const startY = event.pageY
  const startBpm = handler.form.bpm
  const move = (e: PointerEvent) => {
    handler.form.bpm = clampTempo(startBpm + startY - e.pageY)
  }
  const stop = () => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', stop)
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', stop)
}
</script>
