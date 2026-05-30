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
                <div v-for="button in barDict" @click="selectBar(button.id)" :key="button.id" :id="`barButton${button.id}`" :class="tabBarButtonClass(button.id)">{{ button.label }}</div>
            </div>
        </div>
        <div class="bottomStatusBar">
            <button id="stopButton" @click="playBackLogic.stopSong()" class="checkBoxNote"></button>
            <button id="recordButton" @click="recordButtonPressed()" class="checkBoxNote" :class="{ prepareRecording: isPreparingRecording }"></button>
            <div id="statusBars">
                <div id="statusBar1" :class="statusBarClass(1)">
                    <div class="checkBoxBar">
                        <button @click="selectNoteLength('w')" id="wholeNote" data-tooltip="Whole"
                            v-bind="menuButtonBindings('wholeNote')"><img id="wholeNoteImg" src="../assets/images/notes/wholeNote.svg" /></button>
                        <button @click="selectNoteLength('h')" id="halfNote" data-tooltip="Half"
                            v-bind="menuButtonBindings('halfNote')"><img id="halfNoteImg" width="15" height="25"
                                src="../assets/images/notes/halfNote.svg" /></button>
                        <button @click="selectNoteLength('q')" id="quarterNote" data-tooltip="Quarter"
                            v-bind="menuButtonBindings('quarterNote')"><img id="quarterNoteImg" width="15" height="25"
                                src="../assets/images/notes/quarterNote.svg" /></button>
                        <button @click="selectNoteLength('e')" id="8thNote" data-tooltip="Eighth"
                            v-bind="menuButtonBindings('8thNote')"><img id="8thNoteImg" class="noteImg"
                                src="../assets/images/notes/eighthNote.svg" /></button>
                        <button @click="selectNoteLength('s')" id="16thNote" data-tooltip="16th"
                            v-bind="menuButtonBindings('16thNote')"><img id="16thNoteImg" class="noteImg"
                                src="../assets/images/notes/16thNote.svg" /></button>
                        <button @click="selectNoteLength('t')" id="32ndNote" data-tooltip="32nd"
                            v-bind="menuButtonBindings('32ndNote')"><img id="32ndNoteImg" class="noteImg"
                                src="../assets/images/notes/32ndNote.svg" /></button>
                        <button @click="selectNoteLength('z')" id="64thNote" data-tooltip="64th"
                            v-bind="menuButtonBindings('64thNote')"><img id="64thNoteImg" class="noteImg"
                                src="../assets/images/notes/64thNote.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        
                        <button id="dotted" @click="noteLengthSpecialSelect('dotted')" data-tooltip="Dotted" v-bind="menuButtonBindings('dotted')"><img id="dottedImg"
                                src="../assets/images/articulations/dotted.svg" /></button>
                        <button id="doubleDotted" @click="noteLengthSpecialSelect('doubleDotted')" data-tooltip="Double Dotted" v-bind="menuButtonBindings('doubleDotted')"><img
                                id="doubleDottedImg" src="../assets/images/articulations/doubleDotted.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <div class="checkBoxDov">
                            <button id="tuplet" @click="noteLengthSpecialSelect('tuplet')" v-bind="menuButtonBindings('tuplet')"><img id="tupletImg"
                                    src="../assets/images/articulations/tuplet.svg" /></button>
                            <select id="tupletDropDown" v-model="selectedTuplet">
                                <option v-for="num in availableTuplets" :key="num" :value="num.toString()">{{ num }}</option>
                            </select>
                        </div>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tied" @click="noteLengthSpecialSelect('tied')" data-tooltip="Tied" v-bind="menuButtonBindings('tied')"><img id="tiedImg"
                                src="../assets/images/articulations/tied.svg" /></button>

                        <button id="info" @click="modalManager.toggleByModal(MODALS.INFO)" class="checkBoxNote playButton"><img id="infoImg"
                                src="../assets/images/info.svg" /></button>

                        <button id="openFile" @click="openGuitarProFile" data-tooltip="Open File" class="checkBoxNote playButton">
                            <span style="font-size: 18px;">📂</span>
                        </button>
                        <input 
                            type="file" 
                            ref="fileInputRef" 
                            @change="handleFileSelect" 
                            accept=".gp3,.gp4,.gp5,.gpx,.mid,.gt"
                            style="display: none;"
                        />
                        <button id="downloadGP" data-tooltip="Download File" @click="handleSaveTab"
                            class="checkBoxNote playButton"><img id="downloadIDGP" src="../assets/images/saveOwn.svg" /></button>

                        <button id="createPDF" data-tooltip="Create PDF" @click="handleCreatePdf"
                            class="checkBoxNote playButton"><img src="../assets/images/pdf.svg" /></button>
                        <!--<div class="wrapper">
                            <div class="file-upload">
                                <input id="files" type="file" accept=".gp5, .gp4, .gp3"/>
                                <img src="https://gtiuebung.de/wp-content/uploads/2016/12/upload.svg"/>
                            </div>
                        </div>-->
                    </div>
                </div>
                <div id="statusBar2" :class="statusBarClass(2)">
                    <div class="checkBoxBar">
                    <button id="pullDown" @click="noteEffectSelect('pullDown')" data-tooltip="HammerOn/PullDown" v-bind="menuButtonBindings('pullDown')"><img id="pullDownImg"
                                src="../assets/images/articulations/hammerOn.svg" /></button>
                    <button id="slide" @click="noteEffectSelect('slide')" data-tooltip="Slide" v-bind="menuButtonBindings('slide')"><img id="slideImg"
                                src="../assets/images/articulations/Slide.svg" /></button>
                    <button id="bend" @click="noteEffectSelect('bend')" data-tooltip="Bend" v-bind="menuButtonBindings('bend')"><img id="bendImg"
                                src="../assets/images/articulations/bend.svg" /></button>
                    <button id="trill" @click="noteEffectSelect('trill')" data-tooltip="Trill" v-bind="menuButtonBindings('trill')"><img id="trillImg"
                                src="../assets/images/articulations/Triller.svg" /></button>
                    <button id="tremoloPicking" @click="noteEffectSelect('tremoloPicking')" data-tooltip="Tremolo Picking" v-bind="menuButtonBindings('tremoloPicking')"><img
                                id="tremoloPickingImg" src="../assets/images/articulations/tremoloPicking.svg" /></button>
                    <button id="tremoloBar" @click="noteEffectSelect('tremoloBar')" data-tooltip="Tremolo Bar" v-bind="menuButtonBindings('tremoloBar')"><img id="tremoloBarImg"
                                src="../assets/images/articulations/tremoloBar.svg" /></button>
                    <button id="dead" @click="noteEffectSelect('dead')" data-tooltip="Dead Note" v-bind="menuButtonBindings('dead')"><img id="deadImg"
                                src="../assets/images/articulations/dead.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stacatto" @click="noteEffectSelect('stacatto')" data-tooltip="Stacatto" v-bind="menuButtonBindings('stacatto')"><img id="stacattoImg"
                                src="../assets/images/articulations/Stacatto.svg" /></button>
                        <button id="palmMute" @click="noteEffectSelect('palmMute')" data-tooltip="Palm Mute" v-bind="menuButtonBindings('palmMute')"><img id="palmMuteImg"
                                src="../assets/images/articulations/PalmMute.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tap" @click="noteEffectSelect('tap')" data-tooltip="Tap" v-bind="menuButtonBindings('tap')">T</button>
                        <button id="slap" @click="noteEffectSelect('slap')" data-tooltip="Slap" v-bind="menuButtonBindings('slap')">S</button>
                        <button id="pop" @click="noteEffectSelect('pop')" data-tooltip="Pop" v-bind="menuButtonBindings('pop')">P</button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="fadeIn" @click="noteEffectSelect('fadeIn')" data-tooltip="Fade-In" v-bind="menuButtonBindings('fadeIn')"><img id="fadeInImg"
                                src="../assets/images/articulations/fadeIn.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="vibrato" @click="noteEffectSelect('vibrato')" data-tooltip="Vibrato" v-bind="menuButtonBindings('vibrato')"><img id="vibratoImg"
                                src="../assets/images/articulations/vibrato.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="grace" @click="noteEffectSelect('grace')" data-tooltip="Grace" v-bind="menuButtonBindings('grace')"><img id="graceImg"
                                src="../assets/images/articulations/grace.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="artificial" @click="noteEffectSelect('artificial')" data-tooltip="Harmonics" v-bind="menuButtonBindings('artificial')"><img id="artificialImg"
                                src="../assets/images/articulations/artificial.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="ghost" @click="noteEffectSelect('ghost')" data-tooltip="Ghost Note" v-bind="menuButtonBindings('ghost')"><img id="ghostNoteImg"
                                src="../assets/images/articulations/brackets.svg" /></button>
                        <button id="accentuated" @click="noteEffectSelect('accentuated')" data-tooltip="Accentuated" v-bind="menuButtonBindings('accentuated')"><img id="accentuatedImg"
                                src="../assets/images/articulations/Accentuated.svg" /></button>
                        <button id="heavyAccentuated" @click="noteEffectSelect('heavyAccentuated')" data-tooltip="Heavy Accentuated" v-bind="menuButtonBindings('heavyAccentuated')"><img
                                id="heavyAccentuatedImg" src="../assets/images/articulations/heavyAccentuated.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stroke" @click="noteEffectSelect('stroke')" data-tooltip="Stroke" v-bind="menuButtonBindings('stroke')"><img id="strokeImg"
                                src="../assets/images/articulations/stroke.svg" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="letRing" @click="noteEffectSelect('letRing')" data-tooltip="Let Ring" v-bind="menuButtonBindings('letRing')"><img id="letRingImg"
                                src="../assets/images/articulations/letRing.svg" /></button>
                    </div>
                </div>
                    <div id="statusBar3" :class="statusBarClass(3)">
                    <div class="checkBoxBar">
                        <button v-for="note in dynamicNotes" @click="dynamicSelect(note.id)" :key="note.id" :id="note.id" :data-tooltip="note.tooltip" v-bind="menuButtonBindings(note.id, ['checkBoxNote', 'dynamicNote'])">{{ note.label }}</button>
                    </div>
                </div>
                    <div id="statusBar4" :class="statusBarClass(4)">
                    <div class="checkBoxBar">
                        <button id="timeMeter" @click="notationSelect('timeMeter')" data-tooltip="Time Meter" v-bind="menuButtonBindings('timeMeter')"><img id="timeMeterImg"
                                src="../assets/images/statusBar/denom.svg" /></button>
                        <button id="bpmMeter" @click="notationSelect('bpmMeter')" data-tooltip="BPM" v-bind="menuButtonBindings('bpmMeter')"><img id="bpmMeterImg"
                                src="../assets/images/statusBar/bpmMeter.svg" /></button>
                        <button id="addMeasure" @click="tab.addBlock(false)" data-tooltip="Add Measure" class="checkBoxNote"><img id="addMeasureImg"
                                src="../assets/images/statusBar/addMeasure.svg" /></button>
                        <button id="removeMeasure" @click="tab.removeBlock(false)" data-tooltip="Remove Measure" class="checkBoxNote"><img
                                id="removeMeasureImg" src="../assets/images/statusBar/removeMeasure.svg" /></button>
                        <button id="openBar" @click="measureSelect('openBar')" data-tooltip="Add Open Bar" v-bind="menuButtonBindings('openBar')"><img id="openBarImg"
                                src="../assets/images/statusBar/openBar.svg" /></button>
                        <button id="closeBar" @click="notationSelect('closeBar')" data-tooltip="Add Close Bar" v-bind="menuButtonBindings('closeBar')"><img id="closeBarImg"
                                src="../assets/images/statusBar/closeBar.svg" /></button>
                        <button id="repeatAlternative" @click="notationSelect('repeatAlternative')" data-tooltip="Add Repeat Alternative" v-bind="menuButtonBindings('repeatAlternative')"><img
                                id="repeatAlternativeImg" src="../assets/images/statusBar/repeatAlternative.svg" /></button>
                    </div>
                </div>
                    <div id="statusBar5" :class="statusBarClass(5)">
                    <div class="checkBoxBar">
                        <button id="addChord" @click="notationSelect('addChord')" data-tooltip="Add Chord" v-bind="menuButtonBindings('addChord')"><img id="addChordImg"
                                src="../assets/images/statusBar/chord.svg" /></button>
                        <button id="addText" @click="notationSelect('addText')" data-tooltip="Add Text" v-bind="menuButtonBindings('addText')"><img id="addTextImg"
                                src="../assets/images/statusBar/text.svg" /></button>
                        <button id="addMarker" @click="notationSelect('addMarker')" data-tooltip="Add Marker" v-bind="menuButtonBindings('addMarker')"><img id="addMarkerImg"
                                src="../assets/images/statusBar/marker.svg" /></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="sideBarButtons">
        <label class="bpmSidebarLabel">BPM</label>
        <div id="tempoMeter" @mousedown="(e: MouseEvent) => { changeTempoFunc(e) }" class="disable-select">{{ currentTempo }}</div>
        <button id="classicalToggleButton" @click="classicalNotation.toggleClassicalVisibility()" data-tooltip="Piano Note View" class="classicalButton"><img id="classicalToggle"
                src="../assets/images/classicalToggle.svg" /></button>
        <button data-tooltip="Chords Menu" class="classicalButton">
            <img id="chordSection" @click="modalManager.toggleByModal(MODALS.CHORD_MANAGER, {trackId: currentTrackId})" class="classicalButton"
                src="../assets/images/chordSection.svg" />
        </button>
        <button id="zoomIn" @click="tab.scaleCompleteTab(true)" data-tooltip="Zoom In" class="classicalButton"><img id="zoomInImg"
                src="../assets/images/zoomIn.svg" /></button>
        <button id="zoomOut" @click="tab.scaleCompleteTab(false)" data-tooltip="Zoom Out" class="classicalButton"><img id="zoomOutImg"
                src="../assets/images/zoomOut.svg" /></button>
        <button id="fullscreen" @click="typedEventBus.emit('ui.disablePageMode')" data-tooltip="Fullscreen" class="classicalButton"><img id="fullscreenImg"
                src="../assets/images/fullscreen.svg" /></button>

        <button id="guitarEyeToggle" @click="modalManager.toggleByModal(MODALS.GUITAR)" data-tooltip="Virtual Guitar" class="classicalButton">
            <img src="../assets/images/guitarIconBorder.svg" />
        </button>
        <button id="pianoEyeToggle" @click="modalManager.toggleByModal(MODALS.PIANO)" data-tooltip="Virtual Piano" class="classicalButton">
            <img src="../assets/images/pianoIconBorder.svg" />
        </button>

        <label id="voiceLabel">Voice</label>
        <button id="voice0" @click="selectVoice(0)" :class="voiceButtonClass(0)">1</button>
        <button id="voice1" @click="selectVoice(1)" :class="voiceButtonClass(1)">2</button>
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
import { typedEventBus } from '../utils/typedEventBus';
import { modalManager } from '../assets/js/modals/modalManager';
import Settings from '../assets/js/settingManager';
import Song from '../assets/js/songData';
import { tab, Tab } from '../assets/js/tab';
import playBackLogic from '../assets/js/playBackLogicNew';
import AppManager from '../assets/js/appManager';
import { classicalNotation } from '../services/legacy/classicalNotationAdapter';
import { ensureLegacyMenuEventBridge } from '../services/menuEventBridge';
import { SequencerHandler } from '../assets/js/sequencerHandler';
import { overlayHandler } from '../assets/js/overlayHandler';
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { menuHandler } from '../assets/js/menuHandler';
import { MODALS } from '../assets/js/modals/modalTypes';
import { gProReader } from '../assets/js/GProReader';
import type { Note, Measure, NoteLengthCode, TabPosition } from '../types/tab';
import { useEditorScopeState } from '../composables/useEditorScopeState';
import { setTempoState, useTempoState } from '../composables/useTempoState';
import {
    DEFAULT_TUPLET_OPTIONS,
    MENU_EFFECT_GROUPS,
    MENU_NOTE_EFFECT_BUTTON_IDS,
    deriveMenuSelectionState,
} from '../utils/menuUiState';

