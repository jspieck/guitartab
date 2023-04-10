<template>
    <div id="equalizerModal" class="modal" role="alert">
        <div class="modalTopBar">
            <label class="modalTopBarLabel">Equalizer</label>
            <div class="modal_close">
                <div class="icon">
                    <svg viewBox="0 0 32 32">
                        <use xlink:href="#close-icon"></use>
                    </svg>
                </div>
            </div>
        </div>
        <div class="modalBody">
            <div id="equalizerContainer">
                <canvas id="equalizerCanvas" ref="canvasRef" :width="CANVAS_WIDTH + DECIBEL_WIDTH" :height="CANVAS_HEIGHT + FREQUENCY_HEIGHT"></canvas>
                <svg id="equalizerOverlay" ref="equalizerOverlayRef" :width="`${CANVAS_WIDTH + DECIBEL_WIDTH}px`" :height="`${CANVAS_HEIGHT + FREQUENCY_HEIGHT}px`">
                    <g>
                        <g v-for="(freq, i) in frequencyLines" :key="'freq-' + i">
                            <text :x="frequencyToXPos(freq)" y="13" text-anchor="middle">
                                {{ freq < 1000 ? freq : freq / 1000 + 'k' }} </text>
                            </g>
                        <g v-for="(db, i) in decibelLines" :key="'db-' + i">
                            <text v-if="i < decibelLines.length - 1" :x="CANVAS_WIDTH + 5"
                                :y="FREQUENCY_HEIGHT + (CANVAS_HEIGHT * i) / (decibelLines.length - 1) + 4"
                                text-anchor="center">
                                {{ db }}
                            </text>
                        </g>
                        <text :x="CANVAS_WIDTH + 5" :y="FREQUENCY_HEIGHT + CANVAS_HEIGHT" text-anchor="center">
                            {{ decibelLines[0] }}
                        </text>
                    </g>
                    <g>
                        <circle v-for="(frequency, index) in equalizerNodeFrequencies" :key="index"
                            :cx="frequencyToXPos(frequency)" :cy="FREQUENCY_HEIGHT + CANVAS_HEIGHT / 2"
                            :data-x="frequencyToXPos(frequency)" :data-y="FREQUENCY_HEIGHT + CANVAS_HEIGHT / 2"
                            :data-id="index" :r="7" :fill="circleColors[index]" :stroke="circleColors[index]"
                            ref="equalizerNodesRef"></circle>
                    </g>
                </svg>
            </div>
            <div id="fNodeContainer1" class="filterNodeContainer">
                <div class="filterNodeSetting">
                    <label class="modeLabel">Mode</label>
                    <div class="equalizerModeSelectBox select">
                        <select id="equalizerModeSelect1" v-model="equalizerMode1" @change="handleModeChange1">
                            <option value="lowpass">Lowpass</option>
                            <option value="highpass">Highpass</option>
                            <option value="bandpass">Bandpass</option>
                            <option value="lowshelf">Lowshelf</option>
                            <option value="highshelf">Highshelf</option>
                            <option value="peaking">Peaking</option>
                            <option value="notch">Notch</option>
                            <option value="allpass">Allpass</option>
                        </select>
                        <div class="select__arrow"></div>
                    </div>
                    <label class="qualityLabel">Quality (Q)</label>
                    <div id="qualityContainer1" class="knob qualityKnob" v-if="isMounted">
                        <Knob id="qKnob1" :data-id="1" :rotate-func="qualityKnobRotate" :start="quality.start"
                            :min="quality.min" :max="quality.max" :mid-knob="false"></Knob>
                    </div>

                    <label id="qualityLabel1">1.0</label>
                </div>
            </div>
            <div id="fNodeContainer2" class="filterNodeContainer">
                <div class="filterNodeSetting">
                    <label class="modeLabel">Mode</label>
                    <div class="equalizerModeSelectBox select">
                        <select id="equalizerModeSelect2" v-model="equalizerMode2" @change="handleModeChange2">
                            <option value="lowpass">Lowpass</option>
                            <option value="highpass">Highpass</option>
                            <option value="bandpass">Bandpass</option>
                            <option value="lowshelf">Lowshelf</option>
                            <option value="highshelf">Highshelf</option>
                            <option value="peaking">Peaking</option>
                            <option value="notch">Notch</option>
                            <option value="allpass">Allpass</option>
                        </select>
                        <div class="select__arrow"></div>
                    </div>
                    <label class="qualityLabel">Quality (Q)</label>
                    <div id="qualityContainer2" class="knob qualityKnob" v-if="isMounted">
                        <Knob id="qKnob2" :data-id="2" :rotate-func="qualityKnobRotate" :start="quality.start"
                            :min="quality.min" :max="quality.max" :mid-knob="false"></Knob>
                    </div>
                    <label id="qualityLabel2">1.0</label>
                </div>
            </div>
            <div id="fNodeContainer3" class="filterNodeContainer">
                <div class="filterNodeSetting">
                    <label class="modeLabel">Mode</label>
                    <div class="equalizerModeSelectBox select">
                        <select id="equalizerModeSelect3" v-model="equalizerMode3" @change="handleModeChange3">
                            <option value="lowpass">Lowpass</option>
                            <option value="highpass">Highpass</option>
                            <option value="bandpass">Bandpass</option>
                            <option value="lowshelf">Lowshelf</option>
                            <option value="highshelf">Highshelf</option>
                            <option value="peaking">Peaking</option>
                            <option value="notch">Notch</option>
                            <option value="allpass">Allpass</option>
                        </select>
                        <div class="select__arrow"></div>
                    </div>
                    <label class="qualityLabel">Quality (Q)</label>
                    <div id="qualityContainer3" class="knob qualityKnob" v-if="isMounted">
                        <Knob id="qKnob3" :data-id="3" :rotate-func="qualityKnobRotate" :start="quality.start"
                            :min="quality.min" :max="quality.max" :mid-knob="false"></Knob>
                    </div>
                    <label id="qualityLabel3">1.0</label>
                </div>
            </div>
            <div id="measureBox">
                <label>Frequency</label>
                <label id="eqCurrentFreq">{{ `${eqCurrentFreq} Hz` }}</label>
                <label>Gain</label>
                <label id="eqCurrentGain">{{ `${eqGain} db` }}</label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    onMounted,
    ref,
    Ref
} from 'vue';
import Knob from './Knob.vue';

