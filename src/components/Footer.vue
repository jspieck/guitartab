<template>
    <div id="footerBar">
        <div id="openWindowArea">
        </div>
        <div id="footerFiller"></div>
        <div id="drumInfoFooter" @click="modalManager.toggleByModal(MODALS.DRUM_INFO, {})" class="footerBlock">DrumInfo</div>
        <!--<div id="samplesOpen" class="footerBlock">Samples</div>-->
        <div id="drumMixerOpen" @click="modalManager.toggleByModal(MODALS.MIXER, {})" class="footerBlock">Drum Mixer</div>
        <div id="autoScroll" @click="toggleScrolling()" class="footerBlock">Autoscroll: Enabled</div>
        <div id="tuningFooter" @click="modalManager.toggleByModal(MODALS.TUNING, { trackId: Song.currentTrackId })" class="footerBlock">Tuning: EADGHE</div>
        <div id="capoLabel" @click="modalManager.toggleByModal(MODALS.TUNING, { trackId: Song.currentTrackId })" class="footerBlock">Capo: 0</div>
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
import Helper from '../assets/js/helper';
import { audioEngine } from '../assets/js/audioEngine';
import { sequencer } from '../assets/js/sequencer';
import { MODALS } from '../assets/js/modals/modalTypes';

const imagePaths = [
    ['playMusicImg', '../assets/images/playButton.svg', '../assets/images/playButtonWhite.svg'],
    ['zoomInImg', '../assets/images/zoomIn.svg', '../assets/images/zoomInWhite.svg'],
    ['zoomOutImg', '../assets/images/zoomOut.svg', '../assets/images/zoomOutWhite.svg'],
    ['wholeNoteImg', '../assets/images/notes/wholeNote.svg', '../assets/images/notes/wholeNoteWhite.svg'],
    ['halfNoteImg', '../assets/images/notes/halfNote.svg', '../assets/images/notes/halfNoteWhite.svg'],
    ['quarterNoteImg', '../assets/images/notes/quarterNote.svg', '../assets/images/notes/quarterNoteWhite.svg'],
    ['8thNoteImg', '../assets/images/notes/eighthNote.svg', '../assets/images/notes/eighthNoteWhite.svg'],
    ['16thNoteImg', '../assets/images/notes/16thNote.svg', '../assets/images/notes/16thNoteWhite.svg'],
    ['32ndNoteImg', '../assets/images/notes/32ndNote.svg', '../assets/images/notes/32ndNoteWhite.svg'],
    ['64thNoteImg', '../assets/images/notes/64thNote.svg', '../assets/images/notes/64thNoteWhite.svg'],
    ['dottedImg', '../assets/images/articulations/dotted.svg', '../assets/images/articulations/dottedWhite.svg'],
    ['doubleDottedImg', '../assets/images/articulations/doubleDotted.svg', '../assets/images/articulations/doubleDottedWhite.svg'],
    ['tupletImg', '../assets/images/articulations/tuplet.svg', '../assets/images/articulations/tupletWhite.svg'],
    ['tiedImg', '../assets/images/articulations/tied.svg', '../assets/images/articulations/tiedWhite.svg'],
    ['infoImg', '../assets/images/info.svg', '../assets/images/infoWhite.svg'],
    ['downloadIDGP', '../assets/images/saveOwn.svg', '../assets/images/saveOwnWhite.svg'],
    ['classicalToggle', '../assets/images/classicalToggle.svg', '../assets/images/classicalToggleWhite.svg'],
    ['pullDownImg', '../assets/images/articulations/hammerOn.svg', '../assets/images/articulations/hammerOnWhite.svg'],
    ['slideImg', '../assets/images/articulations/Slide.svg', '../assets/images/articulations/SlideWhite.svg'],
    ['bendImg', '../assets/images/articulations/bend.svg', '../assets/images/articulations/bendWhite.svg'],
    ['trillImg', '../assets/images/articulations/Triller.svg', '../assets/images/articulations/TrillerWhite.svg'],
    ['tremoloPickingImg', '../assets/images/articulations/tremoloPicking.svg', '../assets/images/articulations/tremoloPickingWhite.svg'],
    ['tremoloBarImg', '../assets/images/articulations/tremoloBar.svg', '../assets/images/articulations/tremoloBarWhite.svg'],
    ['deadImg', '../assets/images/articulations/dead.svg', '../assets/images/articulations/deadWhite.svg'],
    ['stacattoImg', '../assets/images/articulations/Stacatto.svg', '../assets/images/articulations/StacattoWhite.svg'],
    ['palmMuteImg', '../assets/images/articulations/PalmMute.svg', '../assets/images/articulations/PalmMuteWhite.svg'],
    ['fadeInImg', '../assets/images/articulations/fadeIn.svg', '../assets/images/articulations/fadeInWhite.svg'],
    ['vibratoImg', '../assets/images/articulations/vibrato.svg', '../assets/images/articulations/vibratoWhite.svg'],
    ['graceImg', '../assets/images/articulations/grace.svg', '../assets/images/articulations/graceWhite.svg'],
    ['artificialImg', '../assets/images/articulations/artificial.svg', '../assets/images/articulations/artificialWhite.svg'],
    ['ghostNoteImg', '../assets/images/articulations/brackets.svg', '../assets/images/articulations/bracketsWhite.svg'],
    ['accentuatedImg', '../assets/images/articulations/Accentuated.svg', '../assets/images/articulations/AccentuatedWhite.svg'],
    ['heavyAccentuatedImg', '../assets/images/articulations/heavyAccentuated.svg', '../assets/images/articulations/heavyAccentuatedWhite.svg'],
    ['strokeImg', ' ../assets/images/articulations/stroke.svg', ' ../assets/images/articulations/strokeWhite.svg'],
    ['letRingImg', ' ../assets/images/articulations/letRing.svg', ' ../assets/images/articulations/letRingWhite.svg'],

    ['timeMeterImg', '../assets/images/statusBar/denom.svg', '../assets/images/statusBar/denomWhite.svg'],
    ['bpmMeterImg', '../assets/images/statusBar/bpmMeter.svg', '../assets/images/statusBar/bpmMeterWhite.svg'],
    ['addMeasureImg', ' ../assets/images/statusBar/addMeasure.svg', '../assets/images/statusBar/addMeasureWhite.svg'],
    ['removeMeasureImg', ' ../assets/images/statusBar/removeMeasure.svg', '../assets/images/statusBar/removeMeasureWhite.svg'],
    ['openBarImg', '../assets/images/statusBar/openBar.svg', '../assets/images/statusBar/openBarWhite.svg'],
    ['closeBarImg', '../assets/images/statusBar/closeBar.svg', '../assets/images/statusBar/closeBarWhite.svg'],
    ['repeatAlternativeImg', '../assets/images/statusBar/repeatAlternative.svg', '../assets/images/statusBar/repeatAlternativeWhite.svg'],

    ['addChordImg', '../assets/images/statusBar/chord.svg', '../assets/images/statusBar/chordWhite.svg'],
    ['addTextImg', '../assets/images/statusBar/text.svg', '../assets/images/statusBar/textWhite.svg'],
    ['addMarkerImg', '../assets/images/statusBar/marker.svg', '../assets/images/statusBar/markerWhite.svg'],
    ['pauseMusicImg', '../assets/images/pause.svg', '../assets/images/pauseWhite.svg'],
    ['oneMeasureBackImg', '../assets/images/statusBar/backward.svg', '../assets/images/statusBar/backwardWhite.svg'],
    ['oneMeasureForwardImg', '../assets/images/statusBar/forward.svg', '../assets/images/statusBar/forwardWhite.svg'],
    ['sequencerEditImg', '../assets/images/cogWheel.svg', '../assets/images/cogWheelWhite.svg'],
    ['sequencerAddInstrument', '../assets/images/addInstrument.svg', '../assets/images/addInstrumentWhite.svg'],
    ['sequencerToggle', '../assets/images/sequencerToggle.svg', '../assets/images/sequencerToggleWhite.svg'],
    ['fullscreenImg', '../assets/images/fullscreen.svg', '../assets/images/fullscreenWhite.svg'],
    ['chordSection', '../assets/images/chordSection.svg', '../assets/images/chordSectionWhite.svg'],
];

function applyStyleMode() {
    sequencer.drawBeat();
    audioEngine.equalizer.redraw();
    if (Settings.darkMode) {
        for (let i = 0; i < imagePaths.length; i += 1) {
            document.getElementById(imagePaths[i][0])?.setAttribute('src', imagePaths[i][2]);
        }
        document.getElementById('modeSwitcher')!.textContent = 'Dark Design';
        document.body.setAttribute('id', 'darkMode');
    } else {
        for (let i = 0; i < imagePaths.length; i += 1) {
            document.getElementById(imagePaths[i][0])?.setAttribute('src', imagePaths[i][1]);
        }
        document.getElementById('modeSwitcher')!.textContent = 'White Design';
        document.body.setAttribute('id', 'lightMode');
    }
    (document.getElementById('trackSignImg') as HTMLImageElement).src = Helper.getIconSrc(
        Song.playBackInstrument[Song.currentTrackId].instrument,
    );
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