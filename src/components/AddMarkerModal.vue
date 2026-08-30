<template>
  <BaseModal :modal-id="MODALS.MARKER.id">
    <template #title>Marker</template>
    <div class="modal-stack">
      <div class="modal-field-grid">
        <div class="modal-field">
          <label for="marker-title">Title</label>
          <input
            id="marker-title"
            v-model="handler.getModalState().markerData.text"
            type="text"
            placeholder="Enter marker title"
            @input="(e: Event) => handler.updateMarkerText((e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="modal-field">
          <label>Color</label>
          <div ref="colorPickerRef" class="color-picker modal-surface-block"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handleSubmit" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
import { MarkerModalHandler } from '../assets/js/modals/markerModalHandler'
import { modalManager } from '../assets/js/modals/modalManager'
import Picker from 'vanilla-picker'

const handler = modalManager.getHandler(MODALS.MARKER.id) as MarkerModalHandler
const colorPickerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (colorPickerRef.value) {
    const { color } = handler.getModalState().markerData
    const picker = new Picker({
      parent: colorPickerRef.value,
      color: `rgb(${color.red},${color.green},${color.blue})`,
      popup: false,
    })

    picker.onChange = (color: { rgba: number[] }) => {
      handler.updateMarkerColor({
        red: color.rgba[0],
        green: color.rgba[1],
        blue: color.rgba[2],
      })
    }
  }
})

function handleSubmit() {
  handler.applyMarker()
  handler.closeModal()
}
</script>
