<template>
    <BaseModal :modal-id="MODALS.COMPRESSOR.id">
        <template #title>
            <span class="comp-badge">COMP</span>
            Compressor / Limiter
        </template>
        <div class="comp-plugin">
            <div class="comp-knobs">
                <div v-for="(setting, index) in settings" :key="index" class="comp-knob-cell">
                    <span class="comp-knob-label">{{ setting.label.toUpperCase() }}</span>
                    <div class="comp-knob-ring">
                        <KnobBox
                            :label="''"
                            :containerId="setting.containerId"
                            :knobId="setting.knobId"
                            :dataId="index"
                            :rotate-func="compressorKnobRotate"
                            :start="setting.start"
                            :min="setting.min"
                            :max="setting.max"
                            :valueId="setting.valueId"
                            :knobValue="knobValues[index]"
                            :unit="setting.unit"
                            :midKnob="true" />
                    </div>
                    <span class="comp-knob-value">{{ knobValues[index].toFixed(1) }}<span class="comp-unit">{{ setting.unit }}</span></span>
                </div>
            </div>
            <div class="comp-gr-row">
                <span class="gr-label">GR</span>
                <div class="gr-track">
                    <div class="gr-fill" :style="{ width: grWidth + '%' }"></div>
                    <div class="gr-markers">
                        <span v-for="m in grMarkers" :key="m" class="gr-marker" :style="{ left: m + '%' }">{{ Math.round(m * 0.24) }}</span>
                    </div>
                </div>
                <span class="gr-unit">dB</span>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { audioEngine } from '../assets/js/audioEngine';
import KnobBox from './KnobBox.vue';
import BaseModal from './BaseModal.vue';
import { MODALS } from '../assets/js/modals/modalTypes';

const settings = [
    { label: 'Attack',    containerId: 'attackKnobContainer',    knobId: 'attackKnob',    start: 5,   min: 0,   max: 100, valueId: 'compAttValue',       unit: 'ms' },
    { label: 'Release',   containerId: 'releaseKnobContainer',   knobId: 'releaseKnob',   start: 50,  min: 1,   max: 1000,valueId: 'compReleaseValue',    unit: 'ms' },
    { label: 'Threshold', containerId: 'thresholdKnobContainer', knobId: 'thresholdKnob', start: -1,  min: -60, max: 0,   valueId: 'compThresholdValue',  unit: 'dB' },
    { label: 'Ratio',     containerId: 'ratioKnobContainer',     knobId: 'ratioKnob',     start: 20,  min: 1,   max: 20,  valueId: 'compRatioValue',      unit: ':1' },
];

const knobValues = reactive(Object.fromEntries(settings.map((s, i) => [i, s.start])));

const grMarkers = [0, 25, 50, 75, 100];

const grWidth = computed(() => {
    const threshold = knobValues[2];
    const ratio = knobValues[3];
    if (!audioEngine.limiter) return 0;
    const gr = Math.abs(threshold) / ratio;
    return Math.min(100, (gr / 24) * 100);
});

function setLimiterProperty(limiter: DynamicsCompressorNode, property: string, value: number) {
    switch (property) {
        case 'attack':    limiter.attack.value    = value / 1000; break;
        case 'release':   limiter.release.value   = value / 1000; break;
        case 'threshold': limiter.threshold.value = value;        break;
        case 'ratio':     limiter.ratio.value     = value;        break;
    }
}

function compressorKnobRotate(angle: number, knobId: string) {
    const idx = parseInt(knobId);
    const setting = settings[idx];
    if (audioEngine.limiter != null) {
        knobValues[knobId] = (angle / 360) * (setting.max - setting.min) + setting.min;
        setLimiterProperty(audioEngine.limiter, setting.label.toLowerCase(), knobValues[knobId]);
    }
}
</script>

