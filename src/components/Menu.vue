<template>
    <div id="completeBar">
        <div id="tabBar">
            <button id="oneMeasureBack" @click="playBackJump(true)" class="voiceButton playChange">
                <img id="oneMeasureBackImg" src='../assets/images/statusBar/backward.svg' />
            </button>
            <button id="play" @click="togglePlayback()" class="playStart" :class="{ playing: playbackTransportState.isPlaying }">
                <img id="playMusicImg" src="../assets/images/playButton.svg" />
                <img id="pauseMusicImg" src="../assets/images/pause.svg" />
            </button>
            <button id="oneMeasureForward" @click="playBackJump(false)" class="voiceButton playChange"><img id="oneMeasureForwardImg"
                    src="../assets/images/statusBar/forward.svg" /></button>
            <div id="barButtons" v-show="playbackTransportState.showMenuBars">
                <div v-for="button in barDict" @click="selectBar(button.id)" :key="button.id" :id="`barButton${button.id}`" :class="tabBarButtonClass(button.id)">{{ button.label }}</div>
            </div>
            <PracticeControls />
        </div>
        <div class="bottomStatusBar">
            <button id="stopButton" @click="stopPlayback()" class="checkBoxNote"></button>
            <button id="recordButton" @click="recordButtonPressed()" class="checkBoxNote" :class="{ prepareRecording: isPreparingRecording, recording: playbackTransportState.isRecordingActive }"></button>
            <div id="statusBars" v-show="playbackTransportState.showMenuBars">
                <div id="statusBar1" :class="statusBarClass(1)">
                    <div class="checkBoxBar">
                        <button @click="selectNoteLength('w')" id="wholeNote" data-tooltip="Whole"
                            v-bind="menuButtonBindings('wholeNote')"><img id="wholeNoteImg" class="noteImg" src="../assets/images/notes/wholeNote.svg" /></button>
                        <button @click="selectNoteLength('h')" id="halfNote" data-tooltip="Half"
                            v-bind="menuButtonBindings('halfNote')"><img id="halfNoteImg" class="noteImg"
                                src="../assets/images/notes/halfNote.svg" /></button>
                        <button @click="selectNoteLength('q')" id="quarterNote" data-tooltip="Quarter"
                            v-bind="menuButtonBindings('quarterNote')"><img id="quarterNoteImg" class="noteImg"
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

                        <button
                            id="undoButton"
                            data-tooltip="Undo (Ctrl+Z)"
                            class="checkBoxNote playButton"
                            :disabled="!canUndo"
                            @click="undo"
                        >
                            <img id="undoButtonImg" src="../assets/images/statusBar/backward.svg" alt="" />
                        </button>
                        <button
                            id="redoButton"
                            data-tooltip="Redo (Ctrl+Y)"
                            class="checkBoxNote playButton"
                            :disabled="!canRedo"
                            @click="redo"
                        >
                            <img id="redoButtonImg" src="../assets/images/statusBar/forward.svg" alt="" />
                        </button>

                        <button id="openFile" @click="openGuitarProFile" data-tooltip="Open File" class="checkBoxNote playButton">
                            <span style="font-size: 18px;">📂</span>
                        </button>
                        <input 
                            type="file" 
                            ref="fileInputRef" 
                            @change="handleFileSelect" 
                            accept=".gp,.gpx,.gp5,.gp4,.gp3,.mid,.gt"
                            style="display: none;"
                        />
                        <SaveFormatMenu />
                        <button id="recoverDrafts" data-tooltip="Recover drafts" aria-label="Recover drafts"
                            @click="toggleDraftsPanel" class="checkBoxNote playButton">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M3 12a9 9 0 1 0 3-6.7" />
                                <path d="M3 4v5h5" />
                                <path d="M12 7v5l3 2" />
                            </svg>
                        </button>

                        <button id="shortcutsHelpButton" data-tooltip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"
                            @click="toggleShortcutsHelp" class="checkBoxNote playButton shortcutsHelpButton">?</button>

                        <button
                            id="cloudSongs"
                            data-tooltip="Cloud songs"
                            @click="openCloudSongsModal"
                            class="checkBoxNote playButton"
                            title="Open or save tabs in the cloud"
                        >
                            <span style="font-size: 16px;">☁</span>
                        </button>

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
        <button id="classicalToggleButton" @click="toggleClassicalNotationView()" data-tooltip="Piano Note View"
                :class="['classicalButton', { classicalBack: classicalNotationActive }]"><img id="classicalToggle"
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
import { modalManager } from '../assets/js/modals/modalManager';
import { classicalNotation } from '../services/editor/classicalNotationAdapter';
import Settings from '../assets/js/settingManager';
import editorCore from '../services/editor/editorCore';
import midiEngine from '../assets/js/midiReceiver';
import { typedEventBus } from '../utils/typedEventBus';
import Song from '../assets/js/songData';
import { tab } from '../assets/js/tab';
import AppManager from '../assets/js/appManager';
import { usePlaybackEngine } from '../composables/usePlaybackEngine';
import { playbackTransportState } from '../composables/playbackTransportState';
import { ensureMenuEventBridge } from '../services/menuEventBridge';
import { overlayHandler } from '../assets/js/overlayHandler';
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { MODALS } from '../assets/js/modals/modalTypes';
import { gProReader } from '../assets/js/GProReader';
import { confirmReplaceUnsavedSong } from '../services/songAutosave';
import type { Note, Beat, TabPosition } from '../types/tab';
import { useEditorScopeState } from '../composables/useEditorScopeState';
import { setTempoState, useTempoState } from '../composables/useTempoState';
import { useMenuActions } from '../composables/useMenuActions';
import {
    DEFAULT_TUPLET_OPTIONS,
    MENU_NOTE_EFFECT_BUTTON_IDS,
    deriveMenuSelectionState,
} from '../utils/menuUiState';
import { useUndoRedo } from '../composables/useUndoRedo';
import { toggleDraftsPanel } from '../stores/draftsPanelState';
import { toggleShortcutsHelp } from '../stores/shortcutsHelpState';
import PracticeControls from './PracticeControls.vue';
import SaveFormatMenu from './SaveFormatMenu.vue';

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
const { togglePlay: togglePlayback, stop: stopPlayback } = usePlaybackEngine();
const { canUndo, canRedo, undo, redo } = useUndoRedo();
const noteTiedTo = ref<{ blockId: number; beatId: number } | null>(null);
const classicalNotationActive = ref(Settings.vexFlowIsActive);

