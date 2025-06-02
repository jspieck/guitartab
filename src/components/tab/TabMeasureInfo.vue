<template>
  <g class="tab-measure-info" :transform="`translate(${xOffset}, ${yOffset})`">
    <!-- Time signature -->
    <g v-if="showTimeMeter" class="time-signature">
      <text
        x="0"
        y="-10"
        font-family="Source Sans Pro"
        font-size="20px"
        font-weight="bold"
        fill="#000"
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
        fill="#000"
        text-anchor="middle"
        class="time-denominator"
      >
        {{ timeMeter.denominator }}
      </text>
    </g>
    
    <!-- BPM marking -->
    <g v-if="showBpm" class="bpm-marking">
      <text
        x="30"
        y="0"
        font-family="Source Sans Pro"
        font-size="14px"
        fill="#000"
        text-anchor="start"
        class="bpm-text"
      >
        ♩ = {{ bpm }}
      </text>
    </g>
    
    <!-- Repeat start -->
    <g v-if="measureMeta.repeatOpen" class="repeat-start">
      <line x1="-5" x2="-5" y1="-20" y2="20" stroke="#000" stroke-width="3"/>
      <line x1="-2" x2="-2" y1="-20" y2="20" stroke="#000" stroke-width="1"/>
      <circle cx="2" cy="-8" r="2" fill="#000"/>
      <circle cx="2" cy="8" r="2" fill="#000"/>
    </g>
    
    <!-- Repeat end -->
    <g v-if="measureMeta.repeatClosePresent" class="repeat-end">
      <line x1="5" x2="5" y1="-20" y2="20" stroke="#000" stroke-width="3"/>
      <line x1="2" x2="2" y1="-20" y2="20" stroke="#000" stroke-width="1"/>
      <circle cx="-2" cy="-8" r="2" fill="#000"/>
      <circle cx="-2" cy="8" r="2" fill="#000"/>
      <text x="10" y="5" font-family="Source Sans Pro" font-size="12px" fill="#000">
        {{ measureMeta.repeatClose }}x
      </text>
    </g>
    
    <!-- Alternative endings -->
    <g v-if="measureMeta.repeatAlternativePresent" class="alternative-ending">
      <path
        d="M-10,-25 L-10,-30 L30,-30 L30,-25"
        stroke="#000"
        stroke-width="1"
        fill="none"
      />
      <text
        x="-5"
        y="-32"
        font-family="Source Sans Pro"
        font-size="12px"
        fill="#000"
        class="alternative-number"
      >
        {{ measureMeta.repeatAlternative }}.
      </text>
    </g>
    
    <!-- Marker -->
    <g v-if="measureMeta.markerPresent" class="marker">
      <rect
        x="-15"
        y="-40"
        width="30"
        height="15"
        :fill="`rgb(${measureMeta.marker.color.red}, ${measureMeta.marker.color.green}, ${measureMeta.marker.color.blue})`"
        stroke="#000"
        stroke-width="1"
        rx="2"
      />
      <text
        x="0"
        y="-30"
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

// Props
interface Props {
  measureMeta: any // MeasureMetaInfo from Song
  blockId: number
  xOffset: number
  yOffset: number
}

const props = defineProps<Props>()

// Computed properties
const timeMeter = computed(() => ({
  numerator: props.measureMeta?.numerator || 4,
  denominator: props.measureMeta?.denominator || 4
}))

const bpm = computed(() => props.measureMeta?.bpm || 120)

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
}
</style> 