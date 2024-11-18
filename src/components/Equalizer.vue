<template>
    <BaseModal :modal-id="MODALS.EQUALIZER.id">
        <template #title>Equalizer</template>
        <div id="equalizerContainer">
            <canvas id="equalizerCanvas" ref="canvasRef" 
                :width="handler.CANVAS_WIDTH + handler.DECIBEL_WIDTH"
                :height="handler.CANVAS_HEIGHT + handler.FREQUENCY_HEIGHT">
            </canvas>
            <svg id="equalizerOverlay" ref="equalizerOverlayRef" 
                :width="`${handler.CANVAS_WIDTH + handler.DECIBEL_WIDTH}px`"
                :height="`${handler.CANVAS_HEIGHT + handler.FREQUENCY_HEIGHT}px`">
                <g>
                    <g v-for="(freq, i) in handler.frequencyLines" :key="'freq-' + i">
                        <text :x="handler.frequencyToXPos(freq)" y="13" text-anchor="middle" class="frequencyText">
                            {{ freq < 1000 ? freq : freq / 1000 + 'k' }}
                        </text>
                    </g>
                    <g v-for="(db, i) in handler.decibelLines" :key="'db-' + i">
                        <text v-if="i < handler.decibelLines.length - 1" 
                            :x="handler.CANVAS_WIDTH + 5"
                            :y="handler.FREQUENCY_HEIGHT + (handler.CANVAS_HEIGHT * i) / (handler.decibelLines.length - 1) + 4"
                            text-anchor="center"
                            class="decibelText">
                            {{ db }}
                        </text>
                    </g>
                    <text :x="handler.CANVAS_WIDTH + 5" 
                        :y="handler.FREQUENCY_HEIGHT + handler.CANVAS_HEIGHT" 
                        text-anchor="center">
                        {{ handler.decibelLines[0] }}
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
                        :r="7" 
                        :fill="handler.circleColors[index]" 
                        :stroke="handler.circleColors[index]"
                        class="equalizerNode"
                        ref="equalizerNodesRef">
                    </circle>
                </g>
            </svg>
        </div>

        <div v-for="i in 3" :key="i" :id="`fNodeContainer${i}`" class="filterNodeContainer">
            <div class="filterNodeSetting">
                <label class="modeLabel">Mode</label>
                <div class="equalizerModeSelectBox select">
                    <select :id="`equalizerModeSelect${i}`" 
                        v-model="handler[`equalizerMode${i}` as keyof EqualizerModalHandler]" 
                        @change="handleModeChange(i-1)">
                        <option v-for="mode in filterModes" :key="mode" :value="mode">
                            {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
                        </option>
                    </select>
                    <div class="select__arrow"></div>
                </div>
                <label class="qualityLabel">Quality (Q)</label>
                <div :id="`qualityContainer${i}`" class="knob qualityKnob" v-if="isMounted">
                    <Knob :id="`qKnob${i}`" 
                        :data-id="i" 
                        :rotate-func="qualityKnobRotate" 
                        :start="handler.quality.start"
                        :min="handler.quality.min" 
                        :max="handler.quality.max" 
                        :mid-knob="false">
                    </Knob>
                </div>
                <label :id="`qualityLabel${i}`">1.0</label>
            </div>
        </div>

        <div id="measureBox">
            <label>Frequency</label>
            <label id="eqCurrentFreq">{{ `${handler.eqCurrentFreq.value} Hz` }}</label>
            <label>Gain</label>
            <label id="eqCurrentGain">{{ `${handler.eqGain.value} db` }}</label>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref, Ref, nextTick } from 'vue';
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
const equalizerOverlayRef = ref(null);
const equalizerNodesRef = ref([]);

onMounted(() => {
    handler.initializeAudio();
    const canvas = canvasRef.value;
    const equalizerOverlay = equalizerOverlayRef.value;
    if (!canvas || !equalizerOverlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCanvas(ctx);
    nextTick(() => {
        initInteract(ctx);
    });
    isMounted.value = true;
});

function initInteract(ctx: CanvasRenderingContext2D) {
    const equalizerNodes = equalizerNodesRef.value;
    console.log("InteractRes", equalizerNodes);
    equalizerNodes.forEach((nodeEl, index) => {
        console.log("NodeEl", nodeEl, index);
        interact(nodeEl).draggable({
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: equalizerOverlayRef.value!,
                }),
            ],
            onstart: () => {
                console.log('onstart');
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

                const id = parseInt(target.getAttribute('data-id')!, 10);
                handler.updateNodePosition(id, x, y);
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
.frequencyText {
    color: #fff;
}
.decibelText {
    color: #fff;
}
.equalizerNode {
    cursor: move;
}
</style>