// File input ref for opening files
const fileInputRef = ref<HTMLInputElement | null>(null);
const isPreparingRecording = ref(false);
const selectedTuplet = ref('3');
const selectedBarId = ref(1);
const availableTuplets = ref([...DEFAULT_TUPLET_OPTIONS]);
const pressedButtons = reactive<Record<string, boolean>>({
    '8thNote': true,
});
const disabledButtons = reactive<Record<string, boolean>>({});
const { currentTrackId, currentVoiceId } = useEditorScopeState();
const { currentTempo } = useTempoState();

function setFlagMap(target: Record<string, boolean>, activeIds: string[]) {
    Object.keys(target).forEach((key) => {
        delete target[key];
    });

    activeIds.forEach((id) => {
        target[id] = true;
    });
}

function isMenuButtonPressed(id: string) {
    return pressedButtons[id] === true;
}

function isMenuButtonDisabled(id: string) {
    return disabledButtons[id] === true;
}

function menuButtonBindings(id: string, baseClasses: string | string[] = 'checkBoxNote') {
    const classes = Array.isArray(baseClasses) ? baseClasses : [baseClasses];

    return {
        class: [...classes, { pressed: isMenuButtonPressed(id) }],
        disabled: isMenuButtonDisabled(id),
    };
}

function tabBarButtonClass(id: number) {
    return ['tabBarElem', { tabBarElemSelected: selectedBarId.value === id }];
}

