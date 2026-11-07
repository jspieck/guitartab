<template>
  <div id="content" class="main" :class="{ 'layout-compact': layoutModeState.compact, 'compact-editing': layoutModeState.editing }">
    <svg width="0" height="0">
      <defs>
        <filter x="-0.02" y="0" width="1.04" height="1.1" id="solid">
          <feFlood style="flood-color: var(--tab-hover)" />
          <feComposite in="SourceGraphic" operator="atop" />
        </filter>
      </defs>
    </svg>
    <CompactBar v-if="layoutModeState.compact" />
    <div class="entry-content">
      <!-- The desktop toolbar; phones have CompactBar instead and don't mount it. -->
      <Menu v-if="!layoutModeState.compact" />
      <!-- Shared by the toolbar's and the phone menu's "Open file". -->
      <input :id="SONG_FILE_INPUT_ID" type="file" accept=".gp,.gpx,.gp5,.gp4,.gp3,.musicxml,.mxl,.xml,.mid,.midi,.gt" hidden
        @change="handleFileSelect" />
      <!-- Right-click, Shift+F10 or long-press on a note; a sheet on phones. -->
      <NoteMenu v-if="noteMenuState.open" :is-pressed="toolbar.isPressed" :is-disabled="toolbar.isDisabled" />
      <BigBeatDisplay v-if="practiceState.bigBeat" />
      <div id="mainContent" class="mainWrapper" ref="mainContent" role="main" aria-label="Tablature" tabindex="0" @click="focusMainContent">
        <h1 class="visually-hidden">GuitarTab</h1>
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
    <div class="bottomBars" role="region" aria-label="Effects and tracks">
      <EffectsBar :track-id="currentTrackId" />
      <Sequencer/>
    </div>
    <Footer/>
    
    <div id="loadingWheel" class="loader loader--style2" title="1">
      <svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px" width="50px" height="50px" viewBox="0 0 50 50"
        xml:space="preserve">
        <path style="fill: var(--color-accent)"
          d="M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z">
          <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25"
            dur="0.6s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>

    <Transition name="notification-fade">
      <div v-if="notificationState.visible" id="notificationEmblem" :key="notificationState.id"
        :class="{ 'notification-error': notificationState.kind === 'error' }" role="status">
        <AppIcon id="infoNotification" name="info" :size="16" />
        <label id="notificationLabel">{{ notificationState.text }}</label>
        <button v-if="notificationState.action" type="button" id="notificationAction"
          @click="runNotificationAction">{{ notificationState.action.label }}</button>
      </div>
    </Transition>

    <!-- Spoken by screen readers: cursor moves, edits, undo (stores/announcerState.ts). -->
    <div id="screenReaderAnnouncer" class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcerState.text }}</div>

    <div v-if="autosavePrompt" id="autosaveBanner" class="autosave-banner">
      <span>{{ autosavePrompt }}</span>
      <button type="button" class="autosave-banner__action" @click="restoreAutosaveDraft">Restore</button>
      <button type="button" class="autosave-banner__action autosave-banner__action--muted" @click="dismissAutosaveDraft">Dismiss</button>
    </div>
    <!-- Loaded on first open; it is not needed at startup. -->
    <AutosaveDraftsPanel v-if="draftsPanelState.open" />
    <HelpOverlays v-if="shortcutsHelpState.open || firstRunHintState.open" />
    <LyricsEntryField v-if="lyricsEntryState.active" />
    
    <svg id="svg-source" class="svg-icon-source" height="0" version="1.1" xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink">
      <g id="close-icon">
        <path d="M0.014,1.778L1.79,0.001l30.196,30.221l-1.778,1.777L0.014,1.778z" />
        <path d="M1.79,31.999l-1.776-1.777L30.208,0.001l1.778,1.777L1.79,31.999z" />
      </g>
    </svg>

    <div class="mask" aria-hidden="true"></div>

    <!-- Mounted with the first dialog that opens (stores/dialogState). -->
    <ModalsContainer v-if="dialogState.mounted.length > 0" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import Menu from './components/Menu.vue'
