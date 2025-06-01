<template>
    <div id="completeBar">
        <div id="tabBar">
            <button id="oneMeasureBack" @click="playBackJump(true)" class="voiceButton playChange">
                <img id="oneMeasureBackImg" src='../assets/images/statusBar/backward.svg' />
            </button>
            <button id="play" @click="playBackLogic.playSongB()" class="playStart">
                <img id="playMusicImg" src="../assets/images/playButton.svg" />
                <img id="pauseMusicImg" src="../assets/images/pause.svg" />
            </button>
            <button id="oneMeasureForward" @click="playBackJump(false)" class="voiceButton playChange"><img id="oneMeasureForwardImg"
                    src="../assets/images/statusBar/forward.svg" /></button>
            <div id="barButtons">
                <div v-for="button in barDict" @click="menuHandler.selectBar(button.id)" :key="button.id" :id="`barButton${button.id}`" :class="button.class">{{ button.label }}</div>
            </div>
        </div>
        <div class="bottomStatusBar">
            <button id="stopButton" @click="playBackLogic.stopSong()" class="checkBoxNote"></button>
            <button id="recordButton" @click="recordButtonPressed()" class="checkBoxNote"></button>
            <div id="statusBars">
                <div id="statusBar1" class="statusBar statusBarSelected">
                    <div class="checkBoxBar">
                        <button @click="menuHandler.noteLengthSelect('wholeNote', 'w')" id="wholeNote" data-tooltip="Whole"
                            class="checkBoxNote"><img id="wholeNoteImg" src="../assets/images/notes/wholeNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('halfNote', 'h')" id="halfNote" data-tooltip="Half"
                            class="checkBoxNote"><img id="halfNoteImg" width="15" height="25"
                                src="../assets/images/notes/halfNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('quarterNote', 'q')" id="quarterNote" data-tooltip="Quarter"
                            class="checkBoxNote"><img id="quarterNoteImg" width="15" height="25"
                                src="../assets/images/notes/quarterNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('8thNote', 'e')" id="8thNote" data-tooltip="Eighth"
                            class="checkBoxNote pressed"><img id="8thNoteImg" class="noteImg"
                                src="../assets/images/notes/eighthNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('16thNote', 's')" id="16thNote" data-tooltip="16th"
                            class="checkBoxNote"><img id="16thNoteImg" class="noteImg"
                                src="../assets/images/notes/16thNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('32ndNote', 't')" id="32ndNote" data-tooltip="32nd"
                            class="checkBoxNote"><img id="32ndNoteImg" class="noteImg"
                                src="../assets/images/notes/32ndNote.svg" /></button>
                        <button @click="menuHandler.noteLengthSelect('64thNote', 'z')" id="64thNote" data-tooltip="64th"
                            class="checkBoxNote"><img id="64thNoteImg" class="noteImg"
                                src="../assets/images/notes/64thNote.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        
                        <button id="dotted" @click="noteLengthSpecialSelect('dotted')" data-tooltip="Dotted" class="checkBoxNote"><img id="dottedImg"
                                src="../assets/images/articulations/dotted.svg" /></button>
                        <button id="doubleDotted" @click="noteLengthSpecialSelect('doubleDotted')" data-tooltip="Double Dotted" class="checkBoxNote"><img
                                id="doubleDottedImg" src="../assets/images/articulations/doubleDotted.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <div class="checkBoxDov">
                            <button id="tuplet" @click="noteLengthSpecialSelect('tuplet')" class="checkBoxNote"><img id="tupletImg"
                                    src="../assets/images/articulations/tuplet.svg" /></button>
                            <select id="tupletDropDown">
                                <option v-for="num in [3, 5, 6, 7, 9, 11]" :value="num">{{ num }}</option>
                            </select>
                        </div>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tied" @click="noteLengthSpecialSelect('tied')" data-tooltip="Tied" class="checkBoxNote"><img id="tiedImg"
                                src="../assets/images/articulations/tied.svg" /></button>

                        <button id="info" @click="modalManager.toggleByModal(MODALS.INFO)" class="checkBoxNote playButton"><img id="infoImg"
                                src="../assets/images/info.svg" /></button>

                        <!--<button id="download" data-tooltip="Download XML" onclick="downloadXML()" class="checkBoxNote playButton"><img id="downloadID" src="../assets/images/download.svg"/></button>-->
                        <button id="downloadGP" data-tooltip="Download File" onclick="saveAsGt()"
                            class="checkBoxNote playButton"><img id="downloadIDGP" src="../assets/images/saveOwn.svg" /></button>

                        <button id="createPDF" data-tooltip="Create PDF" onclick="createPDF()"
                            class="checkBoxNote playButton"><img src="../assets/images/pdf.svg" /></button>
                        <!--<div class="wrapper">
                            <div class="file-upload">
                                <input id="files" type="file" accept=".gp5, .gp4, .gp3"/>
                                <img src="https://gtiuebung.de/wp-content/uploads/2016/12/upload.svg"/>
                            </div>
                        </div>-->
                    </div>
                </div>
                <div id="statusBar2" class="statusBar">
                    <div class="checkBoxBar">
                        <button id="pullDown" @click="noteEffectSelect('pullDown')" data-tooltip="HammerOn/PullDown" class="checkBoxNote"><img id="pullDownImg"
                                src="../assets/images/articulations/hammerOn.svg" /></button>
                        <button id="slide" @click="noteEffectSelect('slide')" data-tooltip="Slide" class="checkBoxNote"><img id="slideImg"
                                src="../assets/images/articulations/Slide.svg" /></button>
                        <button id="bend" @click="noteEffectSelect('bend')" data-tooltip="Bend" class="checkBoxNote"><img id="bendImg"
                                src="../assets/images/articulations/bend.svg" /></button>
                        <button id="trill" @click="noteEffectSelect('trill')" data-tooltip="Trill" class="checkBoxNote"><img id="trillImg"
                                src="../assets/images/articulations/Triller.svg" /></button>
                        <button id="tremoloPicking" @click="noteEffectSelect('tremoloPicking')" data-tooltip="Tremolo Picking" class="checkBoxNote"><img
                                id="tremoloPickingImg" src="../assets/images/articulations/tremoloPicking.svg" /></button>
                        <button id="tremoloBar" @click="noteEffectSelect('tremoloBar')" data-tooltip="Tremolo Bar" class="checkBoxNote"><img id="tremoloBarImg"
                                src="../assets/images/articulations/tremoloBar.svg" /></button>
                        <button id="dead" @click="noteEffectSelect('dead')" data-tooltip="Dead Note" class="checkBoxNote"><img id="deadImg"
                                src="../assets/images/articulations/dead.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stacatto" @click="noteEffectSelect('stacatto')" data-tooltip="Stacatto" class="checkBoxNote"><img id="stacattoImg"
                                src="../assets/images/articulations/Stacatto.svg" /></button>
                        <button id="palmMute" @click="noteEffectSelect('palmMute')" data-tooltip="Palm Mute" class="checkBoxNote"><img id="palmMuteImg"
                                src="../assets/images/articulations/PalmMute.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tap" @click="noteEffectSelect('tap')" data-tooltip="Tap" class="checkBoxNote">T</button>
                        <button id="slap" @click="noteEffectSelect('slap')" data-tooltip="Slap" class="checkBoxNote">S</button>
                        <button id="pop" @click="noteEffectSelect('pop')" data-tooltip="Pop" class="checkBoxNote">P</button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="fadeIn" @click="noteEffectSelect('fadeIn')" data-tooltip="Fade-In" class="checkBoxNote"><img id="fadeInImg"
                                src="../assets/images/articulations/fadeIn.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="vibrato" @click="noteEffectSelect('vibrato')" data-tooltip="Vibrato" class="checkBoxNote"><img id="vibratoImg"
                                src="../assets/images/articulations/vibrato.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="grace" @click="noteEffectSelect('grace')" data-tooltip="Grace" class="checkBoxNote"><img id="graceImg"
                                src="../assets/images/articulations/grace.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="artificial" @click="noteEffectSelect('artificial')" data-tooltip="Harmonics" class="checkBoxNote"><img id="artificialImg"
                                src="../assets/images/articulations/artificial.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="ghost" @click="noteEffectSelect('ghost')" data-tooltip="Ghost Note" class="checkBoxNote"><img id="ghostNoteImg"
                                src="../assets/images/articulations/brackets.svg" /></button>
                        <button id="accentuated" @click="noteEffectSelect('accentuated')" data-tooltip="Accentuated" class="checkBoxNote"><img id="accentuatedImg"
                                src="../assets/images/articulations/Accentuated.svg" /></button>
                        <button id="heavyAccentuated" @click="noteEffectSelect('heavyAccentuated')" data-tooltip="Heavy Accentuated" class="checkBoxNote"><img
                                id="heavyAccentuatedImg" src="../assets/images/articulations/heavyAccentuated.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stroke" @click="noteEffectSelect('stroke')" data-tooltip="Stroke" class="checkBoxNote"><img id="strokeImg"
                                src="../assets/images/articulations/stroke.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="letRing" @click="noteEffectSelect('letRing')" data-tooltip="Let Ring" class="checkBoxNote"><img id="letRingImg"
                                src="../assets/images/articulations/letRing.svg" /></button>
                    </div>
                </div>
                <div id="statusBar3" class="statusBar">
                    <div class="checkBoxBar">
                        <button v-for="note in dynamicNotes" @click="dynamicSelect(note.id)" :key="note.id" :id="note.id" :data-tooltip="note.tooltip" :class="note.class">{{ note.label }}</button>
                    </div>
                </div>
                <div id="statusBar4" class="statusBar">
                    <div class="checkBoxBar">
                        <button id="timeMeter" @click="notationSelect('timeMeter')" data-tooltip="Time Meter" class="checkBoxNote"><img id="timeMeterImg"
                                src="../assets/images/statusBar/denom.svg" /></button>
                        <button id="bpmMeter" @click="notationSelect('bpmMeter')" data-tooltip="BPM" class="checkBoxNote"><img id="bpmMeterImg"
                                src="../assets/images/statusBar/bpmMeter.svg" /></button>
                        <button id="addMeasure" @click="tab.addBlock(false)" data-tooltip="Add Measure" class="checkBoxNote"><img id="addMeasureImg"
                                src="../assets/images/statusBar/addMeasure.svg" /></button>
                        <button id="removeMeasure" @click="tab.removeBlock(false)" data-tooltip="Remove Measure" class="checkBoxNote"><img
                                id="removeMeasureImg" src="../assets/images/statusBar/removeMeasure.svg" /></button>
                        <button id="openBar" @click="measureSelect('openBar')" data-tooltip="Add Open Bar" class="checkBoxNote"><img id="openBarImg"
                                src="../assets/images/statusBar/openBar.svg" /></button>
                        <button id="closeBar" @click="notationSelect('closeBar')" data-tooltip="Add Close Bar" class="checkBoxNote"><img id="closeBarImg"
                                src="../assets/images/statusBar/closeBar.svg" /></button>
                        <button id="repeatAlternative" @click="notationSelect('repeatAlternative')" data-tooltip="Add Repeat Alternative" class="checkBoxNote"><img
                                id="repeatAlternativeImg" src="../assets/images/statusBar/repeatAlternative.svg" /></button>
                    </div>
                </div>
                <div id="statusBar5" class="statusBar">
                    <div class="checkBoxBar">
                        <button id="addChord" @click="notationSelect('addChord')" data-tooltip="Add Chord" class="checkBoxNote"><img id="addChordImg"
                                src="../assets/images/statusBar/chord.svg" /></button>
                        <button id="addText" @click="notationSelect('addText')" data-tooltip="Add Text" class="checkBoxNote"><img id="addTextImg"
                                src="../assets/images/statusBar/text.svg" /></button>
                        <button id="addMarker" @click="notationSelect('addMarker')" data-tooltip="Add Marker" class="checkBoxNote"><img id="addMarkerImg"
                                src="../assets/images/statusBar/marker.svg" /></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="sideBarButtons">
        <label class="bpmSidebarLabel">BPM</label>
        <div id="tempoMeter" @mousedown="(e) => { changeTempoFunc(e) }" class="disable-select">90</div>
        <button id="classicalToggleButton" @click="classicalNotation.toggleClassicalVisibility()" data-tooltip="Piano Note View" class="classicalButton"><img id="classicalToggle"
                src="../assets/images/classicalToggle.svg" /></button>
        <button data-tooltip="Chords Menu" class="classicalButton">
            <img id="chordSection" @click="modalManager.toggleByModal(MODALS.CHORD_MANAGER, {trackId: Song.currentTrackId})" class="classicalButton"
                src="../assets/images/chordSection.svg" />
        </button>
        <button id="zoomIn" @click="tab.scaleCompleteTab(true)" data-tooltip="Zoom In" class="classicalButton"><img id="zoomInImg"
                src="../assets/images/zoomIn.svg" /></button>
        <button id="zoomOut" @click="tab.scaleCompleteTab(false)" data-tooltip="Zoom Out" class="classicalButton"><img id="zoomOutImg"
                src="../assets/images/zoomOut.svg" /></button>
        <button id="fullscreen" @click="svgDrawer.disablePageMode()" data-tooltip="Fullscreen" class="classicalButton"><img id="fullscreenImg"
                src="../assets/images/fullscreen.svg" /></button>

        <button id="guitarEyeToggle" @click="modalManager.toggleByModal(MODALS.GUITAR)" data-tooltip="Virtual Guitar" class="classicalButton">
            <img src="../assets/images/guitarIconBorder.svg" />
        </button>
        <button id="pianoEyeToggle" @click="modalManager.toggleByModal(MODALS.PIANO)" data-tooltip="Virtual Piano" class="classicalButton">
            <img src="../assets/images/pianoIconBorder.svg" />
        </button>

        <label id="voiceLabel">Voice</label>
        <button id="voice0" @click="menuHandler.selectVoice(0)" class="voiceButton voiceSelected">1</button>
        <button id="voice1" @click="menuHandler.selectVoice(1)" class="voiceButton">2</button>
        <!--<div id="pageLayoutToggle"></div>-->
    </div>
    <div id="trackCapsule">
        <div id="trackSign"><img id="trackSignImg" src="../assets/images/instrumentIcons/myAccGuitarDesign.svg" /></div>
    </div>
