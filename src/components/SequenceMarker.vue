<template>
    <svg :style="markerStyle">
        <rect :x="0" :y="0" :width="markerWidth" :height="height"
              fill="#adadad" stroke-width="1" stroke="rgba(62, 173, 255, 0.19)" />
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    blockStart: number;
    blockEnd: number;
    height: number;
}>();

const span = computed(() => 30 * (props.blockEnd - props.blockStart + 1));
const markerWidth = computed(() => span.value);
const markerStyle = computed(() => ({
    position: 'absolute',
    left: `${props.blockStart * 30}px`,
    width: `${span.value}px`,
    top: '0px',
    height: `${props.height}px`,
    pointerEvents: 'none',
}));
</script>