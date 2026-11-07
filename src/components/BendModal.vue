<template>
  <BaseModal :modal-id="DIALOGS.BEND.id">
    <template #title>Bend</template>
    <div class="modal-stack">
      <div class="bend-editor-container modal-surface-block">
        <svg
          id="bendEditor"
          class="graph-editor"
          :viewBox="`0 0 ${editorWidth} ${editorHeight}`"
          :width="editorWidth"
          :height="editorHeight"
          @pointerdown="onPointerDown"
        >
          <g class="bend-grid" pointer-events="none">
            <rect
              :x="paddingLeft"
              :y="paddingTop"
              :width="gridWidth"
              :height="gridHeight"
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
              stroke-width="1"
              fill="none"
              :class="line.className"
            />
            <path
              v-for="line in horizontalLines"
              :key="line.key"
              :d="line.d"
              stroke-width="1"
              fill="none"
              :stroke-dasharray="line.dash"
              :class="line.className"
            />
          </g>
          <g class="bend-points">
            <path
              v-for="(line, index) in connections"
              :key="`l-${index}`"
              class="pointConnectionLine"
              :d="line"
              style="stroke: var(--editor-point); stroke-width: 2; fill: none"
            />
            <circle
              v-for="point in points"
              :key="point.column"
              :cx="point.x"
              :cy="point.y"
              r="7"
              style="fill: var(--editor-point); stroke: none"
            />
          </g>
        </svg>
      </div>
      <div class="modal-field">
        <label for="bendSelection">Preset</label>
        <div class="select">
          <select
            id="bendSelection"
            :value="handler.editor.preset"
            @change="handler.applyPreset(Number(($event.target as HTMLSelectElement).value))"
          >
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
        <SubmitButton button-id="selectButton" @submit-info="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import {
  BEND_COLUMNS,
  BEND_EDITOR_HEIGHT,
  BEND_EDITOR_WIDTH,
  BEND_PADDING_LEFT,
  BEND_PADDING_TOP,
  BEND_ROWS,
  type BendModalHandler,
} from '../services/dialogs/bendModalHandler'
import { svgPointFromEvent } from '../utils/svgPoint'

const handler = getDialogHandler<BendModalHandler>(DIALOGS.BEND.id)

const paddingTop = BEND_PADDING_TOP
const paddingLeft = BEND_PADDING_LEFT
const editorWidth = BEND_EDITOR_WIDTH
const editorHeight = BEND_EDITOR_HEIGHT
const horizontalSteps = BEND_COLUMNS
const verticalSteps = BEND_ROWS
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
      dash: strong ? undefined : '5, 5',
      className: strong ? 'strongGridLine' : 'gridLine',
    })
  }
  return lines
})

const columnWidth = gridWidth / horizontalSteps
const rowHeight = gridHeight / verticalSteps

const points = computed(() =>
  handler.editor.points.flatMap((rowsUp, column) =>
    rowsUp == null
      ? []
      : [{ column, x: paddingLeft + column * columnWidth, y: paddingTop + (verticalSteps - rowsUp) * rowHeight }],
  ),
)

const connections = computed(() =>
  points.value.slice(1).map((point, index) => {
    const previous = points.value[index]
    return `M${previous.x} ${previous.y}L${point.x} ${point.y}`
  }),
)

// Pointer events, so a finger works like the mouse; positions in viewBox units, as the
// editor scales down to fit a phone.
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const point = svgPointFromEvent(event.currentTarget as SVGSVGElement, event, editorWidth, editorHeight)
  const x = Math.min(Math.max(point.x - paddingLeft, 0), gridWidth)
  const y = Math.min(Math.max(point.y - paddingTop, 0), gridHeight)
  handler.togglePoint(Math.round(x / columnWidth), verticalSteps - Math.round(y / rowHeight))
}
</script>

<style scoped>
.bend-editor-container {
  display: flex;
  justify-content: center;
  padding: 8px;
}

/* Scales down to the dialog's width on a phone; a finger places points instead of scrolling. */
.graph-editor {
  width: 100%;
  max-width: 501px;
  height: auto;
  touch-action: none;
}
</style>