</template>

<script setup lang="ts">
import fastdom from 'fastdom';

import Duration from '../assets/js/duration';
import midiEngine from '../assets/js/midiReceiver';
import { revertHandler } from '../assets/js/revertHandler';
import { svgDrawer } from '../assets/js/svgDrawer';
import { modalManager } from '../assets/js/modals/modalManager';
import Settings from '../assets/js/settingManager';
import Song, { Note, Measure } from '../assets/js/songData';
import { tab, Tab } from '../assets/js/tab';
import playBackLogic from '../assets/js/playBackLogicNew';
import AppManager from '../assets/js/appManager';
import { classicalNotation } from '../assets/js/vexflowClassical';
import { SequencerHandler } from '../assets/js/sequencerHandler';
import { overlayHandler } from '../assets/js/overlayHandler';
import { onMounted, onBeforeUnmount } from 'vue';
import EventBus from "../assets/js/eventBus";
import { menuHandler } from '../assets/js/menuHandler';
import { MODALS } from '../assets/js/modals/modalTypes';

function clickedOnPos(position: {trackId: number, blockId: number, voiceId: number, beatId: number, string: number}) {
    const {trackId, blockId, voiceId, beatId, string} = position;
    menuHandler.activateEffectsForPos(trackId, blockId, voiceId, beatId, string);
    menuHandler.setNoteLengthForMark(trackId, blockId, voiceId, beatId, string);
}

