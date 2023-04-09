<template>
    <div id="compressorModal" class="modal" role="alert">
        <div class="modalTopBar">
            <label class="modalTopBarLabel">Compressor</label>
            <div class="modal_close">
                <div class="icon">
                    <svg viewBox="0 0 32 32">
                        <use xlink:href="#close-icon"></use>
                    </svg>
                </div>
            </div>
        </div>
        <div class="modalBody">
            <div class="knobBox">
                <label class="qualityLabel">Attack</label>
                <div id="attackKnobContainer" class="knob qualityKnob">
                    <Knob id="attackKnob" data-id="0" :rotate-func="compressorKnobRotate" :start="attack.start"
                            :min="attack.min" :max="attack.max" mid-knob="false" ref="knobRef"></Knob>
                </div>
                <label id="compAttValue">{{ `${knobValues[0].toFixed(2)}ms` }}</label>
            </div>
            <div class="knobBox">
                <label class="qualityLabel">Release</label>
                <div id="releaseKnobContainer" class="knob qualityKnob">
                    <Knob id="releaseKnob" data-id="0" :rotate-func="compressorKnobRotate" :start="release.start"
                            :min="release.min" :max="release.max" mid-knob="false"></Knob>
                </div>
                <label id="compReleaseValue">{{ `${knobValues[1].toFixed(2)}ms` }}</label>
            </div>
            <div class="knobBox">
                <label class="qualityLabel">Threshold</label>
                <div id="thresholdKnobContainer" class="knob qualityKnob">
                    <Knob id="thresholdKnob" data-id="0" :rotate-func="compressorKnobRotate" :start="threshold.start"
                            :min="threshold.min" :max="threshold.max" mid-knob="false"></Knob>
                </div>
                <label id="compThresholdValue">{{ `${knobValues[2].toFixed(2)}db` }}</label>
            </div>
            <div class="knobBox">
                <label class="qualityLabel">Ratio</label>
                <div id="ratioKnobContainer" class="knob qualityKnob">
                    <Knob id="ratioKnob" data-id="0" :rotate-func="compressorKnobRotate" :start="ratio.start"
                            :min="ratio.min" :max="ratio.max" mid-knob="false"></Knob>
                </div>
                <label id="compRatioValue">{{ `${knobValues[3].toFixed(2)}:1` }}</label>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, Ref } from 'vue';
import { audioEngine } from '../assets/js/audioEngine';
import Knob from './Knob.vue';

export default defineComponent({
    name: 'Compressor',
    props: {},
    setup() {
        const ratio = { start: 20, min: 1, max: 20 };
        const attack = { start: 5, min: 0, max: 100 };
        const release = { start: 50, min: 1, max: 1000 };
        const threshold = { start: -1, min: -60, max: 0 };
        const knobValues = {'0': ratio.start, '1': attack.start, '2': release.start, '3': threshold.start};

        const knobRef: Ref<typeof Knob | null> = ref(null);
        const isMounted = ref(false);

        onMounted(() => {
            isMounted.value = true;
        })

        function compressorKnobRotate(angle: number, knobId: string, parentId: string) {
            if (!isMounted.value) return;

            const circumference = knobRef.value!.getCircumference();
            document.getElementById(`outerRing${parentId}`)?.setAttribute(
                'stroke-dashoffset',
                (circumference - circumference * (angle / 360)).toString(),
            );

            if (audioEngine.limiter != null) {
                if (knobId === '0') {
                    knobValues[knobId] = (angle / 360) * (attack.max - attack.min) + attack.min;
                    audioEngine.limiter.attack.value = knobValues[knobId] / 1000; // ms
                } else if (knobId === '1') {
                    knobValues[knobId] = (angle / 360) * (release.max - release.min) + release.min;
                    audioEngine.limiter.release.value = knobValues[knobId] / 1000; // ms
                } else if (knobId === '2') {
                    knobValues[knobId] = (angle / 360) * (threshold.max - threshold.min)
                        + threshold.min;
                    audioEngine.limiter.threshold.value = knobValues[knobId];
                } else if (knobId === '3') {
                    knobValues[knobId] = (angle / 360) * (ratio.max - ratio.min) + ratio.min;
                    audioEngine.limiter.ratio.value = knobValues[knobId];
                }
            }
        }

        return {
            compressorKnobRotate,
            ratio,
            attack,
            release,
            threshold,
            knobValues
        };
    },
});
</script>