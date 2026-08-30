<template>
  <BaseModal :modal-id="MODALS.TREMOLO_BAR.id">
    <template #title>Tremolo bar</template>
    <div class="modal-stack">
      <div class="tremolo-editor-container modal-surface-block">
        <svg
          ref="tremoloEditorRef"
          width="300"
          height="300"
          @mousedown="handleMouseDown"
        ></svg>
      </div>
      <div class="modal-field">
        <label for="tremoloSelection">Preset</label>
        <div class="select">
          <select
            id="tremoloSelection"
            v-model="selectedPreset"
            @change="(e: Event) => handler.applyTremoloPreset(Number((e.target as HTMLSelectElement).value))"
          >
            <option value="0">Dive</option>
            <option value="1">Dip</option>
            <option value="2">Release up</option>
            <option value="3">Inverted dip</option>
            <option value="4">Return</option>
            <option value="5">Release down</option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="tremoloSelectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
import { TremoloBarModalHandler } from '../assets/js/modals/tremoloBarModalHandler'
import { modalManager } from '../assets/js/modals/modalManager'

const tremoloEditorRef = ref<SVGElement | null>(null)
const selectedPreset = ref('0')
const handler = modalManager.getHandler(MODALS.TREMOLO_BAR.id) as TremoloBarModalHandler

function handleMouseDown(event: MouseEvent) {
  if (tremoloEditorRef.value) {
    handler.handleMouseDown(event, tremoloEditorRef.value)
  }
}

onMounted(() => {
  if (tremoloEditorRef.value) {
    handler.initializeTremoloEditor(tremoloEditorRef.value)
  }
})
</script>

<style scoped>
.tremolo-editor-container {
  display: flex;
  justify-content: center;
  padding: 8px;
}
</style>