function statusBarClass(id: number) {
    return ['statusBar', { statusBarSelected: selectedBarId.value === id }];
}

function voiceButtonClass(voiceId: number) {
    return ['voiceButton', { voiceSelected: currentVoiceId.value === voiceId }];
}

function checkForNoteToTie(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    string: number,
) {
    let noteToTie = null;
    for (let i = blockId; i >= 0; i -= 1) {
        const startBeatId = i === blockId
            ? beatId - 1
            : Song.measures[trackId][i][voiceId].length - 1;
        for (let j = startBeatId; j >= 0; j -= 1) {
            const { notes } = Song.measures[trackId][i][voiceId][j];
            if (notes?.[string] != null) {
                noteToTie = { blockId: i, beatId: j };
                break;
            }
        }
        if (noteToTie != null) {
            break;
        }
    }

    return noteToTie;
}

function syncMenuStateForPosition(position: TabPosition) {
    const { trackId, blockId, voiceId, beatId, string } = position;
    const beat = Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId];
    const measureMeta = Song.measureMeta?.[blockId];
    if (!beat || !measureMeta) {
        return;
    }

    const note = beat.notes?.[string] ?? null;
    noteTiedTo = note?.tied ? note.tiedTo : checkForNoteToTie(trackId, blockId, voiceId, beatId, string);

    const derivedState = deriveMenuSelectionState(beat, note, measureMeta, {
        canTie: note?.tied === true || noteTiedTo != null,
        hasOverlaySelection: overlayHandler.isNoteSelected(),
    });

    setFlagMap(pressedButtons, derivedState.pressedButtonIds);
    setFlagMap(disabledButtons, derivedState.disabledButtonIds);
    availableTuplets.value = derivedState.availableTuplets;
    selectedTuplet.value = derivedState.selectedTuplet;
    AppManager.typeOfNote = beat.duration[0];
}

