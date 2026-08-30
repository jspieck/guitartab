<template>
    <BaseModal :modal-id="MODALS.EQUALIZER.id">
        <template #title>Equalizer</template>
        <div class="eq-plugin">
            <div class="eq-stage">
                <div class="eq-canvas-wrap">
                    <canvas id="equalizerCanvas" ref="canvasRef"
                        :width="handler.CANVAS_WIDTH + handler.DECIBEL_WIDTH"
                        :height="handler.CANVAS_HEIGHT + handler.FREQUENCY_HEIGHT">
                    </canvas>
                    <svg id="equalizerOverlay" ref="equalizerOverlayRef"
                        :width="`${handler.CANVAS_WIDTH + handler.DECIBEL_WIDTH}px`"
                        :height="`${handler.CANVAS_HEIGHT + handler.FREQUENCY_HEIGHT}px`">
                        <g>
                            <g v-for="(freq, i) in handler.frequencyLines" :key="'freq-' + i">
                                <text :x="handler.frequencyToXPos(freq)" y="14" text-anchor="middle" class="freqLabel">
                                    {{ freq < 1000 ? freq : freq / 1000 + 'k' }}
                                </text>
                            </g>
                            <g v-for="(db, i) in handler.decibelLines" :key="'db-' + i">
                                <text v-if="i < handler.decibelLines.length - 1"
                                    :x="handler.CANVAS_WIDTH + 5"
                                    :y="handler.FREQUENCY_HEIGHT + (handler.CANVAS_HEIGHT * i) / (handler.decibelLines.length - 1) + 4"
                                    text-anchor="start" class="dbLabel">
                                    {{ db }}
                                </text>
                            </g>
                            <text :x="handler.CANVAS_WIDTH + 5"
                                :y="handler.FREQUENCY_HEIGHT + handler.CANVAS_HEIGHT"
                                text-anchor="start" class="dbLabel">
                                {{ handler.decibelLines[handler.decibelLines.length - 1] }}
                            </text>
                        </g>
                        <g>
                            <circle v-for="(frequency, index) in handler.equalizerNodeFrequencies.value"
                                :key="index"
                                :cx="handler.frequencyToXPos(frequency)"
                                :cy="handler.FREQUENCY_HEIGHT + handler.CANVAS_HEIGHT / 2"
                                :data-x="handler.frequencyToXPos(frequency)"
                                :data-y="handler.FREQUENCY_HEIGHT + handler.CANVAS_HEIGHT / 2"
                                :data-id="index"
                                :r="8"
                                :fill="handler.circleColors[index] + '33'"
                                :stroke="handler.circleColors[index]"
                                stroke-width="2"
                                class="eqNode"
                                ref="equalizerNodesRef">
                            </circle>
                        </g>
                    </svg>
                </div>
            </div>

            <div class="eq-controls">
                <div v-for="band in bands" :key="band.id" class="eq-band" :style="{ '--band-color': band.color }">
                    <div class="band-header">
                        <span class="band-dot" :style="{ background: band.color }"></span>
                        <span class="band-num">Band {{ band.id }}</span>
                    </div>
                    <label class="ctrl-label">Mode</label>
                    <div class="band-select-wrap">
                        <select :id="band.selectId"
                            :value="getBandMode(band.id - 1)"
                            @change="setBandMode(band.id - 1, ($event.target as HTMLSelectElement).value)"
                            class="band-select">
                            <option v-for="mode in filterModes" :key="mode" :value="mode">
                                {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
                            </option>
                        </select>
                    </div>
                    <label class="ctrl-label">Q factor</label>
                    <div class="band-knob-wrap" v-if="isMounted">
                        <div class="knob">
                            <Knob :id="band.knobId" :data-id="band.id" :rotate-func="qualityKnobRotate"
                                :start="handler.quality.start" :min="handler.quality.min"
                                :max="handler.quality.max" :mid-knob="false" />
                        </div>
                    </div>
                    <label :id="band.qualityLabelId" class="knob-value">1.0</label>
                </div>

                <div class="eq-readout">
                    <div class="readout-group">
                        <span class="readout-label">Freq</span>
                        <span class="readout-value">{{ handler.eqCurrentFreq.value }}<span class="readout-unit">Hz</span></span>
                    </div>
                    <div class="readout-divider"></div>
                    <div class="readout-group">
                        <span class="readout-label">Gain</span>
                        <span class="readout-value">{{ handler.eqGain.value }}<span class="readout-unit">dB</span></span>
                    </div>
                </div>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import Knob from './Knob.vue';
import BaseModal from './BaseModal.vue';
import { MODALS } from '../assets/js/modals/modalTypes';
import interact from 'interactjs';
import { EqualizerModalHandler } from '../assets/js/modals/equalizerModalHandler';
import { modalManager } from '../assets/js/modals/modalManager';

type EqualizerModeKey = 'equalizerMode1' | 'equalizerMode2' | 'equalizerMode3';

interface EqualizerBand {
    id: number;
    color: string;
    selectId: string;
    knobId: string;
    qualityLabelId: string;
}

const filterModes = [
    'lowpass', 'highpass', 'bandpass', 'lowshelf',
    'highshelf', 'peaking', 'notch', 'allpass'
];

const handler = modalManager.getHandler('equalizerModal') as EqualizerModalHandler;
const equalizerModeKeys: EqualizerModeKey[] = ['equalizerMode1', 'equalizerMode2', 'equalizerMode3'];
const bands: EqualizerBand[] = handler.circleColors.map((color, index) => ({
    id: index + 1,
    color,
    selectId: `equalizerModeSelect${index + 1}`,
    knobId: `qKnob${index + 1}`,
    qualityLabelId: `qualityLabel${index + 1}`,
}));
const isMounted = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const equalizerOverlayRef = ref<SVGSVGElement | null>(null);
const equalizerNodesRef = ref<Element[]>([]);

function getBandMode(index: number): string {
    return (handler[equalizerModeKeys[index]] as unknown as { value: string }).value;
}

function setBandMode(index: number, value: string) {
    (handler[equalizerModeKeys[index]] as unknown as { value: string }).value = value;
    handleModeChange(index);
}

onMounted(() => {
    handler.initializeAudio();
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    handler.setCanvasContext(ctx);
    drawCanvas(ctx);
    nextTick(() => {
        initInteract(ctx);
    });
    isMounted.value = true;
});

function initInteract(ctx: CanvasRenderingContext2D) {
    equalizerNodesRef.value.forEach((nodeEl, index) => {
        interact(nodeEl as HTMLElement).draggable({
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: equalizerOverlayRef.value!,
                }),
            ],
            onstart: () => {
                handler.setCurrentNode(index);
                drawCanvas(ctx);
            },
            onmove: (event) => {
                const target = event.target;
                if (!target) return;

                let x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
                let y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;

                x = Math.min(handler.CANVAS_WIDTH - 6, Math.max(x, 7));
                y = Math.min(handler.CANVAS_HEIGHT + handler.FREQUENCY_HEIGHT - 6, Math.max(y, 7));

                target.setAttribute('cx', x.toString());
                target.setAttribute('cy', y.toString());
                target.setAttribute('data-x', x.toString());
                target.setAttribute('data-y', y.toString());

                handler.updateNodePosition(parseInt(target.getAttribute('data-id')!, 10), x, y);
                drawCanvas(ctx);
            },
        });
    });
}