<style scoped>
/* ── Modal chrome ── */
:deep(#compressorModal) {
    background: #0a0c14;
    min-width: 520px;
    border: 1px solid #1a1e30;
    border-radius: 6px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7), 0 0 1px rgba(232, 146, 12, 0.12);
    overflow: hidden;
}
:deep(#compressorModal .modalTopBar) {
    background: linear-gradient(180deg, #0e1018 0%, #090b12 100%);
    border-bottom: 1px solid #1a1e30;
    padding: 6px 10px;
}
:deep(#compressorModal .modalTopBarLabel) { color: #7b8a9a; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }
:deep(#compressorModal .modal_close .icon) { fill: #3a4450; stroke: #3a4450; }
:deep(#compressorModal .modal_close:hover .icon) { fill: #7b8a9a; stroke: #7b8a9a; }
:deep(#compressorModal .modalBody) {
    padding: 0;
    background: #0a0c14;
}

.comp-badge {
    display: inline-block;
    background: linear-gradient(135deg, #f5a623, #d4850a);
    color: #1a0e00;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.14em;
    padding: 2px 7px;
    border-radius: 2px;
    margin-right: 8px;
    vertical-align: middle;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.15);
}

.comp-plugin {
    display: flex;
    flex-direction: column;
    overflow: visible;
}

/* ── Knob grid ── */
.comp-knobs {
    display: flex;
    padding: 16px 14px 14px;
    gap: 8px;
    background: linear-gradient(180deg, #0c0e16 0%, #080a10 100%);
    overflow: visible;
}

.comp-knob-cell {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 10px 14px;
    background: linear-gradient(180deg, rgba(14, 16, 24, 0.6) 0%, rgba(10, 12, 18, 0.6) 100%);
    border: 1px solid #18202e;
    border-radius: 5px;
    min-width: 100px;
    max-width: 130px;
    overflow: hidden;
    position: relative;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.02),
        0 2px 8px rgba(0, 0, 0, 0.3);
}
.comp-knob-cell::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 10%, #e8920c 50%, transparent 90%);
    border-radius: 5px 5px 0 0;
    opacity: 0.7;
}

.comp-knob-label {
    color: #e8b050;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(232, 146, 12, 0.15);
}

.comp-knob-ring {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    min-height: 58px;
}

:deep(.comp-knob-ring .knobBox) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 58px;
    margin: 0;
}

:deep(.comp-knob-ring div.knob) {
    transform: scale(1.7);
    transform-origin: center center;
    background: transparent !important;
    overflow: visible;
    box-shadow: none;
    flex-shrink: 0;
}

:deep(.comp-knob-ring .knobRing circle:first-child) {
    fill: #161a24;
}

.comp-knob-value {
    color: #e8f0f8;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

.comp-unit {
    color: #8a9ab0;
    font-size: 10px;
    margin-left: 2px;
    font-weight: 500;
}

/* strip out unwanted KnobBox label/value since we render our own */
:deep(.knobBox > label:first-child),
:deep(.knobBox > label:last-child) {
    display: none;
}

/* ── Gain reduction meter ── */
.comp-gr-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px 14px;
    background: linear-gradient(180deg, #080a10 0%, #070910 100%);
    border-top: 1px solid #141828;
}

.gr-label, .gr-unit {
    color: #6a7888;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    flex-shrink: 0;
    text-transform: uppercase;
}

.gr-track {
    flex: 1;
    height: 10px;
    background: #0c0e16;
    border-radius: 2px;
    position: relative;
    overflow: hidden;
    border: 1px solid #18202e;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.gr-fill {
    height: 100%;
    background: linear-gradient(to right, #2ecc71 0%, #a8e063 40%, #f5c842 70%, #e84a5f 100%);
    border-radius: 1px;
    transition: width 0.05s linear;
}

.gr-markers {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.gr-marker {
    position: absolute;
    top: -13px;
    font-size: 7px;
    font-weight: 600;
    color: #2e3a4c;
    font-family: 'Roboto Mono', monospace, sans-serif;
    transform: translateX(-50%);
}
</style>