function syncMenuStateForMarkedPosition() {
    if (tab.markedNoteObj == null) {
        return;
    }

    syncMenuStateForPosition(tab.markedNoteObj);
}

function selectBar(id: number) {
    selectedBarId.value = id;
}

function selectVoice(voiceId: number) {
    if (AppManager.duringTrackCreation) {
        return;
    }

    AppManager.changeTrack(Song.currentTrackId, voiceId, false, () => {
        syncMenuStateForMarkedPosition();
    });
}

function selectNoteLength(noteLength: NoteLengthCode) {
    if (AppManager.duringTrackCreation || tab.markedNoteObj == null) {
        return;
    }

    const {
        trackId,
        blockId,
        voiceId,
        beatId,
        string,
    } = tab.markedNoteObj;

    if (tab.changeNoteDuration(trackId, blockId, voiceId, beatId, string, noteLength, false)) {
        AppManager.typeOfNote = noteLength;
        syncMenuStateForMarkedPosition();
    }
}

// Open file dialog
function openGuitarProFile() {
    fileInputRef.value?.click();
}

// Handle file selection
function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
        gProReader.handleFiles(files);
        // Reset the input so the same file can be selected again
        input.value = '';
    }
}

function clickedOnPos(position: {trackId: number, blockId: number, voiceId: number, beatId: number, string: number}) {
    syncMenuStateForPosition(position);
}