function handleModeChange(index: number) {
    const mode = getBandMode(index) as never;
    handler.setNodeType(index, mode);
    const ctx = canvasRef.value?.getContext('2d');
    if (ctx) {
        drawCanvas(ctx);
        handler.setCurrentNode(index);
    }
}

function qualityKnobRotate(angle: number, knobId: string) {
    const scaled = (angle / 360) * (handler.quality.max - handler.quality.min) + handler.quality.min;
    const nodeIndex = parseInt(knobId.replace('qKnob', ''), 10) - 1;
    handler.setNodeQuality(nodeIndex, scaled);
    const ctx = canvasRef.value?.getContext('2d');
    if (ctx) {
        drawCanvas(ctx);
        handler.setCurrentNode(nodeIndex);
    }
}

function drawCanvas(ctx: CanvasRenderingContext2D) {
    handler.clearCanvas(ctx);
    handler.drawFrequencyLines(ctx);
    if (handler.getCurrentNode() !== -1) {
        handler.drawLocalAttenuationCurve(ctx, handler.getCurrentNode());
    }
    handler.drawAttenuationCurve(ctx);
}
</script>

<style scoped>
:global(#equalizerModal) {
    background: #12151c;
    border: 1px solid #2a3039;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    overflow: hidden;
}
:global(#equalizerModal .modalTopBar) {
    min-height: 40px;
    height: auto;
    background: #181c24;
    border-bottom: 1px solid #2a3039;
    padding: 6px 10px 6px 0;
}
:global(#equalizerModal .modalTopBarLabel) {
    color: #c8ced8;
    font-size: 13px;
    font-weight: 600;
}
:global(#equalizerModal .modal_close .icon) { fill: #7a8494; stroke: #7a8494; }
:global(#equalizerModal .modal_close:hover .icon) { fill: #6ba8d4; stroke: #6ba8d4; }
:global(#equalizerModal .modalBody) {
    padding: 0;
    background: #12151c;
}

.eq-plugin {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    overflow: visible;
    background: #141820;
}

.eq-stage {
    border-radius: 6px;
    border: 1px solid #2a3039;
    background: #1a1f28;
    overflow: hidden;
}

.eq-canvas-wrap {
    position: relative;
    background: #141820;
    line-height: 0;
    padding: 8px;
}

#equalizerCanvas {
    display: block;
    border-radius: 4px;
    overflow: hidden;
}

#equalizerOverlay {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    pointer-events: none;
}

