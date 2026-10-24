<template>
  <BaseModal :modal-id="MODALS.BEND.id">
    <template #title>Bend</template>
    <div class="modal-stack">
      <div class="bend-editor-container modal-surface-block">
        <svg
          id="bendEditor"
          ref="bendEditorRef"
          :width="editorWidth"
          :height="editorHeight"
        >
          <g class="bend-grid" pointer-events="none">
            <rect
              :x="paddingLeft"
              :y="paddingTop"
              :width="gridWidth"
              :height="gridHeight"
              fill="none"
              stroke="black"
              stroke-width="1"
            />
            <text
              v-for="label in axisLabels"
              :key="label.text"
              x="0"
              :y="label.y"
              font-size="12px"
            >{{ label.text }}</text>
            <path
              v-for="line in verticalLines"
              :key="line.key"
              :d="line.d"
              :stroke="line.stroke"
              stroke-width="1"
              fill="none"
              :class="line.className"
            />
            <path
              v-for="line in horizontalLines"
              :key="line.key"
              :d="line.d"
              :stroke="line.stroke"
              stroke-width="1"
              fill="none"
              :stroke-dasharray="line.dash"
              :class="line.className"
            />
          </g>
          <g ref="pointsLayerRef" class="bend-points" />
        </svg>
      </div>
      <div class="modal-field">
        <label for="bendSelection">Preset</label>
        <div class="select">
          <select id="bendSelection">
            <option value="0">Bending</option>
            <option value="1">Bend / release</option>
            <option value="2">Bend / release / bend</option>
            <option value="3">Pre-bend</option>
            <option value="4">Pre-bend / release</option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="selectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { BendModalHandler } from '../services/dialogs/bendModalHandler'
import { modalManager } from '../services/dialogs/modalManager'

const handler = modalManager.getHandler(MODALS.BEND.id) as BendModalHandler
const bendEditorRef = ref<SVGSVGElement | null>(null)
const pointsLayerRef = ref<SVGGElement | null>(null)

const paddingTop = 20
const paddingLeft = 25
const editorWidth = 501
const editorHeight = 200
const horizontalSteps = 12
const verticalSteps = 12
const gridWidth = editorWidth - 2 * paddingLeft
const gridHeight = editorHeight - 2 * paddingTop

const axisLabels = computed(() => [
  { text: '0', y: gridHeight + paddingTop },
  { text: 'Half', y: (gridHeight * 2) / 3 + paddingTop },
  { text: 'Full', y: paddingTop + gridHeight / 3 },
  { text: '1.5', y: paddingTop },
])

const verticalLines = computed(() => {
  const lines = []
  for (let i = 0; i < horizontalSteps - 1; i += 1) {
    const xPos = (gridWidth / horizontalSteps) * (i + 1) + paddingLeft
    const strong = (i + 1) % 3 === 0
    lines.push({
      key: `v-${i}`,
      d: `M${xPos} ${paddingTop}L${xPos} ${gridHeight + paddingTop}`,
      stroke: strong ? '#4a4a4a' : '#d6d6d6',
      className: strong ? 'strongGridLine' : 'gridLine',
    })
  }
  return lines
})

const horizontalLines = computed(() => {
  const lines = []
  for (let i = 0; i < verticalSteps - 1; i += 1) {
    const yPos = (gridHeight / verticalSteps) * (i + 1) + paddingTop
    const strong = (i + 1) % 4 === 0
    lines.push({
      key: `h-${i}`,
      d: `M${paddingLeft} ${yPos}L${gridWidth + paddingLeft} ${yPos}`,
      stroke: strong ? '#4a4a4a' : '#d6d6d6',
      dash: strong ? undefined : '5, 5',
      className: strong ? 'strongGridLine' : 'gridLine',
    })
  }
  return lines
})

onMounted(() => {
  if (pointsLayerRef.value) {
    handler.setPointsLayer(pointsLayerRef.value)
  }
})
</script>

<style scoped>
.bend-editor-container {
  display: flex;
  justify-content: center;
  padding: 8px;
  overflow-x: auto;
}
</style>