onMounted(() => {
    // EventBus.on("menu.applyStyleMode", () => applyStyleMode);
    // EventBus.on("menu.handleEffectGroupCollision", {notes: arr.notes, property: 'bend', isVariableSet})
    EventBus.on("menu.activateEffectsForMarkedBeat", () => menuHandler.activateEffectsForMarkedBeat);
    EventBus.on("menu.activateEffectsForMarkedPos", () => menuHandler.activateEffectsForMarkedPos);
    EventBus.on("menu.activateEffectsForBeat", beat => menuHandler.activateEffectsForBeat(beat as Measure));
    EventBus.on("menu.disableNoteEffectButtons", () => menuHandler.disableNoteEffectButtons);
    EventBus.on("menu.activateEffectsForBlock", () => menuHandler.activateEffectsForBlock)
    EventBus.on("menu.activateEffectsForPos", () => (trackId: number, blockId: number, voiceId: number, beatId: number, string: number) => menuHandler.activateEffectsForPos(trackId, blockId, voiceId, beatId, string));
    EventBus.on("menu.activateEffectsForNote", note => menuHandler.activateEffectsForNote(note as Note));
    EventBus.on("menu.clickedOnPos", position => clickedOnPos(position as {trackId: number, blockId: number, voiceId: number, beatId: number, string: number}));
    
})

