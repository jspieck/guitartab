<template>
    <div>
        <svg :id="id" :data-id="dataId" class="knobRing" @mousedown="knobRotateFunc"
            :data-angle="startAngle">
            <circle :cx="cx" :cy="cy" :r="radiusInner" :stroke="strokeInner" stroke-width="1" :fill="fillInner"></circle>
            <rect :x="cx - 1" :y="pointerY" :width="pointerWidth" :height="pointerHeight" stroke="none"
                :fill="pointerFill" :id="`${id}Pointer`" :rx="1" :ry="1"
                :transform="`rotate(${startAngle - 90}, ${cx}, ${cy})`"></rect>
            <circle :cx="cx" :cy="cy" :r="radiusOuter" :stroke="strokeOuter" stroke-width="2" fill="transparent"
                :id="`outerRing${id}`" :stroke-dasharray="`${dashValue} ${dashValue}`"
                :stroke-dashoffset="strokeDashOffset"></circle>
        </svg>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, SetupContext } from 'vue';

interface CreateKnobProps {
    id: string;
    dataId: number;
    rotateFunc: (angle: number, dataIdFunc: string, targetId: string) => void;
    start: number;
    min: number;
    max: number;
    midKnob: boolean;
}

export default defineComponent({
    name: 'Knob',
    props: {
        id: {
            type: String,
            required: true,
        },
        dataId: {
            type: Number,
            required: true,
        },
        rotateFunc: {
            type: Function,
            required: true,
        },
        start: {
            type: Number,
            required: true,
        },
        min: {
            type: Number,
            required: true,
        },
        max: {
            type: Number,
            required: true,
        },
        midKnob: {
            type: Boolean,
            required: true,
        },
    },
    setup(props: CreateKnobProps, _context: SetupContext) {
        const cx = 11;
        const cy = 11;
        const radiusInner = 10;
        const radiusOuter = 12;
        const strokeInner = 'transparent';
        const strokeOuter = '#226aa9';
        const fillInner = '#3e3e3e';
        const pointerFill = '#ffffff';
        const pointerWidth = 2;
        const pointerHeight = 3;

        let functionToExecuteOnRotate: (angle: number, dataId: string, targetId: string) => void = () => { };
        let moveFuncTmp: (e: MouseEvent) => void = () => { };
        let mouseUpFuncTmp: (e: MouseEvent) => void = () => { };
        let functionParameters: MouseEvent | null = null;
        let previousAngle = 0;

        const startAngle = computed(() =>
            ((props.start - props.min) / (props.max - props.min)) * 360,
        );

        const pointerY = computed(() => (props.midKnob ? 3 : 14));

        const dashValue = computed(() => 2 * radiusOuter * Math.PI);

        const strokeDashOffset = computed(() => {
            if (props.midKnob) {
                return dashValue.value - dashValue.value * ((startAngle.value - 180) / 360);
            } else {
                return dashValue.value - dashValue.value * (startAngle.value / 360);
            }
        });

        function getCircumference(): number {
            return 2 * radiusOuter * Math.PI;
        }

        function removeEventListeners() {
            document.body.classList.remove('disableMouseEffects');
            document.removeEventListener('mousemove', moveFuncTmp);
            document.removeEventListener('mouseup', mouseUpFuncTmp);
        }

        function knobRotationHandler(e: MouseEvent) {
            if (functionParameters != null) {
                const domTarget: HTMLElement = functionParameters.target as HTMLElement;
                const dataId = domTarget.getAttribute('data-id')!;
                const initYPos = functionParameters.pageY;
                const mouseYnew = e.pageY;

                let angle = previousAngle + (initYPos - mouseYnew) * 3;
                angle = Math.min(angle, 360);
                angle = Math.max(angle, 0);

                functionToExecuteOnRotate(angle, dataId, domTarget.id);

                domTarget.setAttribute('data-angle', angle.toString());
                const pointerDom = document.getElementById(`${domTarget.id}Pointer`);
                pointerDom?.setAttribute('transform', `rotate(${angle - 90}, 11, 11)`);
            }
        }

        function knobRotateFuncInner(
            functionToExecute: (angle: number, dataId: string, targetId: string) => void,
            functionEvent: MouseEvent,
        ) {
            console.log(functionToExecute, functionEvent);
            document.body.classList.add('disableMouseEffects');
            // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
            functionToExecuteOnRotate = functionToExecute;
            functionParameters = functionEvent;
            const target = functionParameters.target as HTMLElement;
            const previousAngleStr = target.getAttribute('data-angle');
            if (previousAngleStr == null) {
                previousAngle = 0;
            } else {
                previousAngle = parseInt(previousAngleStr, 10);
            }

            moveFuncTmp = knobRotationHandler;
            mouseUpFuncTmp = removeEventListeners;

            document.addEventListener('mousemove', moveFuncTmp);
            document.addEventListener('mouseup', mouseUpFuncTmp);
        }

        return {
            cx,
            cy,
            radiusInner,
            radiusOuter,
            strokeInner,
            strokeOuter,
            fillInner,
            pointerFill,
            pointerWidth,
            pointerHeight,
            startAngle,
            pointerY,
            dashValue,
            strokeDashOffset,
            getCircumference,
            knobRotateFunc: (event: MouseEvent) => knobRotateFuncInner(props.rotateFunc, event),
        };
},
});
</script>