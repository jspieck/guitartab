<template>
    <div id="footerBar">
        <div id="openWindowArea">
        </div>
        <div id="footerFiller"></div>
        <div id="drumInfoFooter" @click="modalManager.toggleByModal(MODALS.DRUM_INFO, {})" class="footerBlock">DrumInfo</div>
        <!--<div id="samplesOpen" class="footerBlock">Samples</div>-->
        <div id="drumMixerOpen" @click="modalManager.toggleByModal(MODALS.MIXER, {})" class="footerBlock">Drum Mixer</div>
        <div id="autoScroll" @click="toggleScrolling()" class="footerBlock">{{ autoScrollLabel }}</div>
        <div id="tuningFooter" @click="openInstrumentSettings()" class="footerBlock">{{ tuningLabel }}</div>
        <div id="capoLabel" @click="openInstrumentSettings()" class="footerBlock">{{ capoLabel }}</div>
        <div id="modeSwitcher" @click="toggleDarkMode()" class="footerBlock">{{ styleModeLabel }}</div>
        <div id="midiLabel" @click="modalManager.toggleByModal(MODALS.MIDI, {})" class="footerBlock">Midi</div>
        <div class="footerBlock">
        <div id="isMidiActive"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { modalManager } from '../assets/js/modals/modalManager';
import Settings from '../assets/js/settingManager';
import { sequencerHandler } from '../assets/js/sequencerHandler';
import { MODALS } from '../assets/js/modals/modalTypes';
import { useSongData } from '../composables/useSongData';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const { reactiveSongData } = useSongData();

const isDarkMode = ref(Settings.darkMode);
const isAutoscrollEnabled = ref(Settings.scrollingEnabled);

const currentTrackId = computed(() => reactiveSongData.currentTrackId ?? 0);
const currentTrack = computed(() => reactiveSongData.tracks?.[currentTrackId.value] ?? null);

const autoScrollLabel = computed(() => `Autoscroll: ${isAutoscrollEnabled.value ? 'Enabled' : 'Disabled'}`);
const styleModeLabel = computed(() => (isDarkMode.value ? 'Dark Design' : 'White Design'));
const tuningLabel = computed(() => `Tuning: ${formatTuning(currentTrack.value?.strings ?? [])}`);
const capoLabel = computed(() => `Capo: ${currentTrack.value?.capo ?? 0}`);

watch(isDarkMode, (darkModeEnabled) => {
    sequencerHandler.drawBeat();
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