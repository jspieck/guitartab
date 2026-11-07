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
    <g v-if="annotations && showBpm && tempoLane" class="bpm-marking" :transform="`translate(${bpmX}, ${tempoLane.top + tempoLane.height - 4})`">
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
    <g v-if="annotations && measureMeta.repeatAlternative != null && voltaLane" class="alternative-ending">
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
    <g v-if="annotations && measureMeta.marker != null && markerLane" class="marker">
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

    <!-- Segno / coda / Fine at the measure start, D.C. / D.S. / To Coda at its end -->
    <g v-if="annotations && directionLane && (targetSigns.length > 0 || jumpLabels.length > 0)" class="directions">
      <g
        v-for="(sign, index) in targetSigns"
        :key="`target-${index}`"
        :transform="`translate(${sign.x}, ${directionLane.top + directionLane.height - 5})`"
        :class="`direction-target direction-${sign.kind}`"
      >
        <template v-if="sign.kind === 'segno'">
          <text x="0" y="0" font-family="Source Sans Pro" font-size="16px" font-style="italic" font-weight="bold" class="direction-glyph">S</text>
          <line x1="-1" y1="1" x2="10" y2="-12" stroke-width="1.2" class="direction-line"/>
          <circle cx="1" cy="-8" r="1.3" class="direction-dot"/>
          <circle cx="8" cy="-3" r="1.3" class="direction-dot"/>
        </template>
        <template v-else-if="sign.kind === 'coda'">
          <circle cx="5" cy="-5" r="4" stroke-width="1.2" fill="none" class="direction-line"/>
          <line x1="5" y1="-11" x2="5" y2="1" stroke-width="1.2" class="direction-line"/>
          <line x1="-1" y1="-5" x2="11" y2="-5" stroke-width="1.2" class="direction-line"/>
        </template>
        <text v-else x="0" y="0" font-family="Source Sans Pro" font-size="12px" font-style="italic" font-weight="bold" class="direction-text">Fine</text>
      </g>
      <text
        v-if="jumpLabels.length > 0"
        :x="width - 4"
        :y="directionLane.top + directionLane.height - 5"
        font-family="Source Sans Pro"
        font-size="12px"
        font-style="italic"
        font-weight="bold"
        text-anchor="end"
        class="direction-text direction-jump"
      >
        {{ jumpLabels.join(' · ') }}
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TabMeasureMetaData } from '../../types/tab'
import { DIRECTION_LABELS } from '../../utils/directions'
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
  /** Tempo, marker, volta and signs; in the score view only on a system's top staff. */
  annotations?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 10,
  lanes: undefined,
  annotations: true,
})

const stringsBottom = computed(() => (props.numStrings - 1) * props.stringSpacing)
const stringsMiddle = computed(() => stringsBottom.value / 2)

function laneOr(lane: AboveLaneId): LaneBox {
  return props.lanes?.above[lane] ?? { top: -MEASURE_NUMBER_STRIP - LANE_HEIGHTS[lane], height: LANE_HEIGHTS[lane] }
}

const tempoLane = computed(() => laneOr('tempo'))
const markerLane = computed(() => laneOr('marker'))
const voltaLane = computed(() => laneOr('volta'))
const directionLane = computed(() => laneOr('direction'))

/** Segno and coda signs drawn side by side (a double sign twice), then Fine. */
const targetSigns = computed(() => {
  const signs: { kind: 'segno' | 'coda' | 'fine'; x: number }[] = []
  let x = props.measureMeta.repeatOpen ? 14 : 4
  for (const target of props.measureMeta.directionTargets ?? []) {
    const kind = target.startsWith('Segno') ? 'segno' : target.endsWith('Coda') ? 'coda' : 'fine'
    const count = target === 'SegnoSegno' || target === 'DoubleCoda' ? 2 : 1
    for (let i = 0; i < count; i += 1) {
      signs.push({ kind, x })
      x += kind === 'fine' ? 28 : 14
    }
  }
  return signs
})

const jumpLabels = computed(() => (props.measureMeta.directionJumps ?? []).map((jump) => DIRECTION_LABELS[jump]))
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

.direction-glyph,
.direction-text,
.direction-dot {
  fill: var(--tab-primary);
}

.direction-line {
  stroke: var(--tab-primary);
}
</style> 