function handleSaveTab() {
    AppManager.saveAsGt(false);
}

function handleCreatePdf() {
    AppManager.showNotification('PDF export is not available in the Vue renderer yet.');
}

const handleActivateEffectsForMarkedBeat = () => {
    syncMenuStateForMarkedPosition();
};

const handleActivateEffectsForMarkedPos = () => {
    syncMenuStateForMarkedPosition();
};

const handleActivateEffectsForBeat = (_beat: Measure) => {
    syncMenuStateForMarkedPosition();
};

const handleDisableNoteEffectButtons = () => {
    MENU_NOTE_EFFECT_BUTTON_IDS.forEach((id) => {
        disabledButtons[id] = true;
    });
};

const handleActivateEffectsForBlock = () => {
    syncMenuStateForMarkedPosition();
};

const handleActivateEffectsForPos = (position: TabPosition) => {
    syncMenuStateForPosition(position);
};

const handleActivateEffectsForNote = (_note: Note) => {
    syncMenuStateForMarkedPosition();
};

const handleClickedOnPos = (position: TabPosition) => {
    clickedOnPos(position);
};

const handleSongDataChanged = () => {
    syncMenuStateForMarkedPosition();
};

onMounted(() => {
    ensureLegacyMenuEventBridge();
    typedEventBus.on('menu.activateEffectsForMarkedBeat', handleActivateEffectsForMarkedBeat);
    typedEventBus.on('menu.activateEffectsForMarkedPos', handleActivateEffectsForMarkedPos);
    typedEventBus.on('menu.activateEffectsForBeat', handleActivateEffectsForBeat);
    typedEventBus.on('menu.disableNoteEffectButtons', handleDisableNoteEffectButtons);
    typedEventBus.on('menu.activateEffectsForBlock', handleActivateEffectsForBlock);
    typedEventBus.on('menu.activateEffectsForPos', handleActivateEffectsForPos);
    typedEventBus.on('menu.activateEffectsForNote', handleActivateEffectsForNote);
    typedEventBus.on('menu.clickedOnPos', handleClickedOnPos);
    typedEventBus.on('song-data-changed', handleSongDataChanged);
    syncMenuStateForMarkedPosition();
})

