<template>
    <BaseModal :modal-id="MODALS.COMPRESSOR.id">
        <template #title>Master Compressor</template>
        <div class="ap-root comp" :class="{ 'comp-bypassed': bypass }">
            <div class="ap-toolbar">
                <label class="ap-section-label" for="compressorPreset">Preset</label>
                <select id="compressorPreset" class="ap-select comp-preset" :value="presetName" @change="applyPreset">
                    <option value="" disabled>Custom</option>
                    <option v-for="preset in COMPRESSOR_PRESETS" :key="preset.name" :value="preset.name">{{ preset.name }}</option>
                </select>
                <span class="ap-toolbar-spacer"></span>
                <span class="comp-bypass-label" :class="{ 'comp-bypass-on': !bypass }">{{ bypass ? 'Bypassed' : 'Active' }}</span>
                <button type="button" role="switch" class="ap-toggle" :aria-checked="!bypass"
                    aria-label="Compressor on" style="--ap-toggle-color: var(--ap-green)"
                    @click="handler.setBypass(!bypass)"></button>
            </div>

            <div class="comp-display">
                <div class="comp-curve ap-card">
                    <svg :viewBox="`0 0 ${CURVE} ${CURVE}`" :width="CURVE" :height="CURVE" role="img"
                        :aria-label="`Transfer curve: threshold ${settings.threshold.toFixed(1)} dB, ratio ${settings.ratio.toFixed(1)}:1`">
                        <g class="comp-grid">
                            <template v-for="db in GRID_DB" :key="db">
                                <line :x1="dbToPx(db)" :x2="dbToPx(db)" y1="0" :y2="CURVE" />
                                <line x1="0" :x2="CURVE" :y1="CURVE - dbToPx(db)" :y2="CURVE - dbToPx(db)" />
                            </template>
                            <line class="comp-unity" x1="0" :y1="CURVE" :x2="CURVE" y2="0" />
                        </g>
                        <line class="comp-threshold" :x1="dbToPx(settings.threshold)" :x2="dbToPx(settings.threshold)" y1="0" :y2="CURVE" />
                        <path class="comp-curve-fill" :d="curveFillPath" />
                        <path class="comp-curve-line" :d="curvePath" />
                        <circle v-if="liveInputDb > MIN_DB" class="comp-live-dot"
                            :cx="dbToPx(liveInputDb)" :cy="CURVE - dbToPx(liveCurveDb)" r="4" />
                        <text class="comp-axis" :x="CURVE - 4" :y="CURVE - 5" text-anchor="end">Input →</text>
                        <text class="comp-axis" x="4" y="12">↑ Output</text>
                        <text v-for="db in [-48, -36, -24]" :key="`x${db}`" class="comp-axis comp-axis-tick" :x="dbToPx(db) + 3" :y="CURVE - 5">{{ db }}</text>
                    </svg>
                </div>

                <div class="comp-meters ap-card">
                    <div v-for="meter in meters" :key="meter.id" class="comp-meter">
                        <span class="comp-meter-value ap-num">{{ meter.text }}</span>
                        <div class="comp-meter-track" :class="`comp-meter-${meter.id}`">
                            <div class="comp-meter-fill" :style="meter.style"></div>
                            <div v-for="tick in meter.ticks" :key="tick.label" class="comp-meter-tick" :style="{ top: `${tick.top}%` }">
                                <span>{{ tick.label }}</span>
                            </div>
                        </div>
                        <span class="ap-section-label">{{ meter.label }}</span>
                    </div>
                </div>
            </div>

            <div class="comp-knobs ap-card">
                <RotaryKnob label="Threshold" :model-value="settings.threshold" v-bind="COMPRESSOR_RANGES.threshold"
                    :default-value="DEFAULTS.threshold" :format="(v) => `${v.toFixed(1)} dB`" :size="52"
                    color="var(--ap-amber)" @update:model-value="handler.update({ threshold: $event })" />
                <RotaryKnob label="Ratio" :model-value="settings.ratio" v-bind="COMPRESSOR_RANGES.ratio" scale="log"
                    :default-value="DEFAULTS.ratio" :format="(v) => `${v.toFixed(v < 10 ? 1 : 0)}:1`" :size="52"
                    color="var(--ap-amber)" @update:model-value="handler.update({ ratio: $event })" />
                <RotaryKnob label="Knee" :model-value="settings.knee" v-bind="COMPRESSOR_RANGES.knee"
                    :default-value="DEFAULTS.knee" :format="(v) => `${v.toFixed(1)} dB`" :size="52"
                    color="var(--ap-amber)" @update:model-value="handler.update({ knee: $event })" />
                <RotaryKnob label="Attack" :model-value="settings.attack" v-bind="COMPRESSOR_RANGES.attack" scale="log"
                    :default-value="DEFAULTS.attack" :format="formatMs" :size="52"
                    @update:model-value="handler.update({ attack: $event })" />
                <RotaryKnob label="Release" :model-value="settings.release" v-bind="COMPRESSOR_RANGES.release" scale="log"
                    :default-value="DEFAULTS.release" :format="formatMs" :size="52"
                    @update:model-value="handler.update({ release: $event })" />
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BaseModal from './BaseModal.vue';
import RotaryKnob from './audio/RotaryKnob.vue';
import './audio/audioPlugin.css';
import { MODALS } from '../services/dialogs/modalTypes';
import { modalManager } from '../services/dialogs/modalManager';
import { audioGraph } from '../services/audio/audioGraph';
import {
    COMPRESSOR_PRESETS, COMPRESSOR_RANGES, CompressorModalHandler, compressorCurve,
} from '../services/dialogs/compressorModalHandler';
import { useAnimationLoop, useModalOpen } from '../composables/useModalOpen';

