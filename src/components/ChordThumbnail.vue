<script setup lang="ts">
/**
 * Declarative chord-diagram thumbnail (replaces createElementNS drawing in Chord Manager).
 */
import { computed } from 'vue'
import type { Chord } from '../types/tab'
import {
  CHORD_THUMB_HOSTEPS,
  CHORD_THUMB_STRINGS,
  buildChordThumbnailMarkers,
  getChordThumbnailSize,
} from '../services/editor/chordThumbnailLayout'

const props = withDefaults(defineProps<{
  chord: Chord
  showName?: boolean
}>(), {
  showName: false,
})

const { width, height } = getChordThumbnailSize()

const capoLabel = computed(() => (
  props.chord.capo > 1 ? props.chord.capo - 1 : props.chord.capo
))

const fretLines = computed(() => (
  Array.from({ length: CHORD_THUMB_HOSTEPS - 1 }, (_, i) => (i + 1) * height / CHORD_THUMB_HOSTEPS)
))

const stringXs = computed(() => (
  Array.from({ length: CHORD_THUMB_STRINGS }, (_, i) => (i * width) / (CHORD_THUMB_STRINGS - 1))
))

const markers = computed(() => buildChordThumbnailMarkers(props.chord))
</script>

<template>
  <g class="chord-thumbnail" transform="translate(12, 22) scale(0.95)">
    <rect
      :width="width"
      :height="height"
      stroke="#111"
      stroke-width="1"
      fill="white"
    />
    <path
      :d="`M-0.5 0H${width + 0.5}`"
      stroke="rgb(0, 0, 0)"
      stroke-width="3"
      fill="none"
    />
    <path
      v-for="(y, i) in fretLines"
      :key="`fret-${i}`"
      :d="`M0 ${y}H${width}`"
      stroke="rgb(180, 180, 180)"
      stroke-width="1"
      fill="none"
      class="gridLine"
    />
    <path
      v-for="(x, i) in stringXs"
      :key="`string-${i}`"
      :d="`M${x} 1.5V${height - 0.5}`"
      stroke="rgb(60, 60, 60)"
      stroke-width="1"
      fill="none"
      class="strongGridLine"
    />
    <text
      x="-14"
      y="10"
      font-family="Source Sans Pro"
      font-size="12px"
    >{{ capoLabel }}</text>
    <rect
      v-if="chord.capo > 1"
      x="-3"
      y="5"
      :width="width + 6"
      height="5"
      fill="#000"
      stroke="#000"
      stroke-width="0"
      rx="3"
      ry="3"
    />
    <text
      v-if="showName"
      :x="width / 2"
      y="-18"
      font-family="Source Sans Pro"
      font-size="14px"
      text-anchor="middle"
    >{{ chord.name }}</text>

    <template v-for="(marker, index) in markers" :key="`m-${index}`">
      <path
        v-if="marker.kind === 'cross'"
        :d="`M${marker.x - 3} -13L${marker.x + 3} -5M${marker.x + 3} -13L${marker.x - 3} -5`"
        stroke="#333"
        stroke-width="1"
        fill="none"
        class="chordCross"
      />
      <circle
        v-else-if="marker.kind === 'open'"
        :cx="marker.x"
        cy="-9"
        r="4"
        stroke="#333333"
        stroke-width="1"
        fill="white"
      />
      <g v-else>
        <circle
          :cx="marker.x"
          :cy="marker.y"
          r="4"
          stroke="none"
          fill="black"
        />
        <text
          v-if="marker.finger"
          :x="marker.x - 3"
          :y="marker.y + 4"
          fill="#fff"
          font-family="Source Sans Pro"
          font-size="10px"
        >{{ marker.finger }}</text>
      </g>
    </template>
  </g>
</template>