onBeforeUnmount(() => {
    typedEventBus.off('menu.activateEffectsForMarkedBeat', handleActivateEffectsForMarkedBeat);
    typedEventBus.off('menu.activateEffectsForMarkedPos', handleActivateEffectsForMarkedPos);
    typedEventBus.off('menu.activateEffectsForBeat', handleActivateEffectsForBeat);
    typedEventBus.off('menu.disableNoteEffectButtons', handleDisableNoteEffectButtons);
    typedEventBus.off('menu.activateEffectsForBlock', handleActivateEffectsForBlock);
    typedEventBus.off('menu.activateEffectsForPos', handleActivateEffectsForPos);
    typedEventBus.off('menu.activateEffectsForNote', handleActivateEffectsForNote);
    typedEventBus.off('menu.clickedOnPos', handleClickedOnPos);
    typedEventBus.off('song-data-changed', handleSongDataChanged);
});

let tempoMoveTmp: (event: MouseEvent) => void = () => { };
let removeListenersTmp: () => void = () => { };
let noteTiedTo: {blockId: number, beatId: number} | null = null;
let initYPos = 0;
let oldBpm = 90;


const dynamicNotes = [
    { id: "pppDynamic", tooltip: "Pianississimo", label: "¸" },
    { id: "ppDynamic", tooltip: "Pianissimo", label: "pp" },
    { id: "pDynamic", tooltip: "Piano", label: "p" },
    { id: "mpDynamic", tooltip: "Mezzo Piano", label: "P" },
    { id: "mfDynamic", tooltip: "Mezzo Forte", label: "F" },
    { id: "fDynamic", tooltip: "Forte", label: "f" },
    { id: "ffDynamic", tooltip: "Fortissimo", label: "Ä" },
    { id: "fffDynamic", tooltip: "Fortississimo", label: "ì" },
];
const barDict = [
        { id: 1, label: "Basic" },
        { id: 2, label: "Articulation" },
        { id: 3, label: "Dynamics" },
        { id: 4, label: "Measure" },
        { id: 5, label: "Text" },
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
    const mouseYnew = event.pageY;
    Song.bpm = oldBpm + initYPos - mouseYnew;
    Song.bpm = Math.max(Song.bpm, 10);
    Song.bpm = Math.min(Song.bpm, 180);
    setTempoState(Song.bpm);
}