import interact from 'interactjs';
import Settings from '../assets/js/settingManager';
import audioEngine from '../assets/js/audioEngine';

interface InteractEvent {
    target: HTMLElement,
    dx: number,
    dy: number
}

const audioCtx = audioEngine.context;

const CANVAS_WIDTH = 600;
const DECIBEL_WIDTH = 20;
const CANVAS_HEIGHT = 300;
const FREQUENCY_HEIGHT = 20;
const frequencyLines = [
    20,
    50,
    100,
    200,
    500,
    1000,
    2000,
    5000,
    10000,
    20000,
];
const decibelLines = [-18, -12, -6, 0, 6, 12, 18];
const circleColors = ['#89ca78', '#ef596f', '#e5c07b'];

let currentNode = -1;
let logarithmicMin = Math.log(frequencyLines[0]) / Math.LN10;
let logarithmicMax = Math.log(frequencyLines[frequencyLines.length - 1]) / Math.LN10;
let lowshelf = audioCtx.createBiquadFilter();
let mid = audioCtx.createBiquadFilter();
let highshelf = audioCtx.createBiquadFilter();
let quality = { start: 1, min: 0.5, max: 20 };
let reTimeOut: number | null = null;

const SAMPLERATE = 44100; // TODO get it
const equalizerNodes = [lowshelf, mid, highshelf];
const lowshelfFrequency = 40;
const midFrequency = 1000;
const highshelfFrequency = 15000;
const equalizerNodeFrequencies = [lowshelfFrequency, midFrequency, highshelfFrequency];

const eqGain = ref(0.0);
const eqCurrentFreq = ref('0.0');
const isMounted = ref(false);
const canvasRef: Ref<HTMLCanvasElement | null> = ref(null);
const equalizerOverlayRef = ref(null);
const equalizerNodesRef = ref([]);

onMounted(() => {
    const canvas = canvasRef.value;
    const equalizerOverlay = equalizerOverlayRef.value;
    if (!canvas || !equalizerOverlay) return

    const ctx = canvas.getContext('2d');
    clearCanvas(ctx!);
    drawFrequencyLines(ctx!);
    drawAttenuationCurve(ctx!);
    initInteract(ctx!);
    isMounted.value = true;
})

function initInteract(ctx: CanvasRenderingContext2D) {
    const equalizerNodeEls = equalizerNodesRef.value;
    equalizerNodeEls.forEach((nodeEl, index) => {
        interact(nodeEl).draggable({
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: equalizerOverlayRef.value!,
                }),
            ],
            onstart: () => {
                setCurrentNode(index, ctx);
            },
            onmove: (event) => {
                moveEqualizerNode(event, ctx);
            },
        });
    });
}

