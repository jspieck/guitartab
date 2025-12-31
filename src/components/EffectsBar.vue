<template>
  <div id="effectBar">
    <div id="effectBarLayout">
      <label id="effectsLabel">Effects</label>
      
      <div class="knobWrapper">
        <span class="knobTitle">PAN</span>
        <span class="minKnob" style="left:-18px;">LEFT</span>
        <span class="maxKnob" style="right: -24px;">RIGHT</span>
        <div class="knob-inset">
          <Knob 
            id="panKnob" 
            :data-id="trackId" 
            :rotate-func="panKnobRotate"
            :start="panValue"
            :min="0"
            :max="127"
            :midKnob="true"
          />
        </div>
      </div>

      <div class="knobWrapper">
        <span class="knobTitle">REVERB</span>
        <span class="minKnob">MIN</span>
        <span class="maxKnob">MAX</span>
        <div class="knob-inset">
          <Knob 
            id="reverbKnob" 
            :data-id="trackId" 
            :rotate-func="reverbKnobRotate"
            :start="reverbValue"
            :min="0"
            :max="127"
            :midKnob="false"
          />
        </div>
      </div>

      <div class="knobWrapper">
        <span class="knobTitle">CHORUS</span>
        <span class="minKnob">MIN</span>
        <span class="maxKnob">MAX</span>
        <div class="knob-inset">
          <Knob 
            id="chorusKnob" 
            :data-id="trackId" 
            :rotate-func="chorusKnobRotate"
            :start="chorusValue"
            :min="0"
            :max="127"
            :midKnob="false"
          />
        </div>
      </div>

      <div class="knobWrapper">
        <span class="knobTitle">PHASER</span>
        <span class="minKnob">MIN</span>
        <span class="maxKnob">MAX</span>
        <div class="knob-inset">
          <Knob 
            id="phaserKnob" 
            :data-id="trackId" 
            :rotate-func="phaserKnobRotate"
            :start="phaserValue"
            :min="0"
            :max="127"
            :midKnob="false"
          />
        </div>
      </div>
    </div>
    <img id="effectEye" class="visibleEye" src="../assets/images/eyeInverted.svg" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import Knob from './Knob.vue';
import Song from '../assets/js/songData';
import audioEngine from '../assets/js/audioEngine';

export default defineComponent({
  name: 'EffectsBar',
  components: {
    Knob
  },
  props: {
    trackId: {
      type: Number,
      required: true
    }
  },
  setup(props) {
    const getInstrument = () => {
      if (!Song.playBackInstrument || !Song.playBackInstrument[props.trackId]) {
        return null;
      }
      return Song.playBackInstrument[props.trackId];
    };

    const panValue = computed(() => getInstrument()?.balance ?? 64);
    const reverbValue = computed(() => getInstrument()?.reverb ?? 0);
    const chorusValue = computed(() => getInstrument()?.chorus ?? 0);
    const phaserValue = computed(() => getInstrument()?.phaser ?? 0);

    const panKnobRotate = (angle: number, _dataId: string) => {
      const instrument = getInstrument();
      if (!instrument) return;

      const scaled = (angle / 360) * 127;
      instrument.balance = scaled;
      audioEngine.setEffectGain(props.trackId, scaled, 'pan');
    };

    const reverbKnobRotate = (angle: number, _dataId: string) => {
      const instrument = getInstrument();
      if (!instrument) return;
      
      const scaled = (angle / 360) * 127;
      instrument.reverb = scaled;
      audioEngine.setEffectGain(props.trackId, scaled, 'reverb');
    };

    const chorusKnobRotate = (angle: number, _dataId: string) => {
      const instrument = getInstrument();
      if (!instrument) return;
      
      const scaled = (angle / 360) * 127;
      instrument.chorus = scaled;
      audioEngine.setEffectGain(props.trackId, scaled, 'chorus');
    };

    const phaserKnobRotate = (angle: number, _dataId: string) => {
      const instrument = getInstrument();
      if (!instrument) return;
      
      const scaled = (angle / 360) * 127;
      instrument.phaser = scaled;
      audioEngine.setEffectGain(props.trackId, scaled, 'phaser');
    };

    return {
      panValue,
      reverbValue,
      chorusValue,
      phaserValue,
      panKnobRotate,
      reverbKnobRotate,
      chorusKnobRotate,
      phaserKnobRotate
    };
  }
});
</script>

<style scoped>
</style>
