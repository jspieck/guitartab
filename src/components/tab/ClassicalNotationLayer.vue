<template>
  <div
    v-if="isActive"
    class="classical-notation-layer"
    :style="layerStyle"
  >
    <ClassicalRowSurface
      v-for="row in tabRows"
      :key="`vexflow-row-${row.id}`"
      :track-id="trackId"
      :voice-id="voiceId"
      :row="row"
      :row-style="getRowStyle(row)"
      :area-height="getAreaHeight(row)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, type CSSProperties } from 'vue'
import ClassicalRowSurface from './ClassicalRowSurface.vue'
import type { RenderedTabRow } from '../../types/tab'
import {
  CLASSICAL_CLEF_GUTTER,
  getClassicalAreaTop,
} from '../../services/editor/tabLayoutMetrics'
import { getClassicalRowGeometry } from '../../stores/classicalNotationLayoutState'
import { clearClassicalRowSurfaces } from '../../stores/classicalNotationSurfaceState'

interface Props {
  isActive: boolean
  trackId: number
  voiceId: number
  /** Rows to draw staves for: the same (virtualized) rows the tab renders. */
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

function getAreaHeight(row: RenderedTabRow): number {
  return getClassicalRowGeometry(row.startBlockId, row.endBlockId + 1).height
}

function getRowStyle(row: RenderedTabRow): CSSProperties {
  // Same frame as the tab row group, shifted left by the clef gutter.
  return {
    position: 'absolute',
    top: `${props.paddingTop + row.yOffset + getClassicalAreaTop(row, props.trackId)}px`,
    left: `${props.paddingLeft - CLASSICAL_CLEF_GUTTER}px`,
    width: `${props.tabGroupWidth + CLASSICAL_CLEF_GUTTER}px`,
    height: `${getAreaHeight(row)}px`,
    overflow: 'visible',
  }
}

onUnmounted(() => {
  clearClassicalRowSurfaces()
})
</script>