const CURVE = 200;
const MIN_DB = -60;
const GRID_DB = [-48, -36, -24, -12];
const GR_RANGE = 24;
const DEFAULTS = COMPRESSOR_PRESETS[0].settings;
const PEAK_FALL_DB_PER_FRAME = 0.5;

const handler = modalManager.getHandler(MODALS.COMPRESSOR.id) as CompressorModalHandler;
const settings = handler.settings;
const bypass = computed(() => handler.bypass.value);
const presetName = computed(() => handler.matchingPreset());

const outputDb = ref(MIN_DB);
const reductionDb = ref(0);
let timeDomain: Float32Array | null = null;

function dbToPx(db: number): number {
    return ((Math.max(MIN_DB, Math.min(0, db)) - MIN_DB) / -MIN_DB) * CURVE;
}

function formatMs(value: number): string {
    return value < 10 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`;
}

function applyPreset(event: Event) {
    const preset = COMPRESSOR_PRESETS.find((p) => p.name === (event.target as HTMLSelectElement).value);
    if (preset) handler.update(preset.settings);
}

const activeSettings = computed(() => (bypass.value ? { ...settings, threshold: 0, ratio: 1 } : settings));

const curvePoints = computed(() => {
    const points: string[] = [];
    for (let db = MIN_DB; db <= 0; db += 0.5) {
        points.push(`${dbToPx(db).toFixed(1)},${(CURVE - dbToPx(compressorCurve(db, activeSettings.value))).toFixed(1)}`);
    }
    return points;
});
const curvePath = computed(() => `M ${curvePoints.value.join(' L ')}`);
const curveFillPath = computed(() => `${curvePath.value} L ${CURVE},${CURVE} L 0,${CURVE} Z`);

// The analyser sits after the compressor, so input ≈ output + gain reduction.
const liveInputDb = computed(() => (outputDb.value <= MIN_DB ? MIN_DB : outputDb.value - reductionDb.value));
const liveCurveDb = computed(() => compressorCurve(liveInputDb.value, activeSettings.value));

function levelPercent(db: number): number {
    return (Math.max(MIN_DB, Math.min(0, db)) - MIN_DB) / -MIN_DB * 100;
}

const levelTicks = [0, -12, -24, -36, -48].map((db) => ({ label: `${db}`, top: 100 - levelPercent(db) }));
const grTicks = [0, 6, 12, 18, 24].map((db) => ({ label: `${db}`, top: (db / GR_RANGE) * 100 }));

const meters = computed(() => [
    {
        id: 'in',
        label: 'In',
        text: liveInputDb.value <= MIN_DB ? '-∞' : liveInputDb.value.toFixed(1),
        style: { height: `${levelPercent(liveInputDb.value)}%` },
        ticks: levelTicks,
    },
    {
        id: 'gr',
        label: 'GR',
        text: reductionDb.value > -0.05 ? '0.0' : reductionDb.value.toFixed(1),
        style: { height: `${Math.min(100, (-reductionDb.value / GR_RANGE) * 100)}%` },
        ticks: grTicks,
    },
    {
        id: 'out',
        label: 'Out',
        text: outputDb.value <= MIN_DB ? '-∞' : outputDb.value.toFixed(1),
        style: { height: `${levelPercent(outputDb.value)}%` },
        ticks: levelTicks,
    },
]);

function readPeakDb(): number {
    const analyser = audioGraph.masterAnalyser;
    if (timeDomain == null || timeDomain.length !== analyser.fftSize) {
        timeDomain = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(timeDomain);
    let peak = 0;
    for (let i = 0; i < timeDomain.length; i += 1) {
        const sample = Math.abs(timeDomain[i]);
        if (sample > peak) peak = sample;
    }
    return peak > 0 ? 20 * Math.log10(peak) : MIN_DB;
}

const isOpen = useModalOpen(MODALS.COMPRESSOR.id);
useAnimationLoop(isOpen, () => {
    const peak = readPeakDb();
    // Instant attack, slow fall, so peaks stay readable.
    outputDb.value = Math.max(peak, outputDb.value - PEAK_FALL_DB_PER_FRAME, MIN_DB);
    const reduction = handler.reduction();
    reductionDb.value = Math.min(reduction, reductionDb.value + PEAK_FALL_DB_PER_FRAME, 0);
});
</script>

<style scoped>
.comp {
    width: 468px;
}

.comp-preset {
    width: 150px;
}

.comp-bypass-label {
    color: var(--ap-muted);
    font-size: 11px;
    font-weight: 600;
}
.comp-bypass-on {
    color: var(--ap-green);
}

.comp-display {
    display: flex;
    align-items: stretch;
    gap: 10px;
}

.comp-curve {
    display: flex;
    align-items: center;
    padding: 8px;
    background: var(--ap-inset);
    line-height: 0;
}

.comp-grid line {
    stroke: var(--ap-grid);
    stroke-width: 1;
}
.comp-grid .comp-unity {
    stroke: var(--ap-grid-strong);
    stroke-dasharray: 3 4;
}
.comp-threshold {
    stroke: var(--ap-amber);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    opacity: 0.7;
}
.comp-curve-fill {
    fill: color-mix(in srgb, var(--ap-amber) 10%, transparent);
}
.comp-curve-line {
    fill: none;
    stroke: var(--ap-amber);
    stroke-width: 2;
    stroke-linejoin: round;
}
.comp-live-dot {
    fill: var(--gray-0);
    stroke: var(--ap-amber);
    stroke-width: 2;
}
.comp-axis {
    fill: var(--ap-faint);
    font-size: 9px;
    font-weight: 600;
}
.comp-bypassed .comp-curve-line,
.comp-bypassed .comp-threshold {
    stroke: var(--ap-faint);
}
.comp-bypassed .comp-curve-fill {
    fill: transparent;
}

.comp-meters {
    flex: 1;
    display: flex;
    justify-content: space-around;
    padding: 10px 6px 8px;
}

.comp-meter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.comp-meter-value {
    min-width: 40px;
    padding: 2px 4px;
    border-radius: 4px;
    background: var(--ap-inset);
    color: var(--ap-text);
    font-size: 11px;
    font-weight: 600;
    text-align: center;
}

.comp-meter-track {
    position: relative;
    flex: 1;
    width: 12px;
    min-height: 150px;
    border-radius: 3px;
    background: var(--ap-inset);
    border: 1px solid var(--ap-border);
}

.comp-meter-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 2px;
    background: linear-gradient(to top, var(--green-400) 0%, var(--green-400) 60%, var(--amber-400) 82%, var(--red-400) 100%);
    background-size: 100% 150px;
    background-position: bottom;
}
.comp-meter-gr .comp-meter-fill {
    top: 0;
    bottom: auto;
    background: var(--ap-amber);
}

.comp-meter-tick {
    position: absolute;
    left: 14px;
    height: 0;
    border-top: 1px solid var(--ap-border-strong);
    width: 4px;
}
.comp-meter-tick span {
    position: absolute;
    left: 6px;
    top: -6px;
    color: var(--ap-faint);
    font-size: 9px;
    line-height: 1;
}

.comp-knobs {
    display: flex;
    justify-content: space-around;
    padding: 12px 6px 10px;
}
</style>
