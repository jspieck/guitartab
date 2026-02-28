<template>
  <div>
    <BendModal />
    <PianoModal id="pianoModal" class="modal" role="alert"></PianoModal>
    <DrumInfoModal />
    <GuitarModal id="guitarModal" class="modal" role="alert"/>
    <DeleteModal />
    <RepititionModal />
    <AddTrackModal />
    <RepeatAlternativeModal />
    <HarmonicModal />
    <TremoloPickingModal />
    <TimeMeterModal 
      :trackId="trackId" 
      :blockId="blockId" 
      :voiceId="voiceId" 
      id="timeMeterModal" 
      class="modal" 
      role="alert"
    />
    <BpmModal />
    <StrokeModal />
    <AddTextModal />
    <AddMarkerModal />
    <AddChordModal :trackId="trackId" />
    <ChordManagerModal />
    <GraceModal />
    <TremoloBarModal />
    <TrackInfoModal />
    <MidiModal />
    <CopyrightModal />
    <Mixer />
    <Compressor id="compressorModal" class="modal" role="alert"/>
    <Equalizer id="equalizerModal" class="modal" role="alert" ref="equalizer"/>
    <InstrumentSettingsModal class="modal" role="alert" />
  </div>
</template>

<script setup lang="ts">
import Compressor from './Compressor.vue'
import Equalizer from './Equalizer.vue'
import PianoModal from './PianoModal.vue'
import TimeMeterModal from './TimeMeterModal.vue'
import InstrumentSettingsModal from './InstrumentSettingModal.vue'
import Mixer from './Mixer.vue'
import CopyrightModal from './CopyrightModal.vue'
import MidiModal from './MidiModal.vue'
import TrackInfoModal from './TrackInfoModal.vue'
import TremoloBarModal from './TremoloBarModal.vue'
import GuitarModal from './GuitarModal.vue'
import GraceModal from './GraceModal.vue'
import ChordManagerModal from './ChordManagerModal.vue'
import AddChordModal from './AddChordModal.vue'
import AddMarkerModal from './AddMarkerModal.vue'
import AddTextModal from './AddTextModal.vue'
import BpmModal from './BpmModal.vue'
import StrokeModal from './StrokeModal.vue'
import DrumInfoModal from './DrumInfoModal.vue'
import TremoloPickingModal from './TremoloPickingModal.vue'
import HarmonicModal from './HarmonicModal.vue'
import RepeatAlternativeModal from './RepeatAlternativeModal.vue'
import AddTrackModal from './AddTrackModal.vue'
import RepititionModal from './RepititionModal.vue'
import DeleteModal from './DeleteModal.vue'
import BendModal from './BendModal.vue'

defineProps<{
  trackId: number
  voiceId: number
  blockId: number
}>()
</script>
