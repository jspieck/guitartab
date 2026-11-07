<template>
    <BaseModal :modal-id="DIALOGS.EQUALIZER.id">
        <template #title>Master Equalizer</template>
        <div class="ap-root eq">
            <div class="ap-toolbar">
                <span class="ap-section-label">4-band parametric</span>
                <span class="eq-status" :class="{ 'eq-status-active': !isFlat }">{{ isFlat ? 'Flat' : 'Shaping' }}</span>
                <span class="ap-toolbar-spacer"></span>
                <span class="eq-hint">Drag points · scroll for Q · double-click to zero</span>
                <button type="button" class="ap-btn" @click="handler.resetBands()">Reset</button>
            </div>

            <div class="eq-graph ap-card" :style="{ width: `${handler.WIDTH}px`, height: `${handler.HEIGHT}px` }">
                <canvas ref="canvasRef" class="eq-canvas" :style="{ width: `${handler.WIDTH}px`, height: `${handler.HEIGHT}px` }"
                    aria-hidden="true"></canvas>
                <svg class="eq-overlay" :width="handler.PLOT_WIDTH" :height="handler.PLOT_HEIGHT"
                    @pointerdown.self="handler.selectedBand.value = -1">
                    <g v-for="(band, index) in bands" :key="index"
                        class="eq-handle"
                        :class="{ 'eq-handle-selected': selected === index, 'eq-handle-off': !band.enabled }"
                        :transform="`translate(${handlePos(index).x}, ${handlePos(index).y})`"
                        :style="{ '--band-color': EQ_BAND_COLORS[index] }"
                        @pointerdown="onHandleDown($event, index)"
                        @pointermove="onHandleMove($event, index)"
                        @pointerup="onHandleUp"
                        @pointercancel="onHandleUp"
                        @dblclick="handler.setBand(index, { gain: 0 })"
                        @wheel.prevent="onHandleWheel($event, index)">
                        <circle r="14" class="eq-handle-hit" />
                        <circle r="9" class="eq-handle-dot" />
                        <text y="3.5" text-anchor="middle">{{ index + 1 }}</text>
                    </g>
                </svg>
                <div v-if="selected !== -1" class="eq-readout ap-num" :style="{ '--band-color': EQ_BAND_COLORS[selected] }">
                    <span class="eq-readout-dot"></span>
                    {{ formatFrequency(bands[selected].frequency) }}
                    <template v-if="eqTypeUsesGain(bands[selected].type)"> · {{ formatGain(bands[selected].gain) }}</template>
                    · Q {{ formatQ(bands[selected].q) }}
                </div>
            </div>

            <div class="eq-bands">
                <section v-for="(band, index) in bands" :key="index"
                    class="eq-band ap-card"
                    :class="{ 'eq-band-selected': selected === index, 'eq-band-off': !band.enabled }"
                    :style="{ '--band-color': EQ_BAND_COLORS[index], '--ap-toggle-color': EQ_BAND_COLORS[index] }"
                    @pointerdown="handler.selectedBand.value = index">
                    <header class="eq-band-header">
                        <span class="eq-band-badge">{{ index + 1 }}</span>
                        <select class="ap-select eq-band-type" :value="band.type" :aria-label="`Band ${index + 1} filter type`"
                            @change="handler.setBand(index, { type: ($event.target as HTMLSelectElement).value as BiquadFilterType })">
                            <option v-for="option in FILTER_TYPES" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                        <button type="button" role="switch" class="ap-toggle" :aria-checked="band.enabled"
                            :aria-label="`Band ${index + 1} ${band.enabled ? 'on' : 'off'}`"
                            @click="handler.setBand(index, { enabled: !band.enabled })"></button>
                    </header>
                    <div class="eq-band-knobs">
                        <RotaryKnob label="Freq" :model-value="band.frequency" :min="EQ_MIN_FREQ" :max="EQ_MAX_FREQ" scale="log"
                            :default-value="defaults[index].frequency" :format="formatFrequency" :color="EQ_BAND_COLORS[index]"
                            :size="40" :disabled="!band.enabled"
                            @update:model-value="handler.setBand(index, { frequency: $event })" />
                        <RotaryKnob label="Gain" :model-value="band.gain" :min="-EQ_MAX_GAIN" :max="EQ_MAX_GAIN" bipolar
                            :default-value="0" :format="formatGain" :color="EQ_BAND_COLORS[index]" :size="40"
                            :disabled="!band.enabled || !eqTypeUsesGain(band.type)"
                            @update:model-value="handler.setBand(index, { gain: $event })" />
                        <RotaryKnob label="Q" :model-value="band.q" :min="EQ_Q_RANGE.min" :max="EQ_Q_RANGE.max" scale="log"
                            :default-value="defaults[index].q" :format="formatQ" :color="EQ_BAND_COLORS[index]" :size="40"
                            :disabled="!band.enabled"
                            @update:model-value="handler.setBand(index, { q: $event })" />
                    </div>
                </section>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import RotaryKnob from './audio/RotaryKnob.vue';
import './audio/audioPlugin.css';
import { DIALOGS } from '../services/dialogs/dialogs';
import {
    EQ_BAND_COLORS, EQ_MAX_GAIN, EQ_MIN_FREQ, EQ_MAX_FREQ, EQ_Q_RANGE,
    createDefaultEqBands, eqTypeUsesGain, masterEqualizer,
} from '../services/audio/masterEqualizer';
import { EqualizerGraph } from './audio/equalizerGraph';
import { isDialogOpen } from '../stores/dialogState';

