<template>
  <BaseModal :modal-id="DIALOGS.TREMOLO_BAR.id">
    <template #title>Tremolo bar</template>
    <div class="modal-stack">
      <div class="tremolo-editor-container modal-surface-block">
        <svg
          class="graph-editor"
          :viewBox="`${-labelRoom} 0 ${editorSize + labelRoom} ${editorSize}`"
          :width="editorSize + labelRoom"
          :height="editorSize"
          @pointerdown="handlePointerDown"
        >
          <!-- Static grid owned by Vue (no createElementNS) -->
          <g class="tremolo-grid" pointer-events="none">
            <rect
              :x="padding"
              :y="padding"
              :width="gridWidth"
              :height="gridHeight"
              stroke-width="1"
            />
            <text
              v-for="label in axisLabels"
              :key="label.text"
              :x="padding - 11"
              :y="label.y"
              text-anchor="end"
              dominant-baseline="middle"
              font-size="12"
            >{{ label.text }}</text>
            <line
              v-for="i in columnCount + 1"
              :key="`v-${i}`"
              :x1="padding + (gridWidth * (i - 1)) / columnCount"
              :y1="padding"
              :x2="padding + (gridWidth * (i - 1)) / columnCount"
              :y2="padding + gridHeight"
              stroke-width="1"
              class="gridLine"
            />
            <line
              v-for="i in rowCount + 1"
              :key="`h-${i}`"
              :x1="padding"
              :y1="padding + (gridHeight * (i - 1)) / rowCount"
              :x2="padding + gridWidth"
              :y2="padding + (gridHeight * (i - 1)) / rowCount"
              stroke-width="1"
              :class="i - 1 === rowCount / 3 ? 'strongGridLine' : 'gridLine'"
            />
          </g>
          <g class="tremolo-points">
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
      <GraphEditorHelp summary="Click the grid to add a point, click it again to remove it.">
        <li>Left to right is the length of the beat; up raises the pitch, down lowers it, in semitones (frets).</li>
        <li>Each column holds one point; the line joins them from left to right.</li>
        <li>Start below 0 for a pre-dive, end at 0 to return to the note.</li>
        <li>A preset replaces the curve with a common shape that you can then adjust.</li>
      </GraphEditorHelp>
      <div class="modal-field">
        <label for="tremoloSelection">Preset</label>
        <div class="select">
          <select
            id="tremoloSelection"
            :value="handler.editor.preset"
            @change="handler.applyPreset(Number(($event.target as HTMLSelectElement).value))"
          >
            <option value="0">Dive</option>
            <option value="1">Dip</option>
            <option value="2">Release up</option>
            <option value="3">Inverted dip</option>
            <option value="4">Return</option>
            <option value="5">Release down</option>
          </select>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="tremoloSelectButton" @submit-info="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GraphEditorHelp from './GraphEditorHelp.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import {
  TREMOLO_COLUMNS,
  TREMOLO_ROWS,
  type TremoloBarModalHandler,
} from '../services/dialogs/tremoloBarModalHandler'
import { svgPointFromEvent } from '../utils/svgPoint'

const handler = getDialogHandler<TremoloBarModalHandler>(DIALOGS.TREMOLO_BAR.id)

const padding = 20
const editorSize = 300
const columnCount = TREMOLO_COLUMNS
const rowCount = TREMOLO_ROWS
const gridWidth = editorSize - 2 * padding
const gridHeight = editorSize - 2 * padding
const columnWidth = gridWidth / columnCount
const rowHeight = gridHeight / rowCount

// Extra room left of the viewBox, so the axis labels end clear of the points in the first column.
const labelRoom = 14

// A row is a semitone (value 50, as bends); the handler stores rows 16 as 0, so +8 … -16.
const axisLabels = computed(() => [
  { text: '+8', y: padding },
  { text: '0', y: gridHeight / 3 + padding },
  { text: '-8', y: (2 * gridHeight) / 3 + padding },
  { text: '-16', y: gridHeight + padding },
])

const points = computed(() =>
  handler.editor.points.flatMap((rowsUp, column) =>
    rowsUp == null ? [] : [{ column, x: padding + column * columnWidth, y: padding + (rowCount - rowsUp) * rowHeight }],
  ),
)

const connections = computed(() =>
  points.value.slice(1).map((point, index) => {
    const previous = points.value[index]
    return `M${previous.x} ${previous.y}L${point.x} ${point.y}`
  }),
)

/** A click or tap on the editor; positions in viewBox units, as it scales down on a phone. */
function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const point = svgPointFromEvent(event.currentTarget as SVGSVGElement, event, editorSize + labelRoom, editorSize)
  const x = Math.min(Math.max(point.x - padding, 0), gridWidth)
  const y = Math.min(Math.max(point.y - padding, 0), gridHeight)
  handler.togglePoint(Math.round(x / columnWidth), rowCount - Math.round(y / rowHeight))
}
</script>

<style scoped>
.tremolo-editor-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
}

/* Scales down to the dialog's width on a phone; a finger places points instead of scrolling. */
.graph-editor {
  width: 100%;
  max-width: 314px;
  height: auto;
  aspect-ratio: 314 / 300;
  touch-action: none;
}
</style>
