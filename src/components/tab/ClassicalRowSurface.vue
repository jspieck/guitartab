<template>
  <div ref="surface" class="vexFlowRow" :style="rowStyle" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import type { RenderedTabRow } from '../../types/tab'
import { classicalNotation } from '../../services/notation/classicalNotationAdapter'
import {
  registerClassicalRowSurface,
  unregisterClassicalRowSurface,
} from '../../stores/classicalNotationSurfaceState'

interface Props {
  trackId: number
  voiceId: number
  row: RenderedTabRow
  rowStyle: CSSProperties
  areaHeight: number
}

const props = defineProps<Props>()
const surface = ref<HTMLElement | null>(null)

function requestDraw(): void {
  classicalNotation.requestRowDraw(props.trackId, props.voiceId, props.row.id)
}

onMounted(() => {
  registerClassicalRowSurface(props.row.id, surface.value)
  requestDraw()
})

// A new row object means the layout was recomputed (edit, reflow, resize).
watch(() => [props.row, props.areaHeight], requestDraw)

onUnmounted(() => {
  if (surface.value) {
    unregisterClassicalRowSurface(props.row.id, surface.value)
  }
})
</script>