onBeforeUnmount(() => {
    EventBus.off("menu.activateEffectsForNote", note => menuHandler.activateEffectsForNote(note as Note));
    EventBus.off("menu.clickedOnPos", position => clickedOnPos(position as {trackId: number, blockId: number, voiceId: number, beatId: number, string: number}));
});

let tempoMoveTmp = () => { };
let removeListenersTmp = () => { };
let noteTiedTo: {blockId: number, beatId: number} | null = null;
let initYPos = 0;
let oldBpm = 90;
let lastMeasureSelectButton = '';

const effectGroups = [
    ['pullDown', 'slide', 'bend', 'trill', 'tremoloPicking', 'tremoloBar', 'dead'],
    ['stacatto', 'palmMute'],
    ['tap', 'slap', 'pop'],
    ['fadeIn'],
    ['grace'],
    ['vibrato'],
    ['artificial'],
    ['accentuated', 'heavyAccentuated', 'ghost'],
    ['stroke'],
    ['addChord'],
    ['addText'],
    ['addMarker'],
    ['repeatAlternative'],
    ['pppDynamic', 'ppDynamic', 'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'],
    ['openBar'],
    ['closeBar'],
    ['timeMeter'],
    ['bpmMeter'],
    ['letRing'],
];
const secondStatusBar = ['pullDown', 'ghost', 'stacatto', 'accentuated', 'heavyAccentuated', 'palmMute',
    'vibrato', 'tremoloBar', 'artificial', 'trill', 'bend', 'slide', 'tap', 'fadeIn', 'grace', 'slap', 'pop',
    'dead', 'tremoloPicking', 'stroke', 'letRing'];

const elementToProperty = {
    bend: 'bendPresent',
    artificial: 'artificialPresent',
    tap: 'tap',
    slide: 'slide',
    fadeIn: 'fadeIn',
    grace: 'grace',
    pullDown: 'pullDown',
    stacatto: 'stacatto',
    accentuated: 'accentuated',
    trill: 'trillPresent',
    dead: 'dead',
    heavyAccentuated: 'heavyAccentuated',
    palmMute: 'palmMute',
    vibrato: 'vibrato',
    slap: 'slap',
    pop: 'pop',
    tremoloPicking: 'tremoloPicking',
    letRing: 'letRing',
    ghost: 'ghost',
};


