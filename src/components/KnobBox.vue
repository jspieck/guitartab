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
import { defineComponent } from 'vue';
import Knob from './Knob.vue';

export default defineComponent({
    name: 'KnobBox',
    components: { Knob },
    props: {
        label: String,
        containerId: String,
        knobId: String,
        dataId: Number,
        rotateFunc: Function,
        start: Number,
        min: Number,
        max: Number,
        valueId: String,
        knobValue: { type: Number, default: 0 },
        unit: String,
        midKnob: Boolean
    },
});
</script>
  