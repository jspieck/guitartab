<template>
  <BaseModal :modal-id="MODALS.MARKER.id">
    <template #title>Marker</template>
    <div class="modal-stack">
      <div class="modal-field-grid">
        <div class="modal-field">
          <label for="marker-title">Title</label>
          <input id="marker-title" v-model="handler.form.text" type="text" placeholder="Enter marker title" />
        </div>
        <div class="modal-field">
          <label>Color</label>
          <div ref="colorPickerRef" class="color-picker modal-surface-block"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Picker from 'vanilla-picker'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
import { modalManager } from '../assets/js/modals/modalManager'
import type { MarkerModalHandler } from '../assets/js/modals/effectModals'

const handler = modalManager.getHandler<InstanceType<typeof MarkerModalHandler>>(MODALS.MARKER.id)
const colorPickerRef = ref<HTMLElement | null>(null)
let picker: Picker | null = null

function colorString(): string {
  const { red, green, blue } = handler.form.color
  return `rgb(${red},${green},${blue})`
}

onMounted(() => {
  if (!colorPickerRef.value) return
  picker = new Picker({ parent: colorPickerRef.value, color: colorString(), popup: false })
  picker.onChange = (color: { rgba: number[] }) => {
    handler.form.color = { red: color.rgba[0], green: color.rgba[1], blue: color.rgba[2] }
  }
})

// Show the marker's own colour when the dialog opens on another bar.
watch(
  () => handler.form.color,
  () => picker?.setColor(colorString(), true),
)
</script>