const equalizerMode1 = ref("highpass");
const equalizerMode2 = ref("peaking");
const equalizerMode3 = ref("lowpass");

const handleModeChange1 = () => {
    lowshelf.type = equalizerMode1.value as BiquadFilterType;
    const canvas = canvasRef.value;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        redraw(ctx!);
        setCurrentNode(0, ctx!);
    }
};

const handleModeChange2 = () => {
    mid.type = equalizerMode2.value as BiquadFilterType;
    const canvas = canvasRef.value;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        redraw(ctx!);
        setCurrentNode(1, ctx!);
    }
};

const handleModeChange3 = () => {
    highshelf.type = equalizerMode3.value as BiquadFilterType;
    const canvas = canvasRef.value;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        redraw(ctx!);
        setCurrentNode(2, ctx!);
    }
};

function insertBetween(audioNodeBefore: AudioNode, audioNodeAfter: AudioNode) {
    equalizerNodes[0] = lowshelf;
    equalizerNodes[1] = mid;
    equalizerNodes[2] = highshelf;

    lowshelf.type = 'lowshelf';
    mid.type = 'peaking';
    highshelf.type = 'highshelf';

    lowshelf.frequency.value = lowshelfFrequency;
    mid.frequency.value = midFrequency;
    highshelf.frequency.value = highshelfFrequency;

    audioNodeBefore.connect(lowshelf);
    lowshelf.connect(mid);
    mid.connect(highshelf);
    highshelf.connect(audioNodeAfter);

    const canvas = canvasRef.value;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        redraw(ctx!);
    }
}

function setCurrentNode(id: number, ctx: CanvasRenderingContext2D) {
    currentNode = id;
    if (reTimeOut != null) {
        clearTimeout(reTimeOut);
    }
    reTimeOut = setTimeout(() => {
        currentNode = -1;
        redraw(ctx);
    }, 1000);
}

function qualityKnobRotate(angle: number, knobId: string, parentId: string) {
    const scaled = (angle / 360) * (quality.max - quality.min) + quality.min;
    if (knobId === '1') {
        // low
        lowshelf.Q.value = scaled;
        // document.getElementById('qualityLabel1')!.textContent = scaled.toFixed(2);
    } else if (knobId === '2') {
        // mid
        mid.Q.value = scaled;
        // document.getElementById('qualityLabel2')!.textContent = scaled.toFixed(2);
    } else if (knobId === '3') {
        // high
        highshelf.Q.value = scaled;
        // document.getElementById('qualityLabel3')!.textContent = scaled.toFixed(2);
    }
    const canvas = canvasRef.value;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        setCurrentNode(parseInt(knobId, 10) - 1, ctx!);
        redraw(ctx!);
    }
}

function drawLine(ctx: CanvasRenderingContext2D, xStart: number, yStart: number, xEnd: number, yEnd: number) {
    if (ctx != null) {
        if (Settings.darkMode) {
            ctx.strokeStyle = 'rgb(79, 79, 79)';
        } else {
            ctx.strokeStyle = 'rgb(179, 179, 179)';
        }
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
    }
}

function frequencyToXPos(freq: number): number {
    const logarithmicValue = Math.log(freq) / Math.LN10;
    return (
        ((logarithmicValue - logarithmicMin)
            / (logarithmicMax - logarithmicMin))
        * CANVAS_WIDTH
    );
}

function xPosToFrequency(xPos: number): number {
    const val = (xPos / CANVAS_WIDTH) * (logarithmicMax - logarithmicMin)
        + logarithmicMin;
    return 10 ** val;
}

function yPosToDb(yPos: number): number {
    return (
        ((yPos - FREQUENCY_HEIGHT - CANVAS_HEIGHT / 2) / (CANVAS_HEIGHT / 2))
        * -18
    );
}

function drawFrequencyLines(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < frequencyLines.length; i += 1) {
        const xPos = frequencyToXPos(frequencyLines[i]);
        drawLine(ctx, xPos, FREQUENCY_HEIGHT, xPos, CANVAS_HEIGHT + FREQUENCY_HEIGHT);
    }
    for (let i = 0; i < decibelLines.length; i += 1) {
        const yPos = FREQUENCY_HEIGHT + (CANVAS_HEIGHT * i)
            / (decibelLines.length - 1);
        drawLine(ctx, 0, yPos, CANVAS_WIDTH, yPos);
    }
}