const dynamicNotes = [
  { id: "pppDynamic", tooltip: "Pianississimo", class: "checkBoxNote dynamicNote", label: "¸" },
  { id: "ppDynamic", tooltip: "Pianissimo", class: "checkBoxNote dynamicNote", label: "pp" },
  { id: "pDynamic", tooltip: "Piano", class: "checkBoxNote dynamicNote", label: "p" },
  { id: "mpDynamic", tooltip: "Mezzo Piano", class: "checkBoxNote dynamicNote", label: "P" },
  { id: "mfDynamic", tooltip: "Mezzo Forte", class: "checkBoxNote dynamicNote", label: "F" },
  { id: "fDynamic", tooltip: "Forte", class: "checkBoxNote dynamicNote", label: "f" },
  { id: "ffDynamic", tooltip: "Fortissimo", class: "checkBoxNote dynamicNote", label: "Ä" },
  { id: "fffDynamic", tooltip: "Fortississimo", class: "checkBoxNote dynamicNote", label: "ì" },
];
const barDict = [
    { id: 1, class: "tabBarElem tabBarElemSelected", label: "Basic" },
    { id: 2, class: "tabBarElem", label: "Articulation" },
    { id: 3, class: "tabBarElem", label: "Dynamics" },
    { id: 4, class: "tabBarElem", label: "Measure" },
    { id: 5, class: "tabBarElem", label: "Text" },
];

function playBackJump(isBackwards: boolean) {
    if (!Settings.songPlaying) { return; }
    if (isBackwards) {
        playBackLogic.moveOneBackward();
    } else {
        playBackLogic.moveOneForward();
    }
}

function removeEventListenersTempo() {
    document.body.classList.remove('disableMouseEffects');
    document.removeEventListener('mousemove', tempoMoveTmp);
    document.removeEventListener('mouseup', removeListenersTmp);
}

function tempoMeterMouseMove(event: MouseEvent) {
    const tempoMeter = document.getElementById('tempoMeter');
    const mouseYnew = event.pageY;
    Song.bpm = oldBpm + initYPos - mouseYnew;
    Song.bpm = Math.max(Song.bpm, 10);
    Song.bpm = Math.min(Song.bpm, 180);
    tempoMeter!.textContent = Song.bpm.toString();
}

function changeTempoFunc(e: MouseEvent) {
    initYPos = e.pageY;
    oldBpm = Song.bpm;
    // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
    tempoMoveTmp = tempoMeterMouseMove.bind(this);
    removeListenersTmp = removeEventListenersTempo.bind(this);
    document.addEventListener('mousemove', tempoMoveTmp);
    document.body.classList.add('disableMouseEffects');
    document.addEventListener('mousemove', tempoMoveTmp);
    document.addEventListener('mouseup', removeListenersTmp);
}

function recordButtonPressed() {
    if (midiEngine.isRecording) {
        document.getElementById('recordButton')?.classList.remove('prepareRecording');
        midiEngine.stopRecording();
    } else {
        document.getElementById('recordButton')?.classList.add('prepareRecording');
        midiEngine.recordMidi();
    }
}

function processDynamicSelect(
    arr: {
        notes: {
            trackId: number, blockId: number, voiceId: number, beatId: number,
            string: number
        }[],
        blocks: number[]
    },
    id: string,
    isRevert: boolean,
) {
    let dynamic = '';
    switch (id) {
        case 'pppDynamic': dynamic = 'ppp'; break;
        case 'ppDynamic': dynamic = 'pp'; break;
        case 'pDynamic': dynamic = 'p'; break;
        case 'mpDynamic': dynamic = 'mp'; break;
        case 'mfDynamic': dynamic = 'mf'; break;
        case 'fDynamic': dynamic = 'f'; break;
        case 'ffDynamic': dynamic = 'ff'; break;
        case 'fffDynamic': dynamic = 'fff'; break;
        default: break;
    }

    let isVariableSet = true;
    for (const {
        trackId, blockId, voiceId, beatId,
    } of arr.notes) {
        const beat = Song.measures[trackId][blockId][voiceId][beatId];
        if (!beat.dynamicPresent || beat.dynamic !== dynamic) {
            isVariableSet = false;
        }
    }
    for (const {
        trackId, blockId, voiceId, beatId, string,
    } of arr.notes) {
        const beat = Song.measures[trackId][blockId][voiceId][beatId];
        const note = beat.notes[string];
        beat.dynamic = dynamic;

        // var isVariableSet = false;
        for (let i = 0; i < effectGroups.length; i += 1) {
            if (effectGroups[i].includes(id)) {
                // isVariableSet = getEffectVariable(beat, note, id);
                menuHandler.deactivateEffects(beat, note, effectGroups[i]);

                if (isVariableSet == null || isVariableSet === false) {
                    menuHandler.setEffectVariable(beat, note, id, true);
                    document.getElementById(id)?.classList.toggle('pressed');
                } else {
                    menuHandler.setEffectVariable(beat, note, id, false);
                }
                break;
            }
        }
        if (isRevert == null) {
            revertHandler.addDynamic(trackId, blockId, voiceId, beatId, string, id);
        }
    }
    const { trackId, voiceId } = arr.notes[0];
    for (const blockId of arr.blocks) {
        svgDrawer.renderOverBar(trackId, blockId, voiceId, false);
    }
}

