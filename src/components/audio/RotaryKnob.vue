<template>
    <div class="rk" :class="{ 'rk-disabled': disabled, 'rk-dragging': dragging }" :style="{ '--rk-color': color }">
        <span v-if="label" class="rk-label" :id="labelId">{{ label }}</span>
        <svg
            class="rk-dial"
            :width="size"
            :height="size"
            :viewBox="`0 0 ${VIEW} ${VIEW}`"
            role="slider"
            :tabindex="disabled ? -1 : 0"
            :aria-labelledby="label ? labelId : undefined"
            :aria-label="label ? undefined : ariaLabel"
            :aria-valuemin="min"
            :aria-valuemax="max"
            :aria-valuenow="modelValue"
            :aria-valuetext="displayText"
            :aria-disabled="disabled || undefined"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @dblclick="reset"
            @keydown="onKeyDown"
            @wheel="onWheel">
            <title>{{ (label || ariaLabel) + ': ' + displayText }} (double-click to reset)</title>
            <path class="rk-track" :d="trackPath" />
            <path v-if="valuePath" class="rk-value" :d="valuePath" />
            <circle class="rk-body" :cx="C" :cy="C" :r="BODY_R" />
            <line class="rk-pointer" :x1="pointerStart.x" :y1="pointerStart.y" :x2="pointerEnd.x" :y2="pointerEnd.y" />
        </svg>
        <span v-if="showValue" class="rk-readout">{{ displayText }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

/**
 * Rotary control with a 270° sweep. Drag vertically (Shift for fine), scroll,
 * use the arrow/Page/Home/End keys, or double-click to return to `defaultValue`.
 * `scale: 'log'` is for frequency/time controls whose useful range spans decades.
 */
const props = withDefaults(defineProps<{
    modelValue: number
    min: number
    max: number
    defaultValue?: number
    scale?: 'linear' | 'log'
    bipolar?: boolean
    label?: string
    ariaLabel?: string
    format?: (value: number) => string
    size?: number
    color?: string
    disabled?: boolean
    showValue?: boolean
}>(), {
    defaultValue: undefined,
    scale: 'linear',
    bipolar: false,
    label: '',
    ariaLabel: 'Value',
    format: undefined,
    size: 46,
    color: 'var(--ap-accent, #5aa2ff)',
    disabled: false,
    showValue: true,
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const VIEW = 48
const C = VIEW / 2
const ARC_R = 20
const BODY_R = 14.5
const SWEEP = 270
const START_ANGLE = 135 // degrees, clockwise from +x (SVG coordinates): bottom-left
const DRAG_PIXELS_FOR_FULL_RANGE = 180

const labelId = `rk-label-${useId()}`

const dragging = ref(false)
let dragStartY = 0
let dragStartPosition = 0

function toPosition(value: number): number {
    const clamped = Math.min(props.max, Math.max(props.min, value))
    if (props.scale === 'log') {
        return Math.log(clamped / props.min) / Math.log(props.max / props.min)
    }
    return (clamped - props.min) / (props.max - props.min)
}

function fromPosition(position: number): number {
    const p = Math.min(1, Math.max(0, position))
    if (props.scale === 'log') {
        return props.min * (props.max / props.min) ** p
    }
    return props.min + p * (props.max - props.min)
}

function polar(angleDeg: number, radius: number) {
    const a = (angleDeg * Math.PI) / 180
    return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) }
}

function arc(fromDeg: number, toDeg: number): string {
    const start = polar(fromDeg, ARC_R)
    const end = polar(toDeg, ARC_R)
    const largeArc = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${ARC_R} ${ARC_R} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

const position = computed(() => toPosition(props.modelValue))
const angle = computed(() => START_ANGLE + position.value * SWEEP)
const trackPath = arc(START_ANGLE, START_ANGLE + SWEEP)

const valuePath = computed(() => {
    const origin = props.bipolar ? START_ANGLE + SWEEP / 2 : START_ANGLE
    const from = Math.min(origin, angle.value)
    const to = Math.max(origin, angle.value)
    return to - from < 0.5 ? '' : arc(from, to)
})

const pointerStart = computed(() => polar(angle.value, 5))
const pointerEnd = computed(() => polar(angle.value, BODY_R - 2))

const displayText = computed(() => (props.format ? props.format(props.modelValue) : props.modelValue.toFixed(1)))

function commitPosition(next: number) {
    const value = fromPosition(next)
    if (value !== props.modelValue) {
        emit('update:modelValue', value)
    }
}

function onPointerDown(event: PointerEvent) {
    if (props.disabled || event.button !== 0) return
    const target = event.currentTarget as SVGElement
    target.setPointerCapture(event.pointerId)
    target.focus()
    dragging.value = true
    dragStartY = event.clientY
    dragStartPosition = position.value
    event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
    if (!dragging.value) return
    const sensitivity = event.shiftKey ? 0.2 : 1
    const delta = ((dragStartY - event.clientY) / DRAG_PIXELS_FOR_FULL_RANGE) * sensitivity
    commitPosition(dragStartPosition + delta)
    // Re-anchor so toggling Shift mid-drag doesn't make the value jump.
    dragStartY = event.clientY
    dragStartPosition = Math.min(1, Math.max(0, dragStartPosition + delta))
}

function onPointerUp(event: PointerEvent) {
    if (!dragging.value) return
    dragging.value = false
    ;(event.currentTarget as SVGElement).releasePointerCapture(event.pointerId)
}

function onWheel(event: WheelEvent) {
    if (props.disabled) return
    event.preventDefault()
    const step = event.shiftKey ? 0.002 : 0.01
    commitPosition(position.value + (event.deltaY < 0 ? step : -step))
}

function onKeyDown(event: KeyboardEvent) {
    if (props.disabled) return
    const fine = event.shiftKey ? 0.002 : 0.01
    const steps: Record<string, number> = {
        ArrowUp: fine, ArrowRight: fine, ArrowDown: -fine, ArrowLeft: -fine,
        PageUp: 0.1, PageDown: -0.1,
    }
    if (event.key in steps) {
        commitPosition(position.value + steps[event.key])
    } else if (event.key === 'Home') {
        commitPosition(0)
    } else if (event.key === 'End') {
        commitPosition(1)
    } else {
        return
    }
    event.preventDefault()
    event.stopPropagation()
}

function reset() {
    if (props.disabled || props.defaultValue === undefined) return
    emit('update:modelValue', props.defaultValue)
}
</script>

<style scoped>
.rk {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    user-select: none;
}
.rk-label {
    color: var(--ap-muted, #8a93a3);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
}
.rk-dial {
    display: block;
    cursor: ns-resize;
    touch-action: none;
    border-radius: 50%;
    outline: none;
}
.rk-dial:focus-visible {
    box-shadow: 0 0 0 2px var(--rk-color);
}
.rk-track {
    fill: none;
    stroke: var(--ap-knob-track, #2b313c);
    stroke-width: 3.5;
    stroke-linecap: round;
}
.rk-value {
    fill: none;
    stroke: var(--rk-color);
    stroke-width: 3.5;
    stroke-linecap: round;
}
.rk-body {
    fill: var(--ap-knob-body, #262c37);
    stroke: var(--ap-knob-edge, #3c4452);
    stroke-width: 1;
    filter: drop-shadow(0 1.5px 1.5px rgba(0, 0, 0, 0.45));
}
.rk-pointer {
    stroke: var(--ap-knob-pointer, var(--ap-text, #e7eaf0));
    stroke-width: 2.2;
    stroke-linecap: round;
}
.rk-dial:hover .rk-body,
.rk-dragging .rk-body {
    stroke: var(--rk-color);
}
.rk-readout {
    color: var(--ap-text, #e7eaf0);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.rk-disabled {
    opacity: 0.38;
}
.rk-disabled .rk-dial {
    cursor: not-allowed;
}
</style>