function clearCanvas(ctx: CanvasRenderingContext2D): void {
    if (Settings.darkMode) {
        ctx.fillStyle = '#202020';
    } else {
        ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(
        0,
        0,
        CANVAS_WIDTH + DECIBEL_WIDTH,
        CANVAS_HEIGHT + FREQUENCY_HEIGHT,
    );
    if (Settings.darkMode) {
        ctx.fillStyle = '#212121';
    } else {
        ctx.fillStyle = '#fff';
    }
    ctx.fillRect(
        0,
        FREQUENCY_HEIGHT,
        CANVAS_WIDTH,
        CANVAS_HEIGHT + FREQUENCY_HEIGHT,
    );
}

function moveEqualizerNode(event: InteractEvent, ctx: CanvasRenderingContext2D) {
    const target = event.target as HTMLElement;
    if (target != null) {
        let x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
        let y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;
        x = Math.min(594, Math.max(x, 7));
        y = Math.min(314, Math.max(y, 7));
        // translate the element
        target.setAttribute('cx', x.toString());
        target.setAttribute('cy', y.toString());

        // compute new values
        const id = parseInt(target.getAttribute('data-id')!, 10);
        // console.log(x+" "+xPosToFrequency(x) +"Hz");
        const frequency = xPosToFrequency(x);
        const db = yPosToDb(y);
        // const gain = 2 ** (db / 6);
        equalizerNodes[id].frequency.value = frequency;
        equalizerNodes[id].gain.value = db;

        let intFreq = Math.round(frequency);
        let intFreqString = intFreq.toString();
        if (intFreq > 1000) {
            intFreq = Math.round(intFreq / 100);
            intFreqString = `${intFreq / 10}k`;
        }
        eqCurrentFreq.value = intFreqString;
        eqGain.value = Number(db.toFixed(2));
        setCurrentNode(id, ctx);
        redraw(ctx);
        // update the posiion attributes
        target.setAttribute('data-x', x.toString());
        target.setAttribute('data-y', y.toString());
    }
}

function computeAttenuationPoints(
    frequencies: Float32Array, magnitudes: Float32Array,
): { x: number, y: number }[] {
    const points = [];
    for (let i = 0; i < frequencies.length; i += 1) {
        const x = frequencyToXPos(frequencies[i]);
        const y = FREQUENCY_HEIGHT
            + CANVAS_HEIGHT / 2
            - ((CANVAS_HEIGHT / 2) * magnitudes[i]) / 18;
        points[i] = { x, y };
    }
    return points;
}

function drawAttenuationCurve(ctx: CanvasRenderingContext2D): void {
    const RESOLUTION = 200;
    const frequencyArray = new Float32Array(RESOLUTION);
    // Set the frequencies at the given points
    for (let i = 0; i < RESOLUTION; i += 1) {
        frequencyArray[i] = xPosToFrequency(
            (i / (RESOLUTION - 1)) * CANVAS_WIDTH,
        );
        if (i > 0) {
            if (
                frequencyArray[i] >= equalizerNodes[0].frequency.value
                && frequencyArray[i - 1] < equalizerNodes[0].frequency.value
            ) {
                frequencyArray[i] = equalizerNodes[0].frequency.value;
            }
            if (
                frequencyArray[i] >= equalizerNodes[1].frequency.value
                && frequencyArray[i - 1] < equalizerNodes[1].frequency.value
            ) {
                frequencyArray[i] = equalizerNodes[1].frequency.value;
            }
            if (
                frequencyArray[i] >= equalizerNodes[2].frequency.value
                && frequencyArray[i - 1] < equalizerNodes[2].frequency.value
            ) {
                frequencyArray[i] = equalizerNodes[2].frequency.value;
            }
        }
    }

    const magAccumulated = new Float32Array(RESOLUTION);
    const numNodes = equalizerNodes.length;
    for (let j = 0; j < numNodes; j += 1) {
        const magResponseOutput = new Float32Array(RESOLUTION);
        const phaseResponseOutput = new Float32Array(RESOLUTION);
        equalizerNodes[j].getFrequencyResponse(
            frequencyArray,
            magResponseOutput,
            phaseResponseOutput,
        );
        // console.log(magResponseOutput);
        for (let i = 0; i < RESOLUTION; i += 1) {
            magAccumulated[i] += 9 * Math.log(magResponseOutput[i]);
        }
    }

    ctx.strokeStyle = 'none';
    ctx.strokeStyle = '#2196F3'; // rgba(51, 142, 32, 0.66)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = computeAttenuationPoints(frequencyArray, magAccumulated);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < RESOLUTION - 1; i += 1) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = 1;
    // console.log(magResponseOutput);
}

function drawLocalAttenuationCurve(ctx: CanvasRenderingContext2D, id: number) {
    // console.log(id);
    const RESOLUTION = 50;
    const frequencyArray = new Float32Array(RESOLUTION);
    // Set the frequencies at the given points
    for (let i = 0; i < RESOLUTION; i += 1) {
        frequencyArray[i] = xPosToFrequency(
            (i / (RESOLUTION - 1)) * CANVAS_WIDTH,
        );
        if (
            i > 0
            && frequencyArray[i] >= equalizerNodes[0].frequency.value
            && frequencyArray[i - 1] < equalizerNodes[0].frequency.value
        ) {
            frequencyArray[i] = equalizerNodes[0].frequency.value;
        }
        if (
            i > 0
            && frequencyArray[i] >= equalizerNodes[1].frequency.value
            && frequencyArray[i - 1] < equalizerNodes[1].frequency.value
        ) {
            frequencyArray[i] = equalizerNodes[1].frequency.value;
        }
        if (
            i > 0
            && frequencyArray[i] >= equalizerNodes[2].frequency.value
            && frequencyArray[i - 1] < equalizerNodes[2].frequency.value
        ) {
            frequencyArray[i] = equalizerNodes[2].frequency.value;
        }
    }
    const magAccumulated = new Float32Array(RESOLUTION);
    const magResponseOutput = new Float32Array(RESOLUTION);
    const phaseResponseOutput = new Float32Array(RESOLUTION);
    equalizerNodes[id].getFrequencyResponse(
        frequencyArray,
        magResponseOutput,
        phaseResponseOutput,
    );
    // console.log(magResponseOutput);
    for (let i = 0; i < RESOLUTION; i += 1) {
        magAccumulated[i] = 9 * Math.log(magResponseOutput[i]);
    }
    // console.log(magAccumulated);

    // NOW DRAW CURVE
    ctx.strokeStyle = 'none';
    if (id === 0) {
        ctx.strokeStyle = 'rgb(116, 176, 103)'; // rgba(51, 142, 32, 0.66)';
    } else if (id === 1) {
        ctx.strokeStyle = 'rgb(213, 107, 107)';
    } else {
        ctx.strokeStyle = 'rgb(234, 191, 114)';
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = computeAttenuationPoints(frequencyArray, magAccumulated);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < RESOLUTION - 1; i += 1) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = 1;
    // console.log(magResponseOutput);
}

function redraw(ctx: CanvasRenderingContext2D): void {
    clearCanvas(ctx);
    drawFrequencyLines(ctx);
    if (currentNode !== -1) {
        drawLocalAttenuationCurve(ctx, currentNode);
    }
    drawAttenuationCurve(ctx);
}

function pointToXY(points: Uint8Array, index: number): { x: number, y: number } {
    const fftSize = points.length;
    const y = FREQUENCY_HEIGHT
        + CANVAS_HEIGHT
        - ((CANVAS_HEIGHT / 2) * points[index]) / 256; // set it to 0 db
    let x = (index * SAMPLERATE) / fftSize;

    if (
        x < frequencyLines[0]
        || x > frequencyLines[frequencyLines.length - 1]
    ) {
        return { x: -1, y: -1 };
    }
    // logarithmize
    x = frequencyToXPos(x);
    // console.log(index, x, y);
    return { x, y };
}

function drawSpectrum(ctx: CanvasRenderingContext2D, frequencyArray: Uint8Array) {
    redraw(ctx);

    const points = [];
    for (let i = 0; i < frequencyArray.length; i += 1) {
        const pointValue = pointToXY(frequencyArray, i);
        if (pointValue.x !== -1 && pointValue.y !== -1) {
            points.push(pointValue);
        }
    }
    ctx.strokeStyle = 'rgba(49, 88, 193, 0.5)';
    ctx.fillStyle = 'rgba(49, 88, 193, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, points[0].y);
    ctx.lineTo(points[0].x, points[0].y);
    let i;
    for (i = 1; i < points.length - 2; i += 1) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    // curve through the last two points
    ctx.quadraticCurveTo(
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y,
    );
    ctx.lineTo(CANVAS_WIDTH, points[i + 1].y);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT + FREQUENCY_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT + FREQUENCY_HEIGHT);
    ctx.stroke();
    ctx.fill();
}

defineExpose({
    equalizerNodeFrequencies,
    frequencyLines,
    decibelLines,
    canvasRef,
    equalizerOverlayRef,
    isMounted,
    equalizerMode1,
    equalizerMode2,
    equalizerMode3,
    handleModeChange1,
    handleModeChange2,
    handleModeChange3,
    insertBetween
});
</script>