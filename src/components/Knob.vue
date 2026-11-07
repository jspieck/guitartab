<template>
    <div class="knob-root">
        <svg :id="id" :data-id="dataId" class="knobRing" @pointerdown="knobRotateFunc"
            :data-angle="startAngle">
            <circle :cx="cx" :cy="cy" :r="radiusInner" stroke="transparent" stroke-width="1" style="fill: var(--gray-700)"></circle>
            <rect :x="cx - 1" :y="pointerY" :width="pointerWidth" :height="pointerHeight" stroke="none"
                style="fill: var(--gray-0)" :id="`${id}Pointer`" :rx="1" :ry="1"
                :transform="`rotate(${startAngle - 90}, ${cx}, ${cy})`"></rect>
            <circle :cx="cx" :cy="cy" :r="radiusOuter" style="stroke: var(--blue-600)" stroke-width="2" fill="transparent"
                :id="`outerRing${id}`" :stroke-dasharray="`${dashValue} ${dashValue}`"
                :stroke-dashoffset="strokeDashOffset"></circle>
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    id: string;
    dataId: number;
    rotateFunc: (angle: number, dataIdFunc: string, targetId: string) => void;
    start: number;
    min: number;
    max: number;
    midKnob: boolean;
}>();

const cx = 11;
const cy = 11;
const radiusInner = 10;
const radiusOuter = 12;
const pointerWidth = 2;
const pointerHeight = 3;

let functionToExecuteOnRotate: (angle: number, dataId: string, targetId: string) => void = () => { };
let moveFuncTmp: (e: PointerEvent) => void = () => { };
let mouseUpFuncTmp: (e: PointerEvent) => void = () => { };
let functionParameters: PointerEvent | null = null;
/** The knob's svg (the pointer may have gone down on one of its circles). */
let knobElement: HTMLElement | null = null;
let previousAngle = 0;

const startAngle = computed(() =>
    ((props.start - props.min) / (props.max - props.min)) * 360,
);

const pointerY = computed(() => (props.midKnob ? 3 : 14));

function getCircumference(): number {
    return 2 * radiusOuter * Math.PI;
}

const dashValue = computed(() => getCircumference());

const currentAngle = ref(startAngle.value);
// Follow the value when it changes from outside (track switch, undo, a loaded song).
watch(startAngle, (angle) => {
    currentAngle.value = angle;
});

const strokeDashOffset = computed(() => {
    if (props.midKnob) {
        return dashValue.value - dashValue.value * ((currentAngle.value - 180) / 360);
    } else {
        return dashValue.value - dashValue.value * (currentAngle.value / 360);
    }
});

function removeEventListeners() {
    document.body.classList.remove('disableMouseEffects');
    document.removeEventListener('pointermove', moveFuncTmp);
    document.removeEventListener('pointerup', mouseUpFuncTmp);
    document.removeEventListener('pointercancel', mouseUpFuncTmp);
}

function knobRotationHandler(e: PointerEvent) {
    if (functionParameters != null && knobElement != null) {
        const domTarget: HTMLElement = knobElement;
        const dataId = domTarget.getAttribute('data-id')!;
        const initYPos = functionParameters.pageY;
        const mouseYnew = e.pageY;

        let angle = previousAngle + (initYPos - mouseYnew) * 3;
        angle = Math.min(angle, 360);
        angle = Math.max(angle, 0);

        currentAngle.value = angle;

        functionToExecuteOnRotate(angle, dataId, domTarget.id);

        domTarget.setAttribute('data-angle', angle.toString());
        const pointerDom = document.getElementById(`${domTarget.id}Pointer`);
        pointerDom?.setAttribute('transform', `rotate(${angle - 90}, 11, 11)`);
    }
}

function knobRotateFuncInner(
    functionToExecute: (angle: number, dataId: string, targetId: string) => void,
    functionEvent: PointerEvent,
) {
    // Pointer events: a finger turns the knob like the mouse (touch-action: none below).
    functionEvent.preventDefault();
    document.body.classList.add('disableMouseEffects');
    // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
    functionToExecuteOnRotate = functionToExecute;
    functionParameters = functionEvent;
    knobElement = functionEvent.currentTarget as HTMLElement;
    const target = knobElement;
    const previousAngleStr = target.getAttribute('data-angle');
    if (previousAngleStr == null) {
        previousAngle = 0;
    } else {
        previousAngle = parseInt(previousAngleStr, 10);
    }

    moveFuncTmp = knobRotationHandler;
    mouseUpFuncTmp = removeEventListeners;

    document.addEventListener('pointermove', moveFuncTmp);
    document.addEventListener('pointerup', mouseUpFuncTmp);
    document.addEventListener('pointercancel', mouseUpFuncTmp);
}

const knobRotateFunc = (event: PointerEvent) => knobRotateFuncInner(props.rotateFunc, event);
</script>

<style scoped>
/* A finger drag turns the knob instead of scrolling the page. */
.knobRing {
    touch-action: none;
}
</style>