.eqNode {
    cursor: move;
    pointer-events: all;
    transition: r 0.12s ease;
}
.eqNode:hover {
    r: 10;
}

.freqLabel {
    fill: #6d7787;
    font-size: 9px;
    font-family: 'Roboto Mono', monospace, sans-serif;
}
.dbLabel {
    fill: #6d7787;
    font-size: 9px;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

.eq-controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 132px;
    align-items: stretch;
    gap: 8px;
    overflow: visible;
}

.eq-band {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 12px 10px;
    background: #1a1f28;
    border: 1px solid #2a3039;
    border-radius: 6px;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
}

.band-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}

.band-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.band-num {
    color: #c8ced8;
    font-size: 11px;
    font-weight: 600;
}

.ctrl-label {
    color: #8b939f;
    font-size: 10px;
    font-weight: 600;
    text-align: left;
    display: block;
    margin-top: 4px;
}

.band-select-wrap { width: 100%; }

.band-select {
    width: 100%;
    background: #141820;
    border: 1px solid #2a3039;
    border-radius: 4px;
    color: #c8ced8;
    font-size: 11px;
    font-weight: 500;
    padding: 6px 8px;
    outline: none;
    cursor: pointer;
    text-align: left;
}
.band-select:focus {
    border-color: var(--band-color);
}
.band-select option { background: #141820; color: #c8ced8; }

.band-knob-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    margin: 4px 0;
    min-height: 52px;
    border-radius: 4px;
    background: #141820;
    border: 1px solid #2a3039;
}

:deep(.band-knob-wrap div.knob) {
    transform: scale(1.42);
    transform-origin: center center;
    background: transparent !important;
    overflow: visible;
    box-shadow: none;
}

:deep(.band-knob-wrap .knobRing circle:first-child) {
    fill: #182335;
}

.knob-value {
    color: var(--band-color);
    font-size: 13px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
    text-align: left;
    display: block;
}

.eq-readout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 12px;
    background: #1a1f28;
    border: 1px solid #2a3039;
    border-radius: 6px;
    min-width: 0;
    gap: 10px;
}

.readout-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.readout-label {
    color: #8b939f;
    font-size: 10px;
    font-weight: 600;
}

.readout-value {
    color: #eef1f5;
    font-size: 15px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

.readout-unit {
    font-size: 10px;
    color: #6ba8d4;
    margin-left: 3px;
    font-weight: 600;
}

.readout-divider {
    width: 100%;
    height: 1px;
    background: #2a3039;
}

@media (max-width: 1080px) {
    .eq-controls {
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 760px) {
    .eq-controls {
        grid-template-columns: 1fr;
    }
}
</style>