import AppIcon from './components/AppIcon.vue'
import GuitarTabView from './components/tab/GuitarTabView.vue'
// Not lazy: the keys typed right after L would reach the sheet before a lazy field mounts.
import LyricsEntryField from './components/tab/LyricsEntryField.vue'
import { startUp } from './services/startup'
import { watchTheme } from './services/theme'
import { useSongData } from './composables/useSongData'
import { useEditorScopeState } from './stores/editorScopeState'
import { useTabViewport } from './composables/useTabViewport'
import {
  confirmReplaceUnsavedSong,
  dismissRecoverableDraft,
  getRecoverableDraft,
  restoreAutosave,
  setupAutosaveListeners,
  teardownAutosaveListeners,
} from './services/songAutosave'
import { watchPracticeMemory } from './services/practiceMemory'
import { practiceState } from './stores/practiceState'
import { draftsPanelState } from './stores/draftsPanelState'
import { notificationState, runNotificationAction, showNotification } from './stores/notificationState'
import { shortcutsHelpState } from './stores/shortcutsHelpState'
import { firstRunHintState } from './stores/firstRunHintState'
import { lyricsEntryState } from './stores/lyricsEntryState'
import { layoutModeState, sheetFitMode, watchViewportLayout } from './stores/layoutModeState'
import { dialogState } from './stores/dialogState'
import { noteInputState } from './stores/noteInputState'
import { noteMenuState } from './stores/toolbarUiState'
import { announcerState } from './stores/announcerState'
import { openSongFile } from './services/songImport'
import { SONG_FILE_INPUT_ID } from './services/editor/toolbarActions'
import { useToolbarState } from './composables/useToolbarState'

const EffectsBar = defineAsyncComponent(() => import('./components/EffectsBar.vue'))
const Footer = defineAsyncComponent(() => import('./components/Footer.vue'))
const Sequencer = defineAsyncComponent(() => import('./components/Sequencer.vue'))
const ModalsContainer = defineAsyncComponent(() => import('./components/ModalsContainer.vue'))
const BigBeatDisplay = defineAsyncComponent(() => import('./components/BigBeatDisplay.vue'))
const AutosaveDraftsPanel = defineAsyncComponent(() => import('./components/AutosaveDraftsPanel.vue'))
const HelpOverlays = defineAsyncComponent(() => import('./components/HelpOverlays.vue'))
const CompactBar = defineAsyncComponent(() => import('./components/compact/CompactBar.vue'))
const TouchNotePad = defineAsyncComponent(() => import('./components/compact/TouchNotePad.vue'))
// Only needed once someone right-clicks a note.
const NoteMenu = defineAsyncComponent(() => import('./components/toolbar/NoteMenu.vue'))
const toolbar = useToolbarState(toRef(noteInputState, 'tuplet'))

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  // Asked after picking, so the question can name the file.
  if (files && files.length > 0 && confirmReplaceUnsavedSong(files[0].name)) {
    openSongFile(files)
  }
  // Reset the input so the same file can be selected again
  input.value = ''
}

useSongData()
watchTheme()
const { currentTrackId, currentVoiceId } = useEditorScopeState()

const mainContent = ref<HTMLElement | null>(null)
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
  if (restored) showNotification('Restored autosaved draft')
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
  watchPracticeMemory()
  void checkForAutosaveDraft()
  // Shared links (?song=…); the loader is only fetched when there is one.
  if (new URLSearchParams(window.location.search).has('song')) {
    void import('./services/cloudSongLoader').then(async ({ getCloudSongIdFromUrl, loadCloudSongById }) => {
      const cloudSongId = getCloudSongIdFromUrl()
      if (cloudSongId) await loadCloudSongById(cloudSongId)
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to load cloud song'
      showNotification(message)
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
