<template>
    <div id="footerBar">
        <div id="openWindowArea">
        </div>
        <div id="footerFiller"></div>
        <div id="drumInfoFooter" class="footerBlock" role="button" tabindex="0" title="Which MIDI note plays which drum"
            @click="modalManager.toggleByModal(MODALS.DRUM_INFO, {})" @keydown.enter.prevent="modalManager.toggleByModal(MODALS.DRUM_INFO, {})">Drum map</div>
        <div id="drumMixerOpen" class="footerBlock" role="button" tabindex="0"
            @click="modalManager.toggleByModal(MODALS.MIXER, {})" @keydown.enter.prevent="modalManager.toggleByModal(MODALS.MIXER, {})">Drum mixer</div>
        <div id="autoScroll" class="footerBlock" role="button" tabindex="0" :aria-pressed="isAutoscrollEnabled"
            title="Follow the playback position while playing"
            @click="toggleScrolling()" @keydown.enter.prevent="toggleScrolling()"><span class="footerLabel">Autoscroll</span>{{ isAutoscrollEnabled ? 'On' : 'Off' }}</div>
        <div id="tuningFooter" class="footerBlock" role="button" tabindex="0"
            @click="openInstrumentSettings()" @keydown.enter.prevent="openInstrumentSettings()"><span class="footerLabel">Tuning</span>{{ tuningText }}</div>
        <div id="capoLabel" class="footerBlock" role="button" tabindex="0"
            @click="openInstrumentSettings()" @keydown.enter.prevent="openInstrumentSettings()"><span class="footerLabel">Capo</span>{{ currentTrack?.capo ?? 0 }}</div>
        <div id="modeSwitcher" class="footerBlock" role="button" tabindex="0" title="Switch between light and dark theme"
            @click="toggleDarkMode()" @keydown.enter.prevent="toggleDarkMode()"><span class="footerLabel">Theme</span>{{ isDarkMode ? 'Dark' : 'Light' }}</div>
        <div id="midiLabel" class="footerBlock" role="button" tabindex="0" title="MIDI input settings"
            @click="modalManager.toggleByModal(MODALS.MIDI, {})" @keydown.enter.prevent="modalManager.toggleByModal(MODALS.MIDI, {})">MIDI
            <span id="isMidiActive" :class="{ activated: midiConnected }" aria-hidden="true"></span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { midiState } from '../services/midi/devices';
import { computed, ref, watch } from 'vue';
import { modalManager } from '../assets/js/modals/modalManager';
import Settings from '../stores/settingsState';
import { MODALS } from '../assets/js/modals/modalTypes';
import { useSongData } from '../composables/useSongData';

const midiConnected = computed(() => midiState.devices.some((device) => device.connected));

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const { reactiveSongData } = useSongData();

const isDarkMode = ref(Settings.darkMode);
const isAutoscrollEnabled = ref(Settings.scrollingEnabled);

const currentTrackId = computed(() => reactiveSongData.currentTrackId ?? 0);
const currentTrack = computed(() => reactiveSongData.tracks?.[currentTrackId.value] ?? null);

const tuningText = computed(() => formatTuning(currentTrack.value?.strings ?? []));

watch(isDarkMode, (darkModeEnabled) => {
    document.body.setAttribute('id', darkModeEnabled ? 'darkMode' : 'lightMode');
}, { immediate: true });

function formatTuning(strings: number[]): string {
    if (strings.length === 0) {
        return '-';
    }

    return strings.map((note) => {
        const noteIndex = ((note - 12) % 12 + 12) % 12;
        return NOTE_NAMES[noteIndex];
    }).join('');
}

function openInstrumentSettings() {
    modalManager.toggleByModal(MODALS.INSTRUMENT_SETTINGS, { trackId: currentTrackId.value });
}

function applyStyleMode() {
    isDarkMode.value = Settings.darkMode;
}

function toggleDarkMode() {
    Settings.darkMode = !isDarkMode.value;
    applyStyleMode();
}

function toggleScrolling() {
    Settings.scrollingEnabled = !isAutoscrollEnabled.value;
    isAutoscrollEnabled.value = Settings.scrollingEnabled;
}
</script>