function changeTempoFunc(e: MouseEvent) {
    initYPos = e.pageY;
    oldBpm = Song.bpm;
    // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
    tempoMoveTmp = tempoMeterMouseMove;
    removeListenersTmp = removeEventListenersTempo;
    document.addEventListener('mousemove', tempoMoveTmp);
    document.body.classList.add('disableMouseEffects');
    document.addEventListener('mousemove', tempoMoveTmp);
    document.addEventListener('mouseup', removeListenersTmp);
}

function recordButtonPressed() {
    if (midiEngine.isRecording) {
        isPreparingRecording.value = false;
        midiEngine.stopRecording();
    } else {
        isPreparingRecording.value = true;
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

        for (let i = 0; i < MENU_EFFECT_GROUPS.length; i += 1) {
            if (MENU_EFFECT_GROUPS[i].some((effectId) => effectId === id)) {
                menuHandler.deactivateEffects(beat, note, [...MENU_EFFECT_GROUPS[i]]);

                if (isVariableSet == null || isVariableSet === false) {
                    menuHandler.setEffectVariable(beat, note, id, true);
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
        typedEventBus.emit('render.overBar', { trackId, blockId, voiceId, rerender: false });
    }

    syncMenuStateForMarkedPosition();
}

function dynamicSelect(id: string) {
    if (AppManager.duringTrackCreation) {
        return;
    }
    const arr = overlayHandler.getNotesInInterval(null);
    processDynamicSelect(arr!, id, false);
}

function toggleEffectSelect(id: string, beat: Measure) {
    for (let i = 0; i < MENU_EFFECT_GROUPS.length; i += 1) {
        if (MENU_EFFECT_GROUPS[i].some((effectId) => effectId === id)) {
            const isVariableSet = menuHandler.getEffectVariable(beat, null, id);
            menuHandler.deactivateEffects(beat, null, [...MENU_EFFECT_GROUPS[i]]);

            if (isVariableSet == null || isVariableSet === false) {
                menuHandler.setEffectVariable(beat, null, id, true);
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
        typedEventBus.emit('render.block', { trackId, blockId, voiceId });
        syncMenuStateForMarkedPosition();
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
    for (const no of arr.notes) {
        const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
        const note = beat.notes[no.string];
        isVariableSet = menuHandler.getEffectVariable(beat, note, id);
    }
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
                currentTrackId.value, currentVoiceId.value,
            );
        }
        for (const blockId of arr.blocks) {
            typedEventBus.emit('render.block', { trackId: currentTrackId.value, blockId, voiceId: currentVoiceId.value });
        }

        syncMenuStateForMarkedPosition();
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
                if (beat.doubleDotted) {
                    beat.doubleDotted = false;
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
                if (beat.dotted) {
                    beat.dotted = false;
                }
            }
        } else if (id === 'tuplet') {
            const tupletSet = tab.setTuplet(trackId, blockId, voiceId, beatId, tupleSel);
            if (tupletSet) {
                typedEventBus.emit('render.durations', { trackId, blockId, voiceId });
                tab.drawTrack(trackId, voiceId, true, null);
                if (duringRestoration === false) {
                    revertHandler.addNoteLengthSpecialSelect(
                        trackId, blockId, voiceId, beatId, string, tupleSel, id,
                    );
                }
            }

            syncMenuStateForMarkedPosition();
            return;
        } else if (id === 'tied' && noteTiedTo != null) {
            processTiedButtonPress(trackId, blockId, voiceId, beatId, string, noteTiedTo);
            revertHandler.addTied(trackId, blockId, voiceId, beatId, string, noteTiedTo);

            syncMenuStateForMarkedPosition();
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
            typedEventBus.emit('render.durations', { trackId, blockId, voiceId });
            classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);

            if (rescaleNecessary) {
                tab.drawTrack(trackId, voiceId, true, null);
            }
        }

        syncMenuStateForMarkedPosition();
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
    typedEventBus.emit('render.blocks', { trackId, blockIds: blocks, voiceId });
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
    const tupleSel = parseInt(selectedTuplet.value, 10);
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
        Song.measureMeta[blockId].repeatOpen = !Song.measureMeta[blockId].repeatOpen;
        if (isRevert == null) {
            revertHandler.addMeasureSelect(trackId, blockId, voiceId, id);
        }
        typedEventBus.emit('render.block', { trackId, blockId, voiceId });

        syncMenuStateForMarkedPosition();
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
