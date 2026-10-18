<template>
    <div class="vf" :style="{ height: `${height}px` }">
        <div
            ref="trackRef"
            class="vf-track"
            role="slider"
            tabindex="0"
            :aria-label="ariaLabel"
            aria-valuemin="0"
            aria-valuemax="1"
            :aria-valuenow="position.toFixed(3)"
            :aria-valuetext="`${formatGainDb(modelValue)} dB`"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @dblclick="emit('update:modelValue', defaultValue)"
            @keydown="onKeyDown"
            @wheel.prevent="nudge($event.deltaY < 0 ? 0.01 : -0.01)">
            <div class="vf-groove"></div>
            <div class="vf-unity" :style="{ bottom: `calc(${unityPosition} * (100% - ${CAP_HEIGHT}px) + ${CAP_HEIGHT / 2}px)` }"></div>
            <div class="vf-cap" :style="{ bottom: `calc(${position} * (100% - ${CAP_HEIGHT}px))` }"></div>
        </div>
        <div class="vf-scale" aria-hidden="true">
            <span v-for="tick in TICKS" :key="tick" :style="{ bottom: `${gainToFaderPosition(10 ** (tick / 20)) * 100}%` }">
                {{ tick > 0 ? `+${tick}` : tick }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { faderPositionToGain, formatGainDb, gainToFaderPosition } from '../../services/drumMixer'

/** Channel fader with a dB taper. `modelValue` is linear gain. */
const props = withDefaults(defineProps<{
    modelValue: number
    defaultValue?: number
    height?: number
    ariaLabel?: string
}>(), {
    defaultValue: 1,
    height: 140,
    ariaLabel: 'Volume',
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const TICKS = [12, 6, 0, -12, -24, -48]
const CAP_HEIGHT = 22

const trackRef = ref<HTMLElement | null>(null)
const position = computed(() => gainToFaderPosition(props.modelValue))
const unityPosition = gainToFaderPosition(1)
let dragging = false
let grabOffset = 0

function positionFromPointer(clientY: number): number {
    const rect = trackRef.value!.getBoundingClientRect()
    const usable = rect.height - CAP_HEIGHT
    return 1 - (clientY - rect.top - CAP_HEIGHT / 2 - grabOffset) / usable
}

function commit(next: number) {
    emit('update:modelValue', faderPositionToGain(Math.min(1, Math.max(0, next))))
}

function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    const track = event.currentTarget as HTMLElement
    track.setPointerCapture(event.pointerId)
    track.focus()
    dragging = true
    // Grabbing the cap keeps it under the pointer; clicking the groove jumps there.
    const onCap = (event.target as HTMLElement).classList.contains('vf-cap')
    grabOffset = 0
    if (onCap) {
        const rect = track.getBoundingClientRect()
        const capCenter = rect.top + CAP_HEIGHT / 2 + (1 - position.value) * (rect.height - CAP_HEIGHT)
        grabOffset = event.clientY - capCenter
    } else {
        commit(positionFromPointer(event.clientY))
    }
    event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
    if (dragging) commit(positionFromPointer(event.clientY))
}

function onPointerUp(event: PointerEvent) {
    if (!dragging) return
    dragging = false
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}

function nudge(delta: number) {
    commit(position.value + delta)
}

function onKeyDown(event: KeyboardEvent) {
    const fine = event.shiftKey ? 0.005 : 0.02
    const steps: Record<string, number> = { ArrowUp: fine, ArrowRight: fine, ArrowDown: -fine, ArrowLeft: -fine, PageUp: 0.1, PageDown: -0.1 }
    if (event.key in steps) nudge(steps[event.key])
    else if (event.key === 'Home') commit(0)
    else if (event.key === 'End') commit(1)
    else return
    event.preventDefault()
    event.stopPropagation()
}
</script>

<style scoped>
.vf {
    position: relative;
    display: flex;
    gap: 3px;
}

.vf-track {
    position: relative;
    width: 24px;
    height: 100%;
    cursor: ns-resize;
    touch-action: none;
    border-radius: 4px;
    outline: none;
}
.vf-track:focus-visible {
    box-shadow: 0 0 0 2px var(--ap-accent);
}

.vf-groove {
    position: absolute;
    top: 11px;
    bottom: 11px;
    left: 50%;
    width: 4px;
    transform: translateX(-50%);
    border-radius: 2px;
    background: var(--ap-inset);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.vf-unity {
    position: absolute;
    left: 3px;
    right: 3px;
    height: 1px;
    background: var(--ap-border-strong);
}

.vf-cap {
    position: absolute;
    left: 1px;
    right: 1px;
    height: 22px;
    border-radius: 4px;
    background: linear-gradient(to bottom, #4a5262 0%, #353c49 45%, #2a303b 55%, #3b4250 100%);
    border: 1px solid #555e6e;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    cursor: grab;
}
.vf-cap::after {
    content: '';
    position: absolute;
    left: 4px;
    right: 4px;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    background: var(--ap-text);
    border-radius: 1px;
}
.vf-track:active .vf-cap {
    cursor: grabbing;
}

.vf-scale {
    position: relative;
    width: 18px;
    margin: 11px 0;
}
.vf-scale span {
    position: absolute;
    left: 0;
    transform: translateY(50%);
    color: var(--ap-faint);
    font-size: 8.5px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}
</style>
