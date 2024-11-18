<template>
  <div id="content" class="main">
    <svg width="0" height="0">
      <defs>
        <filter x="-0.02" y="0" width="1.04" height="1.1" id="solid">
          <feFlood flood-color="#d4e5f4" />
          <feComposite in="SourceGraphic" operator="atop" />
        </filter>
      </defs>
    </svg>
    <div class="entry-content">
      <Menu ref="menu"/>
      <div id="mainContent" class="mainWrapper" ref="mainContent" tabindex="0" @click="() => { $refs.mainContent.focus() }">
        <div id="completeTab" class="dinA4Size">
          <div id="svgTestArea"></div>
          <div id="tabAreas">
            <div id="tabArea" tabindex="0"></div>
          </div>
        </div>
      </div>
  </div>
  <div class="bottomBars">
      <div id="effectBar">
        <div id="effectBarLayout">
          <label id="effectsLabel">Effects</label>
          <div class="knobWrapper">
            <span class="knobTitle">PAN</span>
            <span class="minKnob" style="left:-18px;">LEFT</span>
            <span class="maxKnob" style="right: -24px;">RIGHT</span>
            <div class="knob-inset">
              <div id="panKnob" data-effect="pan" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">REVERB</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="reverbKnob" data-effect="reverb" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">CHORUS</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="chorusKnob" data-effect="chorus" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">PHASER</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="phaserKnob" data-effect="phaser" class="knob"></div>
            </div>
          </div>
        </div>
        <img id="effectEye" class="visibleEye" src="./assets/images/eyeInverted.svg" />
      </div>
      <Sequencer/>
    </div>
    <Footer/>
    <!-- 2 -->
    <div id="loadingWheel" class="loader loader--style2" title="1">
      <svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px" width="50px" height="50px" viewBox="0 0 50 50" style="enable-background:new 0 0 50 50;"
        xml:space="preserve">
        <path fill="#274bb3"
          d="M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z">
          <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25"
            dur="0.6s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>

    <div id="notificationEmblem">
      <img id="infoNotification" src="./assets/images/info.svg">
      <label id="notificationLabel">Saved!</label>
    </div>
    
    <svg id="svg-source" height="0" version="1.1" xmlns="http://www.w3.org/2000/svg"
      style="position:absolute; margin-left: -100%" xmlns:xlink="http://www.w3.org/1999/xlink">
      <g id="close-icon">
        <path d="M0.014,1.778L1.79,0.001l30.196,30.221l-1.778,1.777L0.014,1.778z" />
        <path d="M1.79,31.999l-1.776-1.777L30.208,0.001l1.778,1.777L1.79,31.999z" />
      </g>
    </svg>

    <div class="mask" role="dialog"></div>

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
    <TimeMeterModal :trackId="currentTrackId" :blockId="currentBlockId" :voiceId="currentVoiceId" id="timeMeterModal" class="modal" role="alert"/>
    <BpmModal />
    <StrokeModal />
    <AddTextModal />
    <AddMarkerModal />
    <AddChordModal :trackId="currentTrackId" />
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
import { onMounted, ref, computed } from 'vue'
import Menu from './components/Menu.vue'
import Footer from './components/Footer.vue'
import Compressor from './components/Compressor.vue'
import Equalizer from './components/Equalizer.vue'
import Sequencer from './components/Sequencer.vue'
import PianoModal from './components/PianoModal.vue'
import TimeMeterModal from './components/TimeMeterModal.vue'
import InstrumentSettingsModal from './components/InstrumentSettingModal.vue';
import Mixer from './components/Mixer.vue'
import CopyrightModal from './components/CopyrightModal.vue'
import MidiModal from './components/MidiModal.vue'
import TrackInfoModal from './components/TrackInfoModal.vue'
import TremoloBarModal from './components/TremoloBarModal.vue'
import GuitarModal from './components/GuitarModal.vue'
import GraceModal from './components/GraceModal.vue'
import ChordManagerModal from './components/ChordManagerModal.vue'
import AddChordModal from './components/AddChordModal.vue'
import AddMarkerModal from './components/AddMarkerModal.vue'
import AddTextModal from './components/AddTextModal.vue'
import BpmModal from './components/BpmModal.vue'
import StrokeModal from './components/StrokeModal.vue'
import DrumInfoModal from  './components/DrumInfoModal.vue'
import TremoloPickingModal from  './components/TremoloPickingModal.vue'
import HarmonicModal from  './components/HarmonicModal.vue'
import RepeatAlternativeModal from  './components/RepeatAlternativeModal.vue'
import AddTrackModal from  './components/AddTrackModal.vue'
import RepititionModal from  './components/RepititionModal.vue'
import DeleteModal from  './components/DeleteModal.vue'
import BendModal from  './components/BendModal.vue'
import { startUp } from './assets/js/guitarTab'
import { overlayHandler } from './assets/js/overlayHandler'
import { tab } from './assets/js/tab'

const currentTrackId = ref(0);
const currentVoiceId = ref(0);
const currentBlockId = ref(0);
const currentBeatId = ref(0);

const currentSelection = computed(() => overlayHandler.getNotesInInterval(null));

onMounted(() => {
  startUp();
})
</script>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
