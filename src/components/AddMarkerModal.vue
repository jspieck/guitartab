<template>
  <BaseModal :modal-id="DIALOGS.MARKER.id">
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
import type Picker from 'vanilla-picker'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { MarkerModalHandler } from '../services/dialogs/effectModals'

const handler = getDialogHandler<InstanceType<typeof MarkerModalHandler>>(DIALOGS.MARKER.id)
const colorPickerRef = ref<HTMLElement | null>(null)
let picker: Picker | null = null

function colorString(): string {
  const { red, green, blue } = handler.form.color
  return `rgb(${red},${green},${blue})`
}

// The dialogs mount after startup; the picker library loads with them, not with the app.
onMounted(async () => {
  const { default: Picker } = await import('vanilla-picker')
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
