<template>
    <BaseModal :modal-id="MODALS.EQUALIZER.id">
        <template #title>
            <span class="eq-badge">EQ</span>
            Parametric Equalizer
        </template>
        <div class="eq-plugin">
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

            <div class="eq-controls">
                <div v-for="i in 3" :key="i" class="eq-band" :style="{ '--band-color': handler.circleColors[i - 1] }">
                    <div class="band-header">
                        <span class="band-dot"></span>
                        <span class="band-num">Band {{ i }}</span>
                    </div>
                    <label class="ctrl-label">MODE</label>
                    <div class="band-select-wrap">
                        <select :id="`equalizerModeSelect${i}`"
                            :value="(handler[`equalizerMode${i}` as keyof EqualizerModalHandler] as any).value"
                            @change="(e: Event) => { (handler[`equalizerMode${i}` as keyof EqualizerModalHandler] as any).value = (e.target as HTMLSelectElement).value; handleModeChange(i - 1); }"
                            class="band-select">
                            <option v-for="mode in filterModes" :key="mode" :value="mode">
                                {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
                            </option>
                        </select>
                    </div>
                    <label class="ctrl-label">Q FACTOR</label>
                    <div class="band-knob-wrap" v-if="isMounted">
                        <div class="knob">
                            <Knob :id="`qKnob${i}`" :data-id="i" :rotate-func="qualityKnobRotate"
                                :start="handler.quality.start" :min="handler.quality.min"
                                :max="handler.quality.max" :mid-knob="false" />
                        </div>
                    </div>
                    <label :id="`qualityLabel${i}`" class="knob-value">1.0</label>
                </div>

                <div class="eq-readout">
                    <div class="readout-group">
                        <span class="readout-label">FREQ</span>
                        <span class="readout-value">{{ handler.eqCurrentFreq.value }}<span class="readout-unit">Hz</span></span>
                    </div>
                    <div class="readout-divider"></div>
                    <div class="readout-group">
                        <span class="readout-label">GAIN</span>
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

const filterModes = [
    'lowpass', 'highpass', 'bandpass', 'lowshelf',
    'highshelf', 'peaking', 'notch', 'allpass'
];

const handler = modalManager.getHandler('equalizerModal') as EqualizerModalHandler;
const isMounted = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const equalizerOverlayRef = ref<SVGSVGElement | null>(null);
const equalizerNodesRef = ref<Element[]>([]);

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
    const mode = handler[`equalizerMode${index + 1}` as keyof EqualizerModalHandler] as BiquadFilterType;
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
/* ── Modal chrome ── */
:deep(#equalizerModal) {
    background: #080b12;
    border: 1px solid #1a2240;
    border-radius: 6px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7), 0 0 1px rgba(100, 160, 255, 0.15);
    overflow: hidden;
}
:deep(#equalizerModal .modalTopBar) {
    background: linear-gradient(180deg, #0e1220 0%, #090c16 100%);
    border-bottom: 1px solid #1a2240;
    padding: 6px 10px;
}
:deep(#equalizerModal .modalTopBarLabel) { color: #7b8faa; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }
:deep(#equalizerModal .modal_close .icon) { fill: #3a4a60; stroke: #3a4a60; }
:deep(#equalizerModal .modal_close:hover .icon) { fill: #7b8faa; stroke: #7b8faa; }
:deep(#equalizerModal .modalBody) {
    padding: 0;
    background: #080b12;
}

.eq-badge {
    display: inline-block;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: #fff;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.14em;
    padding: 2px 7px;
    border-radius: 2px;
    margin-right: 8px;
    vertical-align: middle;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.eq-plugin {
    display: flex;
    flex-direction: column;
    overflow: visible;
}

/* ── Canvas area ── */
.eq-canvas-wrap {
    position: relative;
    background: #0a0e18;
    border-bottom: 1px solid #151d30;
    line-height: 0;
    padding: 0;
    box-shadow: inset 0 -4px 12px rgba(0, 0, 0, 0.4);
}

#equalizerCanvas { display: block; }

#equalizerOverlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 5;
    pointer-events: none;
}

.eqNode {
    cursor: move;
    pointer-events: all;
    transition: r 0.15s ease;
    filter: drop-shadow(0 0 3px var(--band-color, #3b82f6));
}
.eqNode:hover { r: 10; }

.freqLabel {
    fill: #2e3d55;
    font-size: 10px;
    font-family: 'Roboto Mono', monospace, sans-serif;
}
.dbLabel {
    fill: #2e3d55;
    font-size: 10px;
    font-family: 'Roboto Mono', monospace, sans-serif;
}

/* ── Controls row ── */
.eq-controls {
    display: flex;
    align-items: stretch;
    background: linear-gradient(180deg, #0a0e16 0%, #070a10 100%);
    padding: 14px 14px 16px;
    gap: 8px;
    overflow: visible;
}

/* ── Band card ── */
.eq-band {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 12px 16px;
    background: linear-gradient(180deg, rgba(16, 21, 32, 0.5) 0%, rgba(12, 16, 26, 0.5) 100%);
    border: 1px solid #182040;
    border-radius: 5px;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    position: relative;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.03),
        0 2px 8px rgba(0, 0, 0, 0.3);
}
.eq-band::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 10%, var(--band-color) 50%, transparent 90%);
    border-radius: 5px 5px 0 0;
    opacity: 0.9;
}

.band-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
}

.band-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--band-color);
    box-shadow: 0 0 6px var(--band-color), 0 0 12px color-mix(in srgb, var(--band-color) 40%, transparent);
    flex-shrink: 0;
}

.band-num {
    color: #b0c0d5;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.ctrl-label {
    color: #7088a8;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    display: block;
    margin-top: 6px;
}

.band-select-wrap { width: 100%; }

.band-select {
    width: 100%;
    background: #0c1020;
    border: 1px solid #1d2845;
    border-radius: 3px;
    color: #8cb0d4;
    font-size: 10px;
    font-weight: 500;
    padding: 4px 6px;
    outline: none;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.2s;
}
.band-select:focus { border-color: var(--band-color); }
.band-select option { background: #0c1020; color: #8cb0d4; }

/* ── Knob area ── */
.band-knob-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    margin: 6px 0 4px;
    min-height: 48px;
}

:deep(.band-knob-wrap div.knob) {
    transform: scale(1.5);
    transform-origin: center center;
    background: transparent !important;
    overflow: visible;
    box-shadow: none;
}

:deep(.band-knob-wrap .knobRing circle:first-child) {
    fill: #181e2c;
}

.knob-value {
    color: var(--band-color);
    font-size: 12px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
    text-align: center;
    display: block;
    text-shadow: 0 0 8px color-mix(in srgb, var(--band-color) 30%, transparent);
}

/* ── Readout panel ── */
.eq-readout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 12px 20px;
    background: #070a10;
    border: 1px solid #182040;
    border-radius: 5px;
    min-width: 110px;
    gap: 12px;
    margin-left: 4px;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.02),
        inset 0 0 20px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.3);
}

.readout-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
}

.readout-label {
    color: #5a7090;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.readout-value {
    color: #60d4ff;
    font-size: 16px;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace, sans-serif;
    text-shadow: 0 0 10px rgba(96, 212, 255, 0.25);
}

.readout-unit {
    font-size: 9px;
    color: #3a5070;
    margin-left: 2px;
    font-weight: 500;
}

.readout-divider {
    width: 36px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #1a2545, transparent);
}
</style>

