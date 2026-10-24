<template>
  <div id="effectBar">
    <div id="effectBarLayout">
      <label id="effectsLabel">Effects</label>
      
      <div class="knobWrapper">
        <span class="knobTitle">PAN</span>
        <span class="minKnob">LEFT</span>
        <span class="maxKnob">RIGHT</span>
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
    <AppIcon id="effectEye" class="visibleEye" name="eye" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Knob from './Knob.vue'
import AppIcon from './AppIcon.vue'
import { audioGraph } from '../services/audio/audioGraph'
import editorCore from '../services/editor/editorCore'

const props = defineProps<{ trackId: number }>()

const instrument = computed(() => editorCore.getPlayBackInstrument(props.trackId))

const panValue = computed(() => instrument.value?.balance ?? 64)
const reverbValue = computed(() => instrument.value?.reverb ?? 0)
const chorusValue = computed(() => instrument.value?.chorus ?? 0)
const phaserValue = computed(() => instrument.value?.phaser ?? 0)

const panKnobRotate = (angle: number, _dataId: string) => {
  if (!instrument.value) return
  const scaled = (angle / 360) * 127
  editorCore.setPlayBackInstrumentEffect(props.trackId, 'balance', scaled)
  audioGraph.setEffectGain(props.trackId, scaled, 'pan')
}

const reverbKnobRotate = (angle: number, _dataId: string) => {
  if (!instrument.value) return
  const scaled = (angle / 360) * 127
  editorCore.setPlayBackInstrumentEffect(props.trackId, 'reverb', scaled)
  audioGraph.setEffectGain(props.trackId, scaled, 'reverb')
}

const chorusKnobRotate = (angle: number, _dataId: string) => {
  if (!instrument.value) return
  const scaled = (angle / 360) * 127
  editorCore.setPlayBackInstrumentEffect(props.trackId, 'chorus', scaled)
  audioGraph.setEffectGain(props.trackId, scaled, 'chorus')
}

const phaserKnobRotate = (angle: number, _dataId: string) => {
  if (!instrument.value) return
  const scaled = (angle / 360) * 127
  editorCore.setPlayBackInstrumentEffect(props.trackId, 'phaser', scaled)
  audioGraph.setEffectGain(props.trackId, scaled, 'phaser')
}
</script>

<style scoped>
</style>
