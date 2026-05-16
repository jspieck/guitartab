<template>
  <g class="tab-measure-info" :transform="`translate(${xOffset}, ${yOffset})`">
    <!-- Time signature -->
    <g v-if="showTimeMeter" class="time-signature" :transform="`translate(${timeMeterX}, 0)`">
      <text
        x="0"
        y="-10"
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
        y="10"
        font-family="Source Sans Pro"
        font-size="20px"
        font-weight="bold"
        text-anchor="middle"
        class="time-denominator"
      >
        {{ timeMeter.denominator }}
      </text>
    </g>
    
    <!-- BPM marking -->
    <g v-if="showBpm" class="bpm-marking" :transform="`translate(${bpmX}, 0)`">
      <text
        x="0"
        :y="-yOffset - 45"
        font-family="Source Sans Pro"
        font-size="14px"
        text-anchor="middle"
        class="bpm-text"
      >
        ♩ = {{ bpm }}
      </text>
    </g>
    
    <!-- Repeat start -->
    <g v-if="measureMeta.repeatOpen" class="repeat-start">
      <line x1="-5" x2="-5" y1="-20" y2="20" class="repeat-bar-thick" stroke-width="3"/>
      <line x1="-2" x2="-2" y1="-20" y2="20" class="repeat-bar-thin" stroke-width="1"/>
      <circle cx="2" cy="-8" r="2" class="repeat-dot"/>
      <circle cx="2" cy="8" r="2" class="repeat-dot"/>
    </g>
    
    <!-- Repeat end -->
    <g v-if="measureMeta.repeatClosePresent" class="repeat-end">
      <line x1="5" x2="5" y1="-20" y2="20" class="repeat-bar-thick" stroke-width="3"/>
      <line x1="2" x2="2" y1="-20" y2="20" class="repeat-bar-thin" stroke-width="1"/>
      <circle cx="-2" cy="-8" r="2" class="repeat-dot"/>
      <circle cx="-2" cy="8" r="2" class="repeat-dot"/>
      <text x="10" y="5" font-family="Source Sans Pro" font-size="12px" class="repeat-count-text">
        {{ measureMeta.repeatClose }}x
      </text>
    </g>
    
    <!-- Alternative endings -->
    <g v-if="measureMeta.repeatAlternativePresent" class="alternative-ending">
      <path
        d="M-10,-25 L-10,-30 L30,-30 L30,-25"
        class="alternative-bracket"
        stroke-width="1"
        fill="none"
      />
      <text
        x="-5"
        y="-32"
        font-family="Source Sans Pro"
        font-size="12px"
        class="alternative-number"
      >
        {{ measureMeta.repeatAlternative }}.
      </text>
    </g>
    
    <!-- Marker -->
    <g v-if="measureMeta.markerPresent" class="marker">
      <rect
        x="-15"
        :y="-yOffset - 25"
        width="30"
        height="15"
        :fill="`rgb(${measureMeta.marker.color.red}, ${measureMeta.marker.color.green}, ${measureMeta.marker.color.blue})`"
        stroke-width="1"
        class="marker-border"
        rx="2"
      />
      <text
        x="0"
        :y="-yOffset - 14"
        font-family="Source Sans Pro"
        font-size="10px"
        fill="#fff"
        text-anchor="middle"
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

const fallbackMeasureMeta: TabMeasureMetaData = {
  numerator: 4,
  denominator: 4,
  timeMeterPresent: false,
  bpmPresent: false,
  bpm: 120,
  repeatOpen: false,
  repeatClosePresent: false,
  repeatClose: 0,
  repeatAlternativePresent: false,
  repeatAlternative: 0,
  markerPresent: false,
  marker: { text: '', color: { red: 0, green: 0, blue: 0 } },
  keySignature: 0,
  automations: [],
}

// Props
interface Props {
  measureMeta: TabMeasureMetaData
  blockId: number
  xOffset: number
  yOffset: number
  contentPadding?: number
}

const props = withDefaults(defineProps<Props>(), {
  contentPadding: 10
})

// Computed properties
const timeMeter = computed(() => ({
  numerator: props.measureMeta?.numerator || fallbackMeasureMeta.numerator,
  denominator: props.measureMeta?.denominator || fallbackMeasureMeta.denominator
}))

const timeMeterX = computed(() => {
  // Place after a small margin inside the content padding area
  return 8
})

const bpmX = computed(() => {
  // BPM is usually centered over the measure or at the start
  return props.contentPadding || 10
})

const bpm = computed(() => props.measureMeta?.bpm || fallbackMeasureMeta.bpm)

const showTimeMeter = computed(() => {
  return props.measureMeta?.timeMeterPresent === true
})

const showBpm = computed(() => {
  return props.measureMeta?.bpmPresent === true
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