const FILTER_TYPES: { value: BiquadFilterType, label: string }[] = [
    { value: 'peaking', label: 'Bell' },
    { value: 'lowshelf', label: 'Low shelf' },
    { value: 'highshelf', label: 'High shelf' },
    { value: 'highpass', label: 'Low cut' },
    { value: 'lowpass', label: 'High cut' },
    { value: 'bandpass', label: 'Band pass' },
    { value: 'notch', label: 'Notch' },
];

const handler = new EqualizerGraph();
const bands = handler.bands;
const selected = computed(() => handler.selectedBand.value);
const defaults = createDefaultEqBands();
const isFlat = computed(() => handler.isFlat());
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isOpen = computed(() => isDialogOpen(DIALOGS.EQUALIZER.id));

let dragging = -1;

function handlePos(index: number) {
    return handler.handlePosition(index);
}

function formatFrequency(value: number): string {
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`;
}

function formatGain(value: number): string {
    const rounded = Math.abs(value) < 0.05 ? 0 : value;
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} dB`;
}

function formatQ(value: number): string {
    return value.toFixed(2);
}

function localPoint(event: PointerEvent) {
    const svg = (event.currentTarget as SVGGElement).ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onHandleDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return;
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
    dragging = index;
    handler.selectedBand.value = index;
    event.preventDefault();
}

function onHandleMove(event: PointerEvent, index: number) {
    if (dragging !== index) return;
    const point = localPoint(event);
    const x = Math.min(handler.PLOT_WIDTH, Math.max(0, point.x));
    const patch: { frequency: number, gain?: number } = { frequency: handler.xPosToFrequency(x) };
    if (eqTypeUsesGain(bands.value[index].type)) {
        patch.gain = handler.yPosToDb(Math.min(handler.PLOT_HEIGHT, Math.max(0, point.y)));
    }
    handler.setBand(index, patch);
}

function onHandleUp(event: PointerEvent) {
    if (dragging === -1) return;
    dragging = -1;
    (event.currentTarget as SVGGElement).releasePointerCapture(event.pointerId);
}

function onHandleWheel(event: WheelEvent, index: number) {
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    handler.selectedBand.value = index;
    handler.setBand(index, { q: bands.value[index].q * factor });
}

onMounted(() => {
    if (canvasRef.value) handler.attachCanvas(canvasRef.value);
});

onUnmounted(() => {
    handler.detachCanvas();
    masterEqualizer.spectrumListener = null;
});

// The meters loop hands over the master spectrum while this panel is open.
watch(isOpen, (open) => {
    masterEqualizer.spectrumListener = open ? (data) => handler.drawSpectrum(data) : null;
    if (open) handler.redraw();
}, { immediate: true });
watch(selected, () => handler.redraw());
</script>

<style scoped>
.eq {
    width: fit-content;
}

.eq-status {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    box-sizing: border-box;
    border-radius: 999px;
    background: var(--ap-inset);
    border: 1px solid var(--ap-border);
    color: var(--ap-muted);
    font-size: 10px;
    font-weight: 600;
}
.eq-status-active {
    color: var(--ap-accent);
    border-color: color-mix(in srgb, var(--ap-accent) 45%, transparent);
}

.eq-hint {
    color: var(--ap-faint);
    font-size: 11px;
}

.eq-graph {
    position: relative;
    overflow: hidden;
    background: var(--ap-inset);
}

.eq-canvas {
    display: block;
}

.eq-overlay {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
}

.eq-handle {
    cursor: grab;
    touch-action: none;
}
.eq-handle:active {
    cursor: grabbing;
}
.eq-handle-hit {
    fill: transparent;
}
.eq-handle-dot {
    fill: color-mix(in srgb, var(--band-color) 30%, var(--gray-900));
    stroke: var(--band-color);
    stroke-width: 2;
    transition: r 0.12s ease;
}
.eq-handle text {
    fill: var(--gray-0);
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
}
.eq-handle:hover .eq-handle-dot,
.eq-handle-selected .eq-handle-dot {
    r: 11;
    fill: var(--band-color);
}
.eq-handle-selected text,
.eq-handle:hover text {
    fill: var(--gray-900);
}
.eq-handle-off {
    opacity: 0.35;
}

.eq-readout {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--gray-950) 85%, transparent);
    border: 1px solid var(--ap-border);
    color: var(--ap-text);
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
}
.eq-readout-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--band-color);
}

.eq-bands {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}

.eq-band {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 8px 10px;
    transition: border-color 0.12s ease, background-color 0.12s ease;
}
.eq-band-selected {
    background: var(--ap-panel-raised);
    border-color: var(--ap-border-strong);
}
.eq-band-off .eq-band-knobs {
    opacity: 0.6;
}

.eq-band-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.eq-band-badge {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    border-radius: 50%;
    background: var(--band-color);
    color: var(--gray-900);
    font-size: 10px;
    font-weight: 700;
}

.eq-band-type {
    flex: 1;
}

.eq-band-knobs {
    display: flex;
    justify-content: space-between;
    gap: 2px;
}
</style>
