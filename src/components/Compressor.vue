<template>
    <BaseModal :modal-id="MODALS.COMPRESSOR.id">
        <template #title>Compressor</template>
        <div class="comp-plugin">
            <div class="comp-hero">
                <div class="comp-screen comp-screen-primary">
                    <span class="comp-screen-label">GR</span>
                    <div class="comp-screen-reading-row">
                        <span class="comp-screen-reading">{{ gainReductionDb.toFixed(1) }}</span>
                        <span class="comp-screen-unit">dB</span>
                    </div>
                </div>
                <div class="comp-screen">
                    <span class="comp-screen-label">THR</span>
                    <div class="comp-screen-reading-row">
                        <span class="comp-screen-reading">{{ formatSettingValue(settings[2], 2) }}</span>
                        <span class="comp-screen-unit">{{ settings[2].unit }}</span>
                    </div>
                </div>
                <div class="comp-screen">
                    <span class="comp-screen-label">Ratio</span>
                    <div class="comp-screen-reading-row">
                        <span class="comp-screen-reading">{{ formatSettingValue(settings[3], 3) }}</span>
                        <span class="comp-screen-unit">{{ settings[3].unit }}</span>
                    </div>
                </div>
            </div>

            <div class="comp-panel">
                <div class="comp-knobs">
                    <div v-for="(setting, index) in settings" :key="setting.knobId" class="comp-knob-cell">
                        <span class="comp-knob-label">{{ setting.label }}</span>
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
                        <span class="comp-knob-value">{{ formatSettingValue(setting, index) }}<span class="comp-unit">{{ setting.unit }}</span></span>
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
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { audioEngine } from '../assets/js/audioEngine';
import KnobBox from './KnobBox.vue';
import BaseModal from './BaseModal.vue';
import { MODALS } from '../assets/js/modals/modalTypes';

interface CompressorSetting {
    label: string;
    containerId: string;
    knobId: string;
    start: number;
    min: number;
    max: number;
    valueId: string;
    unit: string;
    displayDecimals: number;
}

const settings: CompressorSetting[] = [
    { label: 'Attack', containerId: 'attackKnobContainer', knobId: 'attackKnob', start: 5, min: 0, max: 100, valueId: 'compAttValue', unit: 'ms', displayDecimals: 0 },
    { label: 'Release', containerId: 'releaseKnobContainer', knobId: 'releaseKnob', start: 50, min: 1, max: 1000, valueId: 'compReleaseValue', unit: 'ms', displayDecimals: 0 },
    { label: 'Threshold', containerId: 'thresholdKnobContainer', knobId: 'thresholdKnob', start: -1, min: -60, max: 0, valueId: 'compThresholdValue', unit: 'dB', displayDecimals: 1 },
    { label: 'Ratio', containerId: 'ratioKnobContainer', knobId: 'ratioKnob', start: 20, min: 1, max: 20, valueId: 'compRatioValue', unit: ':1', displayDecimals: 1 },
];

const knobValues = reactive<Record<number, number>>(Object.fromEntries(settings.map((setting, index) => [index, setting.start])) as Record<number, number>);

const grMarkers = [0, 25, 50, 75, 100];

const gainReductionDb = computed(() => {
    const threshold = Math.abs(knobValues[2]);
    const ratio = Math.max(1, knobValues[3]);

    return Math.min(24, threshold / ratio);
});

const grWidth = computed(() => {
    return (gainReductionDb.value / 24) * 100;
});

function formatSettingValue(setting: CompressorSetting, index: number): string {
    return knobValues[index].toFixed(setting.displayDecimals);
}

function setLimiterProperty(limiter: DynamicsCompressorNode, property: string, value: number) {
    switch (property) {
        case 'attack':    limiter.attack.value    = value / 1000; break;
        case 'release':   limiter.release.value   = value / 1000; break;
        case 'threshold': limiter.threshold.value = value;        break;
        case 'ratio':     limiter.ratio.value     = value;        break;
    }
}

