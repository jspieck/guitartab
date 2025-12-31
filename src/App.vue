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
      <div id="mainContent" class="mainWrapper" ref="mainContent" tabindex="0" @click="focusMainContent">
        <div id="completeTab" class="dinA4Size">
          <!-- New Vue-based tab view -->
          <GuitarTabView
            :track-id="currentTrackId"
            :voice-id="currentVoiceId"
            :width="1200"
            :height="1600"
          />
        </div>
      </div>
    </div>
    <div class="bottomBars">
      <EffectsBar :track-id="currentTrackId" />
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

    <ModalsContainer 
      :trackId="currentTrackId" 
      :voiceId="currentVoiceId" 
      :blockId="currentBlockId" 
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import EffectsBar from './components/EffectsBar.vue'
import Menu from './components/Menu.vue'
import { useTabStore } from './stores/tabStore'
import Footer from './components/Footer.vue'
import Sequencer from './components/Sequencer.vue'
import ModalsContainer from './components/ModalsContainer.vue'
import GuitarTabView from './components/tab/GuitarTabView.vue'
import { startUp } from './assets/js/guitarTab'
import { overlayHandler } from './assets/js/overlayHandler'
import { tab } from './assets/js/tab'
import EventBus from './assets/js/eventBus'
import Song from './assets/js/songData'

const currentTrackId = ref(0);
const currentVoiceId = ref(0);
const currentBlockId = ref(0);
const currentBeatId = ref(0);

const store = useTabStore();
const currentSelection = computed(() => {
  // Trigger dependency
  store.selectionVersion;
  return overlayHandler.getNotesInInterval(null);
});

function focusMainContent() {
  const mainContent = document.getElementById('mainContent')
  if (mainContent) {
    mainContent.focus()
  }
}

// Handle track changes
function handleTrackChange(trackId: number) {
  currentTrackId.value = trackId;
}

// Handle song data changes (e.g., when loading a new file)
function handleSongDataChange() {
  // Update to current track from Song
  currentTrackId.value = Song.currentTrackId;
  currentVoiceId.value = Song.currentVoiceId;
}

onMounted(() => {
  // Initialize legacy system for audio/playback support
  startUp();
  
  // Listen for track changes
  EventBus.on('ui.trackChanged', handleTrackChange as any);
  EventBus.on('song-data-changed', handleSongDataChange);
})

onUnmounted(() => {
  EventBus.off('ui.trackChanged', handleTrackChange as any);
  EventBus.off('song-data-changed', handleSongDataChange);
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

.dev-toggle-button {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  padding: 8px 16px;
  background: #f0f0f0;
  border: 2px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.dev-toggle-button:hover {
  background: #e0e0e0;
}

.dev-toggle-button.active {
  background: #4CAF50;
  color: white;
  border-color: #45a049;
}
</style>