function dynamicSelect(id: string) {
    if (AppManager.duringTrackCreation) {
        return;
    }
    const arr = overlayHandler.getNotesInInterval(null);
    processDynamicSelect(arr!, id, false);
}

function toggleEffectSelect(id: string, beat: Measure) {
    let isVariableSet = false;
    for (let i = 0; i < effectGroups.length; i += 1) {
        if (effectGroups[i].includes(id)) {
            isVariableSet = menuHandler.getEffectVariable(beat, null, id);
            menuHandler.deactivateEffects(beat, null, effectGroups[i]);

            if (isVariableSet == null || isVariableSet === false) {
                menuHandler.setEffectVariable(beat, null, id, true);
                document.getElementById(id)?.classList.toggle('pressed');
            } else {
                menuHandler.setEffectVariable(beat, null, id, false);
            }
            break;
        }
    }
}

/*  BLOCK: #addMarker, #repeatAlternative
      BEAT: #stroke, #tremoloBar, #"+beat.dynamic+"Dynamic , !#addText, #addChord
  } */
function processNotationSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    id: string, isRevert: boolean,
) {
    console.log('Process Notation Select', id, isRevert);
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (id === 'addText' && !isRevert && !beat.textPresent) {
        modalManager.toggleByModal(MODALS.TEXT, { trackId, blockId, voiceId, beatId, beat });
    } else if (id === 'addChord' && !isRevert && !beat.chordPresent) {
        modalManager.toggleByModal(MODALS.ADD_CHORD, { trackId, blockId, voiceId, beatId });
    } else if (id === 'addMarker' && !isRevert && !Song.measureMeta[blockId].markerPresent) {
        modalManager.toggleByModal(MODALS.MARKER, { trackId, blockId, voiceId });
    } else if (id === 'repeatAlternative' && !isRevert && !Song.measureMeta[blockId].repeatAlternativePresent) {
        modalManager.toggleByModal(MODALS.REPEAT_ALTERNATIVE, { trackId, blockId, voiceId });
    } else if (id === 'closeBar' && !isRevert && !Song.measureMeta[blockId].repeatClosePresent) {
        modalManager.toggleByModal(MODALS.REPETITION, { trackId, blockId, voiceId, isRepetition: true });
    } else if (id === 'timeMeter' && !isRevert && (blockId === 0 || !Song.measureMeta[blockId].timeMeterPresent)) {
        modalManager.toggleByModal(MODALS.TIME_METER, { trackId, blockId, voiceId });
    } else if (id === 'bpmMeter' && !isRevert && !Song.measureMeta[blockId].bpmPresent) {
        modalManager.toggleByModal(MODALS.TEMPO, { trackId, blockId, voiceId });
    } else {
        if (isRevert == null && id !== 'timeMeter' && id !== 'addMarker') {
            revertHandler.addNotationSelect(trackId, blockId, voiceId, beatId, id);
        }
        if (id === 'addMarker' && Song.measureMeta[blockId].markerPresent) {
            revertHandler.addMarker(
                trackId, blockId, Song.measureMeta[blockId].marker,
                Song.measureMeta[blockId].marker, true, false,
            );
            SequencerHandler.removeMarker(blockId);
        }
        // Extra for time meter
        if (id === 'timeMeter' && isRevert == null && blockId !== 0 && Song.measureMeta[blockId].timeMeterPresent) {
            // TODO search last time meter and adapt blocks
            const currentDenominator = Song.measureMeta[blockId].denominator;
            const currentNumerator = Song.measureMeta[blockId].numerator;
            let foundBlock = 0;
            for (let i = blockId - 1; i >= 0; i -= 1) {
                if (currentNumerator !== Song.measureMeta[i].numerator
                    || currentDenominator !== Song.measureMeta[i].denominator) {
                    foundBlock = i;
                    break;
                }
            }
            const notesBefore = AppManager.checkAndAdaptTimeMeter(foundBlock);
            const newDenominator = Song.measureMeta[foundBlock].denominator;
            const newNumerator = Song.measureMeta[foundBlock].numerator;
            // Set until the end of track/ next timeMeter
            for (let bId = blockId; bId < Song.measureMeta.length; bId += 1) {
                if (Song.measureMeta[bId].timeMeterPresent) { break; }
                Song.measureMeta[bId].numerator = newNumerator;
                Song.measureMeta[bId].denominator = newDenominator;
            }
            if (notesBefore != null) {
                revertHandler.addTimeMeter(
                    trackId, blockId, voiceId, currentNumerator, newNumerator, currentDenominator,
                    newDenominator, true, false, notesBefore,
                );
            } else {
                console.error('Notes before are null');
            }
        }

        toggleEffectSelect(id, beat);
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
        // drawTrack(trackId, voiceId, true);
        // svgDrawer.renderOverBar(trackId, blockId, voiceId);
    }
}

