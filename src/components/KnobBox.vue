<template>
    <div class="knobBox">
        <label class="qualityLabel">{{ label }}</label>
        <div :id="containerId" class="knob qualityKnob">
            <Knob :id="knobId" :data-id="dataId" :rotate-func="rotateFunc" :start="start" :min="min" :max="max"
                :mid-knob="midKnob"></Knob>
        </div>
        <label :id="valueId">{{ `${knobValue.toFixed(2)}${unit}` }}</label>
    </div>
</template>
  
<script lang="ts">
import { defineComponent, PropType } from 'vue';
import Knob from './Knob.vue';

export default defineComponent({
    name: 'KnobBox',
    components: { Knob },
    props: {
        label: String,
        containerId: String,
        knobId: { type: String, required: true },
        dataId: { type: Number, required: true },
        rotateFunc: { 
            type: Function as PropType<(angle: number, dataIdFunc: string, targetId: string) => void>, 
            required: true 
        },
        start: { type: Number, required: true },
        min: { type: Number, required: true },
        max: { type: Number, required: true },
        valueId: String,
        knobValue: { type: Number, default: 0 },
        unit: String,
        midKnob: Boolean
    },
});
</script>
  