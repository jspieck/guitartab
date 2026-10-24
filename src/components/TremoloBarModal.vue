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
        >
          <!-- Static grid owned by Vue (no createElementNS) -->
          <g class="tremolo-grid" pointer-events="none">
            <rect
              :x="padding"
              :y="padding"
              :width="gridWidth"
              :height="gridHeight"
              fill="none"
              stroke="black"
              stroke-width="1"
            />
            <text
              v-for="label in axisLabels"
              :key="label.text"
              :x="padding - 5"
              :y="label.y"
              text-anchor="end"
              alignment-baseline="middle"
              font-size="12"
            >{{ label.text }}</text>
            <line
              v-for="i in columnCount + 1"
              :key="`v-${i}`"
              :x1="padding + (gridWidth * (i - 1)) / columnCount"
              :y1="padding"
              :x2="padding + (gridWidth * (i - 1)) / columnCount"
              :y2="padding + gridHeight"
              stroke="#ddd"
              stroke-width="1"
            />
            <line
              v-for="i in rowCount + 1"
              :key="`h-${i}`"
              :x1="padding"
              :y1="padding + (gridHeight * (i - 1)) / rowCount"
              :x2="padding + gridWidth"
              :y2="padding + (gridHeight * (i - 1)) / rowCount"
              stroke="#ddd"
              stroke-width="1"
            />
          </g>
          <g ref="pointsLayerRef" class="tremolo-points" />
        </svg>
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
import { computed, onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { TremoloBarModalHandler } from '../services/dialogs/tremoloBarModalHandler'
import { modalManager } from '../services/dialogs/modalManager'

const tremoloEditorRef = ref<SVGElement | null>(null)
const pointsLayerRef = ref<SVGGElement | null>(null)
const selectedPreset = ref('0')
const handler = modalManager.getHandler(MODALS.TREMOLO_BAR.id) as TremoloBarModalHandler

const padding = 20
const editorSize = 300
const columnCount = 12
const rowCount = 24
const gridWidth = editorSize - 2 * padding
const gridHeight = editorSize - 2 * padding

const axisLabels = computed(() => [
  { text: '+16', y: padding },
  { text: '+8', y: gridHeight / 3 + padding },
  { text: '0', y: (2 * gridHeight) / 3 + padding },
  { text: '-8', y: gridHeight + padding },
])

function handleMouseDown(event: MouseEvent) {
  if (tremoloEditorRef.value) {
    handler.handleMouseDown(event, tremoloEditorRef.value)
  }
}

onMounted(() => {
  if (tremoloEditorRef.value && pointsLayerRef.value) {
    handler.initializeTremoloEditor(tremoloEditorRef.value, pointsLayerRef.value)
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