function notationSelect(id: string) {
    if (AppManager.duringTrackCreation) {
        return;
    }
    processNotationSelect(
        tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
        tab.markedNoteObj.beatId, id, false,
    );
}

function processEffectSelect(
    arr: {
        notes: {
            trackId: number, blockId: number, voiceId: number, beatId: number,
            string: number, note: Note
        }[],
        blocks: number[],
        beats: { trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure }[]
    },
    id: string,
    isRevert: boolean,
) {
    // Variable is only set, if effect is active at every element in arr
    let isVariableSet: boolean = true;
    console.log(arr, id);
    console.log('Process Effect Select');
    for (const no of arr.notes) {
        const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
        const note = beat.notes[no.string];
        isVariableSet = menuHandler.getEffectVariable(beat, note, id);
    }
    console.log('PE', id, isVariableSet, isRevert);
    if (id === 'bend' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.BEND, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats,
            isVariableSet
        });
    } else if (id === 'artificial' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.ARTIFICIAL, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats
        });
    } else if (id === 'tremoloBar' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.TREMOLO_BAR, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats,
            isVariableSet
        });
    } else if (id === 'tremoloPicking' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.TREMOLO_PICKING, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats,
            isVariableSet
        });
    } else if (id === 'grace' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.GRACE, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats
        });
    } else if (id === 'stroke' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
        modalManager.toggleByModal(MODALS.STROKE, {
            notes: arr.notes,
            blocks: arr.blocks,
            beats: arr.beats
        });
    } else {
        const changes = menuHandler.handleEffectGroupCollision(arr.notes, id, isVariableSet);
        if (isRevert === false) {
            revertHandler.addNoteEffectSelect(arr, id, changes);
        }
        if (id === 'grace') {
            classicalNotation.computeVexFlowDataStructures(
                Song.currentTrackId, Song.currentVoiceId,
            );
        }
        for (const blockId of arr.blocks) {
            svgDrawer.rerenderBlock(Song.currentTrackId, blockId, Song.currentVoiceId);
        }
    }
}

function noteEffectSelect(id: string): void {
    if (AppManager.duringTrackCreation) {
        return;
    }
    const arr = overlayHandler.getNotesInInterval(null);
    processEffectSelect(arr!, id, false);
}

function processSpecialSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tupleSel: number, id: string, duringRestoration: boolean,
) {
    fastdom.mutate(() => {
        const beat = Song.measures[trackId][blockId][voiceId][beatId];
        if (beat == null) { return; }
        const previousDuration = Duration.getDurationOfNote(beat, true);
        if (id === 'dotted' || id === 'doubleDotted') {
            if (id === 'dotted') {
                if (beat.dotted) {
                    beat.dotted = false;
                } else if (
                    tab.isNotePlaceable(
                        trackId, blockId, voiceId, beatId, string,
                        previousDuration * 1.5, previousDuration,
                    )
                ) {
                    beat.dotted = true;
                } else {
                    return;
                }
                document.getElementById('dotted')?.classList.toggle('pressed');
                if (beat.doubleDotted) {
                    beat.doubleDotted = false;
                    document.getElementById('doubleDotted')?.classList.toggle('pressed');
                }
            } else {
                if (beat.doubleDotted) {
                    beat.doubleDotted = false;
                } else if (
                    tab.isNotePlaceable(
                        trackId, blockId, voiceId, beatId, string, previousDuration * 1.75, previousDuration,
                    )
                ) {
                    beat.doubleDotted = true;
                } else {
                    return;
                }
                document.getElementById('doubleDotted')?.classList.toggle('pressed');
                if (beat.dotted) {
                    beat.dotted = false;
                    document.getElementById('dotted')?.classList.toggle('pressed');
                }
            }
        } else if (id === 'tuplet') {
            const tupletSet = tab.setTuplet(trackId, blockId, voiceId, beatId, tupleSel);
            if (tupletSet) {
                svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
                tab.drawTrack(trackId, voiceId, true, null);
                if (duringRestoration === false) {
                    revertHandler.addNoteLengthSpecialSelect(
                        trackId, blockId, voiceId, beatId, string, tupleSel, id,
                    );
                }
            }
            return;
        } else if (id === 'tied' && noteTiedTo != null) {
            processTiedButtonPress(trackId, blockId, voiceId, beatId, string, noteTiedTo);
            // document.getElementById("tied").classList.toggle("pressed");
            revertHandler.addTied(trackId, blockId, voiceId, beatId, string, noteTiedTo);
            return;
        } else {
            return;
        }

        if (duringRestoration === false) {
            revertHandler.addNoteLengthSpecialSelect(trackId, blockId, voiceId,
                beatId, string, tupleSel, id);
        }

        const newDuration = Duration.getDurationOfNote(beat, true);
        if (previousDuration !== newDuration) {
            const rescaleNecessary = tab.changeBeatDuration(trackId, blockId, voiceId, beatId,
                string, newDuration, previousDuration, beat.duration);
            svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
            classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);

            if (rescaleNecessary) {
                tab.drawTrack(trackId, voiceId, true, null);
            }
        }
    });
}

