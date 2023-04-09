<template>
    <div>
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
            <KnobBox v-for="(setting, index) in settings" :key="index" :label="setting.label"
                :containerId="setting.containerId" :knobId="setting.knobId" :dataId="index"
                :rotate-func="compressorKnobRotate" :start="setting.start" :min="setting.min" :max="setting.max"
                :valueId="setting.valueId" :knobValue="knobValues[index]" :unit="setting.unit" :midKnob="true"/>
        </div>
    </div>
</template>
  
<script lang="ts">
import { defineComponent, ref, onMounted, Ref, reactive } from 'vue';
import { audioEngine } from '../assets/js/audioEngine';
import Knob from './Knob.vue';
import KnobBox from './KnobBox.vue';

export default defineComponent({
    name: 'Compressor',
    components: { Knob, KnobBox },
    props: {},
    setup() {
        const settings = [
            { label: 'Attack', containerId: 'attackKnobContainer', knobId: 'attackKnob', start: 5, min: 0, max: 100, valueId: 'compAttValue', unit: 'ms' },
            { label: 'Release', containerId: 'releaseKnobContainer', knobId: 'releaseKnob', start: 50, min: 1, max: 1000, valueId: 'compReleaseValue', unit: 'ms' },
            { label: 'Threshold', containerId: 'thresholdKnobContainer', knobId: 'thresholdKnob', start: -1, min: -60, max: 0, valueId: 'compThresholdValue', unit: 'db' },
            { label: 'Ratio', containerId: 'ratioKnobContainer', knobId: 'ratioKnob', start: 20, min: 1, max: 20, valueId: 'compRatioValue', unit: ':1' },
        ];

        const knobValues = reactive(Object.fromEntries(settings.map((setting, index) => [index, setting.start])));

        const knobRef: Ref<typeof Knob | null> = ref(null);
        const isMounted = ref(false);

        onMounted(() => {
            isMounted.value = true;
        })

        function setLimiterProperty(limiter: DynamicsCompressorNode, property: string, value: number) {
            switch (property) {
                case 'attack':
                    limiter.attack.value = value / 1000; // ms
                    break;
                case 'release':
                    limiter.release.value = value / 1000; // ms
                    break;
                case 'threshold':
                    limiter.threshold.value = value;
                    break;
                case 'ratio':
                    limiter.ratio.value = value;
                    break;
            }
        }

        function compressorKnobRotate(angle: number, knobId: string, parentId: string) {
            if (!isMounted.value) return;

            const setting = settings[parseInt(knobId)];
            if (audioEngine.limiter != null) {
                knobValues[knobId] = (angle / 360) * (setting.max - setting.min) + setting.min;
                setLimiterProperty(audioEngine.limiter, setting.label.toLowerCase(), knobValues[knobId]);
            }
        }

        return {
            compressorKnobRotate,
            settings,
            knobValues
        };
    },
});
</script>