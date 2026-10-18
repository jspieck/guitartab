<template>
  <div id="content" class="main" :class="{ 'layout-compact': layoutModeState.compact, 'compact-editing': layoutModeState.editing }">
    <svg width="0" height="0">
      <defs>
        <filter x="-0.02" y="0" width="1.04" height="1.1" id="solid">
          <feFlood flood-color="#d4e5f4" />
          <feComposite in="SourceGraphic" operator="atop" />
        </filter>
      </defs>
    </svg>
    <CompactBar v-if="layoutModeState.compact" />
    <div class="entry-content">
      <Menu ref="menu"/>
      <div id="mainContent" class="mainWrapper" ref="mainContent" tabindex="0" @click="focusMainContent">
        <div id="completeTab" :class="completeTabClass" :style="completeTabStyle">
          <GuitarTabView
            :track-id="currentTrackId"
            :voice-id="currentVoiceId"
            :width="sheetWidth"
            :height="sheetHeight"
            :class="tabViewClass"
            :style="tabViewStyle"
          />
        </div>
      </div>
    </div>
    <TouchNotePad v-if="layoutModeState.editing" />
    <div class="bottomBars">
      <EffectsBar :track-id="currentTrackId" />
      <Sequencer/>
    </div>
    <Footer/>
    
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
      <img id="infoNotification" src="./assets/images/info.svg" alt="">
      <label id="notificationLabel">Saved!</label>
      <button type="button" id="notificationAction" hidden></button>
    </div>

    <div v-if="autosavePrompt" id="autosaveBanner" class="autosave-banner">
      <span>{{ autosavePrompt }}</span>
      <button type="button" class="autosave-banner__action" @click="restoreAutosaveDraft">Restore</button>
      <button type="button" class="autosave-banner__action autosave-banner__action--muted" @click="dismissAutosaveDraft">Dismiss</button>
    </div>
    <!-- Loaded on first open; it is not needed at startup. -->
    <AutosaveDraftsPanel v-if="draftsPanelState.open" />
    <HelpOverlays v-if="shortcutsHelpState.open || firstRunHintState.open" />
    
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
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Menu from './components/Menu.vue'
import GuitarTabView from './components/tab/GuitarTabView.vue'
import { startUp } from './assets/js/guitarTab'
import { useSongData } from './composables/useSongData'
import { useEditorScopeState } from './composables/useEditorScopeState'
import { useTabViewport } from './composables/useTabViewport'
import AppManager from './assets/js/appManager'
import {
  dismissRecoverableDraft,
  getRecoverableDraft,
  restoreAutosave,
  setupAutosaveListeners,
  teardownAutosaveListeners,
} from './services/songAutosave'
import { draftsPanelState } from './stores/draftsPanelState'
import { shortcutsHelpState } from './stores/shortcutsHelpState'
import { firstRunHintState } from './stores/firstRunHintState'
import { layoutModeState, sheetFitMode, watchViewportLayout } from './stores/layoutModeState'

const EffectsBar = defineAsyncComponent(() => import('./components/EffectsBar.vue'))
const Footer = defineAsyncComponent(() => import('./components/Footer.vue'))
const Sequencer = defineAsyncComponent(() => import('./components/Sequencer.vue'))
const ModalsContainer = defineAsyncComponent(() => import('./components/ModalsContainer.vue'))
const AutosaveDraftsPanel = defineAsyncComponent(() => import('./components/AutosaveDraftsPanel.vue'))
const HelpOverlays = defineAsyncComponent(() => import('./components/HelpOverlays.vue'))
const CompactBar = defineAsyncComponent(() => import('./components/compact/CompactBar.vue'))
const TouchNotePad = defineAsyncComponent(() => import('./components/compact/TouchNotePad.vue'))

useSongData()
const { currentTrackId, currentVoiceId } = useEditorScopeState()

const mainContent = ref<HTMLElement | null>(null)
const currentBlockId = ref(0)
const autosavePrompt = ref<string | null>(null)
const pendingAutosaveBytes = ref<Uint8Array | null>(null)

const {
  completeTabClass,
  completeTabStyle,
  tabViewClass,
  tabViewStyle,
  sheetWidth,
  sheetHeight,
  registerMainContent,
} = useTabViewport(mainContent)

watch(mainContent, (element) => {
  registerMainContent(element)
}, { immediate: true })

function focusMainContent() {
  mainContent.value?.focus()
}

function formatAutosaveTime(savedAt: number): string {
  return new Date(savedAt).toLocaleString()
}

async function checkForAutosaveDraft(): Promise<void> {
  try {
    const snapshot = await getRecoverableDraft()
    if (!snapshot) {
      return
    }
    pendingAutosaveBytes.value = snapshot.bytes
    autosavePrompt.value = `Restore unsaved changes to "${snapshot.title}" from ${formatAutosaveTime(snapshot.savedAt)}?`
  } catch (error) {
    console.error('Failed to read autosave draft', error)
  }
}

function restoreAutosaveDraft(): void {
  if (!pendingAutosaveBytes.value) {
    return
  }
  const restored = restoreAutosave({ bytes: pendingAutosaveBytes.value })
  autosavePrompt.value = null
  pendingAutosaveBytes.value = null
  if (restored) AppManager.showNotification('Restored autosaved draft')
}

// Dismissing only hides the offer; the draft stays in "Recover drafts".
function dismissAutosaveDraft(): void {
  autosavePrompt.value = null
  pendingAutosaveBytes.value = null
  dismissRecoverableDraft()
}

onMounted(() => {
  startUp()
  // After startUp, so the initial (empty or demo) song is the clean baseline.
  setupAutosaveListeners()
  void checkForAutosaveDraft()
  // Shared links (?song=…); the loader is only fetched when there is one.
  if (new URLSearchParams(window.location.search).has('song')) {
    void import('./services/cloudSongLoader').then(async ({ getCloudSongIdFromUrl, loadCloudSongById }) => {
      const cloudSongId = getCloudSongIdFromUrl()
      if (cloudSongId) await loadCloudSongById(cloudSongId)
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to load cloud song'
      AppManager.showNotification(message)
    })
  }

  stopViewportLayout = watchViewportLayout()
  // The sheet-fitting code is only loaded on phones and tablets (or after a resize from one).
  watch(() => sheetFitMode(), (mode, previous) => {
    if (mode === 'desktop' && (previous == null || previous === 'desktop')) return
    void import('./services/compactLayout').then(({ syncSheetFit }) => {
      syncSheetFit(mode, mainContent.value)
    })
  }, { immediate: true })
})

let stopViewportLayout: () => void = () => {}

onBeforeUnmount(() => {
  teardownAutosaveListeners()
  stopViewportLayout()
})
</script>