function compressorKnobRotate(angle: number, settingId: string) {
    const idx = parseInt(settingId, 10);
    const setting = settings[idx];
    knobValues[idx] = (angle / 360) * (setting.max - setting.min) + setting.min;

    if (audioEngine.limiter != null) {
        setLimiterProperty(audioEngine.limiter, setting.label.toLowerCase(), knobValues[idx]);
    }
}
</script>

<style scoped>
:global(#compressorModal) {
    background: #12151c;
    min-width: 520px;
    border: 1px solid #2a3039;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    overflow: hidden;
}
:global(#compressorModal .modalTopBar) {
    min-height: 40px;
    height: auto;
    background: #181c24;
    border-bottom: 1px solid #2a3039;
    padding: 6px 10px 6px 0;
}
:global(#compressorModal .modalTopBarLabel) {
    color: #c8ced8;
    font-size: 13px;
    font-weight: 600;
}
:global(#compressorModal .modal_close .icon) { fill: #7a8494; stroke: #7a8494; }
:global(#compressorModal .modal_close:hover .icon) { fill: #d4a054; stroke: #d4a054; }
:global(#compressorModal .modalBody) {
    padding: 0;
    background: #12151c;
}

.comp-plugin {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    overflow: visible;
    background: #141820;
}

.comp-hero {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.comp-screen {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    min-height: 58px;
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid #2a3039;
    background: #1a1f28;
}

.comp-screen-primary {
    border-color: #3d4654;
}

.comp-screen-label {
    color: #8b939f;
    font-size: 10px;
    font-weight: 600;
}

.comp-screen-reading-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.comp-screen-reading {
    color: #eef1f5;
    font-size: 20px;
    line-height: 1;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

.comp-screen-unit {
    color: #a8894f;
    font-size: 10px;
    font-weight: 600;
}

.comp-panel {
    padding: 12px;
    border: 1px solid #2a3039;
    border-radius: 8px;
    background: #181c24;
}

.comp-knobs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    overflow: visible;
}

.comp-knob-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 10px 10px;
    background: #1a1f28;
    border: 1px solid #2a3039;
    border-radius: 6px;
    min-width: 0;
    overflow: hidden;
}

.comp-knob-label {
    color: #9aa3af;
    font-size: 10px;
    font-weight: 600;
}

.comp-knob-ring {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    min-height: 60px;
}

:deep(.comp-knob-ring .knobBox) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 60px;
    margin: 0;
}

:deep(.comp-knob-ring div.knob) {
    transform: scale(1.6);
    transform-origin: center center;
    background: transparent !important;
    overflow: visible;
    box-shadow: none;
    flex-shrink: 0;
}

:deep(.comp-knob-ring .knobRing circle:first-child) {
    fill: #161c28;
}

.comp-knob-value {
    color: #eef1f5;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

.comp-unit {
    color: #a8894f;
    font-size: 10px;
    margin-left: 3px;
    font-weight: 600;
}

:deep(.knobBox > label:first-child),
:deep(.knobBox > label:last-child) {
    display: none;
}

.comp-gr-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 2px 0;
}

.gr-label, .gr-unit {
    color: #8b939f;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
}

.gr-track {
    flex: 1;
    height: 10px;
    background: #0f1218;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    border: 1px solid #2a3039;
}

.gr-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a9e6e 0%, #c4a035 55%, #c45c5c 100%);
    border-radius: 3px;
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
    top: -14px;
    font-size: 8px;
    font-weight: 500;
    color: #6d7787;
    font-family: 'Roboto Mono', monospace, sans-serif;
    transform: translateX(-50%);
}

@media (max-width: 900px) {
    :global(#compressorModal) {
        min-width: 0;
        width: min(92vw, 560px);
    }

    .comp-hero,
    .comp-knobs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
