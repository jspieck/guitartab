<template>
  <div
    v-if="isActive"
    class="classical-notation-layer"
    :style="layerStyle"
  >
    <div
      v-for="row in tabRows"
      :key="`vexflow-row-${row.id}`"
      :ref="(element: Element | null) => registerClassicalRowSurface(row.id, element)"
      class="vexFlowRow"
      :style="getRowStyle(row)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, type CSSProperties } from 'vue'
import type { RenderedTabRow } from '../../types/tab'
import { TAB_SHEET } from '../../utils/tabSheetConstants'
import { getClassicalNotationTop } from '../../services/editor/tabLayoutMetrics'
import {
  classicalNotationLayoutState,
  getClassicalRowMarginTop,
} from '../../stores/classicalNotationLayoutState'
import {
  clearClassicalRowSurfaces,
  registerClassicalRowSurface,
} from '../../stores/classicalNotationSurfaceState'

const CLASSICAL_ROW_GAP = 8

interface Props {
  isActive: boolean
  trackId: number
  tabRows: RenderedTabRow[]
  paddingLeft: number
  paddingTop: number
  tabGroupWidth: number
}

const props = defineProps<Props>()

const layerStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  top: '0',
  left: '0',
  width: `${props.tabGroupWidth + props.paddingLeft * 2}px`,
  pointerEvents: 'none',
  overflow: 'visible',
}))

function getRowStyle(row: RenderedTabRow): CSSProperties {
  void classicalNotationLayoutState.version
  const marginTop = getClassicalRowMarginTop(row.id)
  const tabContentBottom = getClassicalNotationTop(props.trackId)
  const vexflowTop = props.paddingTop
    + row.yOffset
    + tabContentBottom
    + CLASSICAL_ROW_GAP
    - marginTop

  return {
    position: 'absolute',
    top: `${vexflowTop}px`,
    left: `${props.paddingLeft}px`,
    width: `${props.tabGroupWidth}px`,
    minHeight: `${TAB_SHEET.VEXFLOW_HEIGHT}px`,
    overflow: 'visible',
  }
}

onUnmounted(() => {
  clearClassicalRowSurfaces()
})
</script>