async function toggleClassicalNotationView() {
  await classicalNotation.toggleClassicalVisibility();
  classicalNotationActive.value = Settings.vexFlowIsActive;
}

function handleClassicalNotationChanged() {
  classicalNotationActive.value = Settings.vexFlowIsActive;
}

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
    return editorCore.findPreviousNoteOnString(trackId, blockId, voiceId, beatId, string);
}

function syncMenuStateForPosition(position: TabPosition) {
    const { trackId, blockId, voiceId, beatId, string } = position;
    const beat = editorCore.getBeat(trackId, blockId, voiceId, beatId);
    const measureMeta = editorCore.getMeasureMeta(blockId);
    if (!beat || !measureMeta) {
        return;
    }

    const note = editorCore.getNote(trackId, blockId, voiceId, beatId, string) ?? null;
    noteTiedTo.value = note?.tied ? note.tiedTo : checkForNoteToTie(trackId, blockId, voiceId, beatId, string);

    const derivedState = deriveMenuSelectionState(beat, note, measureMeta, {
        canTie: note?.tied === true || noteTiedTo.value != null,
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

const {
    playBackJump,
    selectNoteLength,
    dynamicSelect,
    notationSelect,
    noteEffectSelect,
    noteLengthSpecialSelect,
    measureSelect,
} = useMenuActions({
    currentTrackId,
    currentVoiceId,
    selectedTuplet,
    noteTiedTo,
    syncMenuState: syncMenuStateForMarkedPosition,
});

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

// Open file dialog
function openGuitarProFile() {
    fileInputRef.value?.click();
}

// Handle file selection
function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    // Asked after picking, so the question can name the file.
    if (files && files.length > 0 && confirmReplaceUnsavedSong(files[0].name)) {
        gProReader.handleFiles(files);
    }
    // Reset the input so the same file can be selected again
    input.value = '';
}

function openCloudSongsModal() {
    modalManager.displayModal('cloudSongsModal', 'Cloud songs');
}

function handleCreatePdf() {
    void import('../services/pdfExport').then(({ exportTabAsPdf }) => exportTabAsPdf())
}

const handleActivateEffectsForMarkedBeat = () => {
    syncMenuStateForMarkedPosition();
};

const handleActivateEffectsForMarkedPos = () => {
    syncMenuStateForMarkedPosition();
};

const handleActivateEffectsForBeat = (_beat: Beat) => {
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
    syncMenuStateForPosition(position);
};

const handleSongDataChanged = () => {
    syncMenuStateForMarkedPosition();
};

onMounted(() => {
    ensureMenuEventBridge();
    typedEventBus.on('menu.activateEffectsForMarkedBeat', handleActivateEffectsForMarkedBeat);
    typedEventBus.on('menu.activateEffectsForMarkedPos', handleActivateEffectsForMarkedPos);
    typedEventBus.on('menu.activateEffectsForBeat', handleActivateEffectsForBeat);
    typedEventBus.on('menu.disableNoteEffectButtons', handleDisableNoteEffectButtons);
    typedEventBus.on('menu.activateEffectsForBlock', handleActivateEffectsForBlock);
    typedEventBus.on('menu.activateEffectsForPos', handleActivateEffectsForPos);
    typedEventBus.on('menu.activateEffectsForNote', handleActivateEffectsForNote);
    typedEventBus.on('menu.clickedOnPos', handleClickedOnPos);
    typedEventBus.on('song-data-changed', handleSongDataChanged);
    typedEventBus.on('classical-notation-changed', handleClassicalNotationChanged);
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
    typedEventBus.off('classical-notation-changed', handleClassicalNotationChanged);
});

let tempoMoveTmp: (event: MouseEvent) => void = () => { };
let removeListenersTmp: () => void = () => { };
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
</script>
<style scoped>
.read-the-docs {
    color: #888;
}
</style>
