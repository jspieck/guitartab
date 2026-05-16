<template>
    <div id="footerBar">
        <div id="openWindowArea">
        </div>
        <div id="footerFiller"></div>
        <div id="drumInfoFooter" @click="modalManager.toggleByModal(MODALS.DRUM_INFO, {})" class="footerBlock">DrumInfo</div>
        <!--<div id="samplesOpen" class="footerBlock">Samples</div>-->
        <div id="drumMixerOpen" @click="modalManager.toggleByModal(MODALS.MIXER, {})" class="footerBlock">Drum Mixer</div>
        <div id="autoScroll" @click="toggleScrolling()" class="footerBlock">Autoscroll: Enabled</div>
        <div id="tuningFooter" @click="modalManager.toggleByModal(MODALS.INSTRUMENT_SETTINGS, { trackId: Song.currentTrackId })" class="footerBlock">Tuning: EADGHE</div>
        <div id="capoLabel" @click="modalManager.toggleByModal(MODALS.INSTRUMENT_SETTINGS, { trackId: Song.currentTrackId })" class="footerBlock">Capo: 0</div>
        <div id="modeSwitcher" @click="toggleDarkMode()" class="footerBlock">White Design</div>
        <div id="midiLabel" @click="modalManager.toggleByModal(MODALS.MIDI, {})" class="footerBlock">Midi</div>
        <div class="footerBlock">
        <div id="isMidiActive"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { modalManager } from '../assets/js/modals/modalManager';
import Settings from '../assets/js/settingManager';
import Song from '../assets/js/songData';
import { sequencerHandler } from '../assets/js/sequencerHandler';
import { MODALS } from '../assets/js/modals/modalTypes';

function applyStyleMode() {
    sequencerHandler.drawBeat();
    if (Settings.darkMode) {
        document.getElementById('modeSwitcher')!.textContent = 'Dark Design';
        document.body.setAttribute('id', 'darkMode');
    } else {
        document.getElementById('modeSwitcher')!.textContent = 'White Design';
        document.body.setAttribute('id', 'lightMode');
    }
}

function toggleDarkMode() {
    Settings.darkMode = !Settings.darkMode;
    Settings.save('darkMode', Settings.darkMode);
    applyStyleMode();
}

function toggleScrolling() {
    if (Settings.scrollingEnabled) {
        document.getElementById('autoScroll')!.textContent = 'AutoScroll: Disabled';
    } else {
        document.getElementById('autoScroll')!.textContent = 'AutoScroll: Enabled';
    }
    Settings.scrollingEnabled = !Settings.scrollingEnabled;
}
</script>