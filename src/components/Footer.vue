<template>
    <div id="footerBar" role="contentinfo">
        <div id="openWindowArea">
            <!-- One chip per open window, oldest first; a press brings it to the front. -->
            <div v-for="window in dialogState.windows" :id="`${window.id}Marker`" :key="window.id" class="footerBlock"
                @mousedown="bringDialogToFront(window.id)">
                <div class="openWindows" draggable="false">{{ window.name }}</div>
            </div>
        </div>
        <div id="footerFiller"><span id="footerHint" aria-live="polite">{{ footerHintState.text }}</span></div>
        <div id="drumInfoFooter" class="footerBlock" role="button" tabindex="0" title="The drums of the track, one tab line each"
            @click="toggleDialog(DIALOGS.DRUM_INFO, {})" @keydown.enter.prevent="toggleDialog(DIALOGS.DRUM_INFO, {})">Drum map</div>
        <div v-if="isDrumTrack" id="drumGridFooter" class="footerBlock" role="button" tabindex="0"
            title="Edit the cursor's bar as a step grid"
            @click="toggleDialog(DIALOGS.DRUM_GRID, {})" @keydown.enter.prevent="toggleDialog(DIALOGS.DRUM_GRID, {})">Step grid</div>
        <div id="drumMixerOpen" class="footerBlock" role="button" tabindex="0" title="Mixer: every track and the drum kit"
            @click="toggleDialog(DIALOGS.MIXER, {})" @keydown.enter.prevent="toggleDialog(DIALOGS.MIXER, {})">Mixer</div>
        <div id="autoScroll" class="footerBlock" role="button" tabindex="0" :aria-pressed="isAutoscrollEnabled"
            title="Follow the playback position while playing"
            @click="toggleScrolling()" @keydown.enter.prevent="toggleScrolling()"><span class="footerLabel">Autoscroll</span>{{ isAutoscrollEnabled ? 'On' : 'Off' }}</div>
        <div v-if="!isDrumTrack" id="tuningFooter" class="footerBlock" role="button" tabindex="0"
            @click="openInstrumentSettings()" @keydown.enter.prevent="openInstrumentSettings()"><span class="footerLabel">Tuning</span>{{ tuningText }}</div>
        <div v-if="!isDrumTrack" id="capoLabel" class="footerBlock" role="button" tabindex="0"
            @click="openInstrumentSettings()" @keydown.enter.prevent="openInstrumentSettings()"><span class="footerLabel">Capo</span>{{ currentTrack?.capo ?? 0 }}</div>
        <div id="modeSwitcher" class="footerBlock" role="button" tabindex="0" title="Switch between light and dark theme"
            @click="toggleDarkMode()" @keydown.enter.prevent="toggleDarkMode()"><span class="footerLabel">Theme</span>{{ isDarkMode ? 'Dark' : 'Light' }}</div>
        <div id="midiLabel" class="footerBlock" role="button" tabindex="0" title="MIDI input settings"
            @click="toggleDialog(DIALOGS.MIDI, {})" @keydown.enter.prevent="toggleDialog(DIALOGS.MIDI, {})">MIDI
            <span id="isMidiActive" :class="{ activated: midiConnected }" aria-hidden="true"></span>
        </div>
        <!-- Legal pages (static files in public/), reachable from every screen. -->
        <a id="footerImprint" class="footerBlock footerLink" href="impressum.html" target="_blank" rel="noopener">Impressum</a>
        <a id="footerPrivacy" class="footerBlock footerLink" href="datenschutz.html" target="_blank" rel="noopener">Datenschutz</a>
    </div>
</template>

<script setup lang="ts">
import { midiState } from '../services/midi/devices';
import { computed, ref } from 'vue';
import { DIALOGS, toggleDialog } from '../services/dialogs/dialogs';
import Settings from '../stores/settingsState';
import { toggleTheme } from '../services/theme';
import { bringDialogToFront, dialogState } from '../stores/dialogState';
import { useSongData } from '../composables/useSongData';
import { footerHintState } from '../stores/footerHintState';

const midiConnected = computed(() => midiState.devices.some((device) => device.connected));

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const { reactiveSongData } = useSongData();

const isDarkMode = computed(() => Settings.darkMode);
const isAutoscrollEnabled = ref(Settings.scrollingEnabled);

const currentTrackId = computed(() => reactiveSongData.currentTrackId ?? 0);
const currentTrack = computed(() => reactiveSongData.tracks?.[currentTrackId.value] ?? null);

// Drum tracks have a line per drum: no tuning or capo to show.
const isDrumTrack = computed(() => reactiveSongData.playBackInstrument?.[currentTrackId.value]?.instrument === 'drums');

const tuningText = computed(() => formatTuning(currentTrack.value?.strings ?? []));

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
    toggleDialog(DIALOGS.INSTRUMENT_SETTINGS, { trackId: currentTrackId.value });
}

function toggleDarkMode() {
    toggleTheme();
}

function toggleScrolling() {
    Settings.scrollingEnabled = !isAutoscrollEnabled.value;
    isAutoscrollEnabled.value = Settings.scrollingEnabled;
}
</script>