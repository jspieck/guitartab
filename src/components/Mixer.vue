<template>
    <BaseModal>
        <template #title>Mixer</template>
        <div id="mixerMain">
            <div v-for="(drumInfo, number) in drumInfos" :key="number" class="mixerColumn" :style="{ order: number }">
                <div :id="`mixerColumn${number}`" :class="{ 'mixerColumnActive': lastColumnClicked === number }"
                    @click="mixerColumnClicked(number)">
                    <div class="slotNumber unselectable">{{ number }}</div>
                    <div class="slotName unselectable">{{ drumInfo[0] }}</div>
                    <canvas class="slotVolume" width="20" height="82" :id="`slotVolume${number}`" ref="slotVolume"></canvas>
                    <div class="slotActive" :class="{ 'slotInActive': drumInfo[4] }" @click="drumInfo[4] = !drumInfo[4];">
                    </div>
                    <div class="slotPan">
                        <Knob :id="`panKnob${number}`" :data-id="number" :rotate-func="mixerPanFunc"
                            :start="((drumInfo[3] + 1) / 2) * 127" :min="0" :max="127" :mid-knob="true" />
                    </div>
                    <div class="slotSlider">
                        <div class="volume" :id="`slotSlider${number}`">
                            <!-- Slider content goes here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { ref, Ref } from 'vue';
import BaseModal from './BaseModal.vue';
import audioEngine from '../assets/js/audioEngine';
import Knob from './Knob.vue';

const drumInfos = ref(Array.from(audioEngine.noteToDrum.values()));
const slotVolume: Ref<Array<HTMLCanvasElement> | null> = ref(null);
const lastColumnClicked = ref(-1);

const getMixerVolumeContext = (number: number) => {
    if (!slotVolume) return null;
    return slotVolume.value![number].getContext('2d');
}

function mixerPanFunc(angle: number, id: string) {
    const scaled = (angle - 180) / 180;
    const index = parseInt(id, 10);
    const drumInfo = audioEngine.noteToDrum.get(35 + index);
    if (drumInfo != null) {
        drumInfo[3] = scaled;
    }
    audioEngine.drumBusses[index].pan.pan.value = scaled;
}

function mixerColumnClicked(number: number) {
    lastColumnClicked.value = number;
}
/*
  createMixerColumn(number: number, name: string) {

    const slotPan = document.createElement('div');
    slotPan.setAttribute('class', 'slotPan');
    // var panKnob = sequencer.createPanKnob("slotPan"+number, number, mixerPanFunc);
    const drumInfo = audioEngine.noteToDrum.get(35 + number) ?? [1, 1, 1, 1];

    const slotSlider = document.createElement('div');
    slotSlider.setAttribute('class', 'slotSlider');
    const slotSliderChild = document.createElement('div');
    slotSliderChild.setAttribute('class', 'volume');
    slotSliderChild.setAttribute('id', `slotSlider${number}`);

    const options = {
      min: 0,
      orientation: 'vertical',
      max: 120,
      value: 40 * drumInfo[2],
      range: 'min',
    };

    const slider = document.createElement('div');
    Object.assign(slider.style, {
      height: '100px',
      width: '20px',
      backgroundColor: 'grey',
      position: 'relative',
      margin: '0 auto',
    });

    const handle = document.createElement('div');
    Object.assign(handle.style, {
      position: 'absolute',
      height: '20px',
      width: '20px',
      backgroundColor: 'white',
      borderRadius: '50%',
      bottom: `${(options.value / options.max) * 100}%`,
      transform: 'translate(-50%, 50%)',
      cursor: 'grab',
    });

    slider.appendChild(handle);

    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      const ui = {
        value: target.valueAsNumber,
      };
      if (ui != null && ui.value != null) {
        drumInfo[2] = (1 / 40) * ui.value;
        const dr = drumInfo[2];
        audioEngine.drumBusses[number].volume.gain.value = dr;
        handle.style.bottom = `${(ui.value / options.max) * 100}%`;
      }
    });
    slotSliderChild.appendChild(slider);

*/
</script>