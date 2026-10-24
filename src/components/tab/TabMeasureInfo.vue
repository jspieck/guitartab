<template>
  <!-- Row-local coordinates: y = 0 is the top string; annotations use the row's lanes. -->
  <g class="tab-measure-info" :transform="`translate(${xOffset}, 0)`">
    <!-- Time signature, centred on the strings -->
    <g v-if="showTimeMeter" class="time-signature" :transform="`translate(${timeMeterX}, ${stringsMiddle})`">
      <text
        x="0"
        y="-3"
        font-family="Source Sans Pro"
        font-size="20px"
        font-weight="bold"
        text-anchor="middle"
        class="time-numerator"
      >
        {{ timeMeter.numerator }}
      </text>
      <text
        x="0"
        y="15"
        font-family="Source Sans Pro"
        font-size="20px"
        font-weight="bold"
        text-anchor="middle"
        class="time-denominator"
      >
        {{ timeMeter.denominator }}
      </text>
    </g>

    <!-- Tempo -->
    <g v-if="showBpm && tempoLane" class="bpm-marking" :transform="`translate(${bpmX}, ${tempoLane.top + tempoLane.height - 4})`">
      <text
        x="0"
        y="0"
        font-family="Source Sans Pro"
        font-size="14px"
        class="bpm-text"
      >
        ♩ = {{ bpm }}
      </text>
    </g>

    <!-- Repeat start: thick + thin bar and dots at the measure's left edge -->
    <g v-if="measureMeta.repeatOpen" class="repeat-start">
      <line x1="1.5" x2="1.5" y1="0" :y2="stringsBottom" class="repeat-bar-thick" stroke-width="3"/>
      <line x1="5" x2="5" y1="0" :y2="stringsBottom" class="repeat-bar-thin" stroke-width="1"/>
      <circle cx="9" :cy="stringsMiddle - stringSpacing / 2" r="2" class="repeat-dot"/>
      <circle cx="9" :cy="stringsMiddle + stringSpacing / 2" r="2" class="repeat-dot"/>
    </g>

    <!-- Repeat end at the measure's right edge, repeat count above it -->
    <g v-if="measureMeta.repeatClose != null" class="repeat-end">
      <line :x1="width - 1.5" :x2="width - 1.5" y1="0" :y2="stringsBottom" class="repeat-bar-thick" stroke-width="3"/>
      <line :x1="width - 5" :x2="width - 5" y1="0" :y2="stringsBottom" class="repeat-bar-thin" stroke-width="1"/>
      <circle :cx="width - 9" :cy="stringsMiddle - stringSpacing / 2" r="2" class="repeat-dot"/>
      <circle :cx="width - 9" :cy="stringsMiddle + stringSpacing / 2" r="2" class="repeat-dot"/>
      <text
        :x="width - 2"
        y="-3"
        font-family="Source Sans Pro"
        font-size="11px"
        text-anchor="end"
        class="repeat-count-text"
      >
        {{ measureMeta.repeatClose }}x
      </text>
    </g>

    <!-- Alternative ending (volta) spanning the measure -->
    <g v-if="measureMeta.repeatAlternative != null && voltaLane" class="alternative-ending">
      <path
        :d="`M3,${voltaLane.top + voltaLane.height} L3,${voltaLane.top + 4} L${width - 4},${voltaLane.top + 4}`"
        class="alternative-bracket"
        stroke-width="1"
        fill="none"
      />
      <text
        x="7"
        :y="voltaLane.top + 16"
        font-family="Source Sans Pro"
        font-size="12px"
        class="alternative-number"
      >
        {{ measureMeta.repeatAlternative }}.
      </text>
    </g>

    <!-- Marker: left-aligned at the measure start, box sized to its text -->
    <g v-if="measureMeta.marker != null && markerLane" class="marker">
      <rect
        x="2"
        :y="markerLane.top + 2"
        :width="markerWidth"
        height="15"
        :fill="`rgb(${measureMeta.marker.color.red}, ${measureMeta.marker.color.green}, ${measureMeta.marker.color.blue})`"
        stroke-width="1"
        class="marker-border"
        rx="2"
      />
      <text
        x="7"
        :y="markerLane.top + 13"
        font-family="Source Sans Pro"
        font-size="10px"
        style="fill: var(--tab-on-marker)"
        class="marker-text"
      >
        {{ measureMeta.marker.text }}
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TabMeasureMetaData } from '../../types/tab'
import {
  estimateTextWidth,
  LANE_HEIGHTS,
  MEASURE_NUMBER_STRIP,
  type AboveLaneId,
  type LaneBox,
  type RowLanes,
} from '../../utils/tabRowLanes'

const fallbackMeasureMeta: TabMeasureMetaData = {
  numerator: 4,
  denominator: 4,
  timeMeterPresent: false,
  repeatOpen: false,
  keySignature: 0,
  automations: [],
}

// Props
interface Props {
  measureMeta: TabMeasureMetaData
  blockId: number
  xOffset: number
  width: number
  numStrings: number
  stringSpacing: number
  lanes?: RowLanes
  contentPadding?: number
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 10,
  lanes: undefined,
})

const stringsBottom = computed(() => (props.numStrings - 1) * props.stringSpacing)
const stringsMiddle = computed(() => stringsBottom.value / 2)

function laneOr(lane: AboveLaneId): LaneBox {
  return props.lanes?.above[lane] ?? { top: -MEASURE_NUMBER_STRIP - LANE_HEIGHTS[lane], height: LANE_HEIGHTS[lane] }
}

const tempoLane = computed(() => laneOr('tempo'))
const markerLane = computed(() => laneOr('marker'))
const voltaLane = computed(() => laneOr('volta'))
const markerWidth = computed(() => (
  Math.min(Math.max(30, estimateTextWidth(props.measureMeta.marker?.text ?? '', 6) + 10), props.width - 6)
))

// Computed properties
const timeMeter = computed(() => ({
  numerator: props.measureMeta?.numerator || fallbackMeasureMeta.numerator,
  denominator: props.measureMeta?.denominator || fallbackMeasureMeta.denominator
}))

// After the repeat-start bars and dots when the measure opens a repeat.
const timeMeterX = computed(() => (props.measureMeta?.repeatOpen ? 22 : 8))

const bpmX = computed(() => {
  // BPM is usually centered over the measure or at the start
  return props.contentPadding || 10
})

const bpm = computed(() => props.measureMeta?.bpm ?? 120)

const showTimeMeter = computed(() => {
  return props.measureMeta?.timeMeterPresent === true
})

const showBpm = computed(() => {
  return props.measureMeta?.bpm != null
})
</script>

<style scoped>
.tab-measure-info {
  /* SVG styles handled by attributes */
}

.time-signature {
  font-weight: bold;
}

.bpm-text {
  font-style: italic;
}

.marker-text {
  font-weight: bold;
  font-size: 10px;
}

.alternative-number {
  font-weight: bold;
  fill: var(--tab-primary);
}

.time-numerator,
.time-denominator {
  fill: var(--tab-primary);
}

.bpm-text {
  fill: var(--tab-primary);
}

.repeat-bar-thick,
.repeat-bar-thin {
  stroke: var(--tab-primary);
}

.repeat-dot {
  fill: var(--tab-primary);
}

.repeat-count-text {
  fill: var(--tab-primary);
}

.alternative-bracket {
  stroke: var(--tab-primary);
}

.marker-border {
  stroke: var(--tab-primary);
}
</style> 