function processTiedButtonPress(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteTiedTo: { blockId: number, beatId: number },
) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    // create note if not existent
    let shouldBeTied = false;
    if (beat.notes[string] == null || beat.notes[string]!.tied == null
        || beat.notes[string]!.tied === false) {
        shouldBeTied = true;
    }
    const tiedToNote = Song.measures[trackId][noteTiedTo.blockId][voiceId][
        noteTiedTo.beatId].notes[string];
    if (tiedToNote != null) {
        tiedToNote.tieBegin = shouldBeTied;
        // TODO check if null
        const { fret } = tiedToNote;
        setNotesTied(
            trackId, voiceId, noteTiedTo.blockId, blockId, noteTiedTo.beatId + 1,
            beatId, string, fret, shouldBeTied,
        );
    }

    const blocks = [];
    for (let bId = noteTiedTo.blockId; bId <= blockId; bId += 1) {
        blocks.push(bId);
    }
    svgDrawer.rerenderBlocks(trackId, blocks, voiceId);
}

function setNotesTied(
    trackId: number, voiceId: number, blockIdBegin: number, blockIdEnd: number,
    beatIdStart: number, beatIdEnd: number, string: number, fret: number, shouldBeTied: boolean,
) {
    for (let blockId = blockIdBegin; blockId <= blockIdEnd; blockId += 1) {
        const firstBeatId = blockId === blockIdBegin ? beatIdStart : 0;
        const lastBeatId = blockId === blockIdEnd
            ? beatIdEnd
            : Song.measures[trackId][blockId][voiceId].length - 1;
        for (let beatId = firstBeatId; beatId <= lastBeatId; beatId += 1) {
            const beat = Song.measures[trackId][blockId][voiceId][beatId];
            const selectedNote = beat.notes[string];
            if (noteTiedTo == null) {
                break;
            }
            const noteTiedToCopy = { ...noteTiedTo };
            if (selectedNote == null) { // TODO shouldbetied should be true???
                beat.notes[string] = {
                    ...Song.defaultNote(),
                    ...{
                        fret,
                        tied: true,
                        tiedTo: noteTiedToCopy,
                    },
                };
                // eslint-disable-next-line prefer-destructuring
                beat.duration = beat.duration[0]; // remove rest
            } else {
                selectedNote.tied = shouldBeTied;
                selectedNote.tiedTo = noteTiedToCopy;
                if (shouldBeTied === false) {
                    Tab.deleteNote(trackId, blockId, voiceId, beatId, string, false);
                    // return beacuse deleteNote already recursively clears
                    return;
                }
                selectedNote.fret = fret;
            }
        }
    }
}

function noteLengthSpecialSelect(id: string) {
    if (AppManager.duringTrackCreation) { return; }
    const tupleSel = parseInt(
        (document.getElementById('tupletDropDown') as HTMLInputElement).value, 10,
    );
    if (tab.markedNoteObj == null) {
        alert('Please set note first.');
        return;
    }
    const {
        trackId, blockId, voiceId, beatId, string,
    } = tab.markedNoteObj;
    processSpecialSelect(
        trackId, blockId, voiceId, beatId, string, tupleSel, id, false,
    );
}

function processMeasureSelect(
    trackId: number, blockId: number, voiceId: number, id: string, isRevert: boolean,
) {
    fastdom.mutate(() => {
        if (lastMeasureSelectButton !== '') {
            document.getElementById(lastMeasureSelectButton)?.classList.toggle('pressed');
        }
        if (lastMeasureSelectButton !== id) {
            document.getElementById(id)?.classList.toggle('pressed');
        }
        Song.measureMeta[blockId].repeatOpen = !Song.measureMeta[blockId].repeatOpen;
        if (isRevert == null) {
            revertHandler.addMeasureSelect(trackId, blockId, voiceId, id);
        }
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    });
}

function measureSelect(id: string) {
    if (AppManager.duringTrackCreation) {
        return;
    }
    processMeasureSelect(
        tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId, id, false,
    );
}
</script>
<style scoped>
.read-the-docs {
    color: #888;
}
</style>
