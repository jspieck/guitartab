<template>
    <div id="completeBar">
        <div id="tabBar">
            <button id="oneMeasureBack" @click="playBackJump(true)" class="voiceButton playChange">
                <AppIcon id="oneMeasureBackImg" name="bar-back" />
            </button>
            <button id="play" @click="togglePlayback()" @pointerenter="preloadPlayback()" class="playStart" :class="{ playing: playbackTransportState.isPlaying }">
                <AppIcon id="playMusicImg" name="play" />
                <AppIcon id="pauseMusicImg" name="pause" />
            </button>
            <button id="oneMeasureForward" @click="playBackJump(false)" class="voiceButton playChange"><AppIcon id="oneMeasureForwardImg" name="bar-forward" /></button>
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
                            v-bind="menuButtonBindings('wholeNote')"><AppIcon id="wholeNoteImg" class="noteImg" name="note-whole" /></button>
                        <button @click="selectNoteLength('h')" id="halfNote" data-tooltip="Half"
                            v-bind="menuButtonBindings('halfNote')"><AppIcon id="halfNoteImg" class="noteImg" name="note-half" /></button>
                        <button @click="selectNoteLength('q')" id="quarterNote" data-tooltip="Quarter"
                            v-bind="menuButtonBindings('quarterNote')"><AppIcon id="quarterNoteImg" class="noteImg" name="note-quarter" /></button>
                        <button @click="selectNoteLength('e')" id="8thNote" data-tooltip="Eighth"
                            v-bind="menuButtonBindings('8thNote')"><AppIcon id="8thNoteImg" class="noteImg" name="note-eighth" /></button>
                        <button @click="selectNoteLength('s')" id="16thNote" data-tooltip="16th"
                            v-bind="menuButtonBindings('16thNote')"><AppIcon id="16thNoteImg" class="noteImg" name="note-16th" /></button>
                        <button @click="selectNoteLength('t')" id="32ndNote" data-tooltip="32nd"
                            v-bind="menuButtonBindings('32ndNote')"><AppIcon id="32ndNoteImg" class="noteImg" name="note-32nd" /></button>
                        <button @click="selectNoteLength('z')" id="64thNote" data-tooltip="64th"
                            v-bind="menuButtonBindings('64thNote')"><AppIcon id="64thNoteImg" class="noteImg" name="note-64th" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        
                        <button id="dotted" @click="noteLengthSpecialSelect('dotted')" data-tooltip="Dotted" v-bind="menuButtonBindings('dotted')"><AppIcon id="dottedImg" name="dotted" /></button>
                        <button id="doubleDotted" @click="noteLengthSpecialSelect('doubleDotted')" data-tooltip="Double Dotted" v-bind="menuButtonBindings('doubleDotted')"><AppIcon
                                id="doubleDottedImg" name="double-dotted" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <div class="checkBoxDov">
                            <button id="tuplet" @click="noteLengthSpecialSelect('tuplet')" v-bind="menuButtonBindings('tuplet')"><AppIcon id="tupletImg" name="tuplet" /></button>
                            <select id="tupletDropDown" v-model="selectedTuplet">
                                <option v-for="num in availableTuplets" :key="num" :value="num.toString()">{{ num }}</option>
                            </select>
                        </div>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tied" @click="noteLengthSpecialSelect('tied')" data-tooltip="Tied" v-bind="menuButtonBindings('tied')"><AppIcon id="tiedImg" name="tie" /></button>

                        <button id="info" @click="modalManager.toggleByModal(MODALS.INFO)" class="checkBoxNote playButton"><AppIcon id="infoImg" name="info" /></button>

                        <button
                            id="undoButton"
                            data-tooltip="Undo (Ctrl+Z)"
                            class="checkBoxNote playButton"
                            :disabled="!canUndo"
                            @click="undo"
                        >
                            <AppIcon id="undoButtonImg" name="undo" />
                        </button>
                        <button
                            id="redoButton"
                            data-tooltip="Redo (Ctrl+Y)"
                            class="checkBoxNote playButton"
                            :disabled="!canRedo"
                            @click="redo"
                        >
                            <AppIcon id="redoButtonImg" name="redo" />
                        </button>

                        <button id="openFile" @click="openGuitarProFile" data-tooltip="Open File" class="checkBoxNote playButton">
                            <AppIcon name="open" />
                        </button>
                        <input 
                            type="file" 
                            ref="fileInputRef" 
                            @change="handleFileSelect" 
                            accept=".gp,.gpx,.gp5,.gp4,.gp3,.mid,.gt"
                            hidden
                        />
                        <SaveFormatMenu />
                        <button id="recoverDrafts" data-tooltip="Recover drafts" aria-label="Recover drafts"
                            @click="toggleDraftsPanel" class="checkBoxNote playButton">
                            <AppIcon name="history" />
                        </button>

                        <button id="shortcutsHelpButton" data-tooltip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"
                            @click="toggleShortcutsHelp" class="checkBoxNote playButton shortcutsHelpButton"><AppIcon name="help" /></button>

                        <button
                            id="cloudSongs"
                            data-tooltip="Cloud songs"
                            @click="openCloudSongsModal"
                            class="checkBoxNote playButton"
                            title="Open or save tabs in the cloud"
                        >
                            <AppIcon name="cloud" />
                        </button>

                        <button id="createPDF" data-tooltip="Create PDF" @click="handleCreatePdf"
                            class="checkBoxNote playButton"><AppIcon name="document" /></button>
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
                    <button id="pullDown" @click="noteEffectSelect('pullDown')" data-tooltip="HammerOn/PullDown" v-bind="menuButtonBindings('pullDown')"><AppIcon id="pullDownImg" name="hammer-on" /></button>
                    <button id="slide" @click="noteEffectSelect('slide')" data-tooltip="Slide" v-bind="menuButtonBindings('slide')"><AppIcon id="slideImg" name="slide" /></button>
                    <button id="bend" @click="noteEffectSelect('bend')" data-tooltip="Bend" v-bind="menuButtonBindings('bend')"><AppIcon id="bendImg" name="bend" /></button>
                    <button id="trill" @click="noteEffectSelect('trill')" data-tooltip="Trill" v-bind="menuButtonBindings('trill')"><AppIcon id="trillImg" name="trill" /></button>
                    <button id="tremoloPicking" @click="noteEffectSelect('tremoloPicking')" data-tooltip="Tremolo Picking" v-bind="menuButtonBindings('tremoloPicking')"><AppIcon
                                id="tremoloPickingImg" name="tremolo-picking" /></button>
                    <button id="tremoloBar" @click="noteEffectSelect('tremoloBar')" data-tooltip="Tremolo Bar" v-bind="menuButtonBindings('tremoloBar')"><AppIcon id="tremoloBarImg" name="tremolo-bar" /></button>
                    <button id="dead" @click="noteEffectSelect('dead')" data-tooltip="Dead Note" v-bind="menuButtonBindings('dead')"><AppIcon id="deadImg" name="dead-note" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stacatto" @click="noteEffectSelect('stacatto')" data-tooltip="Stacatto" v-bind="menuButtonBindings('stacatto')"><AppIcon id="stacattoImg" name="staccato" /></button>
                        <button id="palmMute" @click="noteEffectSelect('palmMute')" data-tooltip="Palm Mute" v-bind="menuButtonBindings('palmMute')"><AppIcon id="palmMuteImg" name="palm-mute" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="tap" @click="noteEffectSelect('tap')" data-tooltip="Tap" v-bind="menuButtonBindings('tap')">T</button>
                        <button id="slap" @click="noteEffectSelect('slap')" data-tooltip="Slap" v-bind="menuButtonBindings('slap')">S</button>
                        <button id="pop" @click="noteEffectSelect('pop')" data-tooltip="Pop" v-bind="menuButtonBindings('pop')">P</button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="fadeIn" @click="noteEffectSelect('fadeIn')" data-tooltip="Fade-In" v-bind="menuButtonBindings('fadeIn')"><AppIcon id="fadeInImg" name="fade-in" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="vibrato" @click="noteEffectSelect('vibrato')" data-tooltip="Vibrato" v-bind="menuButtonBindings('vibrato')"><AppIcon id="vibratoImg" name="vibrato" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="grace" @click="noteEffectSelect('grace')" data-tooltip="Grace" v-bind="menuButtonBindings('grace')"><AppIcon id="graceImg" name="grace" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="artificial" @click="noteEffectSelect('artificial')" data-tooltip="Harmonics" v-bind="menuButtonBindings('artificial')"><AppIcon id="artificialImg" name="harmonic" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="ghost" @click="noteEffectSelect('ghost')" data-tooltip="Ghost Note" v-bind="menuButtonBindings('ghost')"><AppIcon id="ghostNoteImg" name="ghost-note" /></button>
                        <button id="accentuated" @click="noteEffectSelect('accentuated')" data-tooltip="Accentuated" v-bind="menuButtonBindings('accentuated')"><AppIcon id="accentuatedImg" name="accent" /></button>
                        <button id="heavyAccentuated" @click="noteEffectSelect('heavyAccentuated')" data-tooltip="Heavy Accentuated" v-bind="menuButtonBindings('heavyAccentuated')"><AppIcon
                                id="heavyAccentuatedImg" name="heavy-accent" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="stroke" @click="noteEffectSelect('stroke')" data-tooltip="Stroke" v-bind="menuButtonBindings('stroke')"><AppIcon id="strokeImg" name="stroke" /></button>
                        <div class="or-spacer-vertical left">
                            <div class="inner"></div>
                        </div>
                        <button id="letRing" @click="noteEffectSelect('letRing')" data-tooltip="Let Ring" v-bind="menuButtonBindings('letRing')"><AppIcon id="letRingImg" name="let-ring" /></button>
                    </div>
                </div>
                    <div id="statusBar3" :class="statusBarClass(3)">
                    <div class="checkBoxBar">
                        <button v-for="note in dynamicNotes" @click="dynamicSelect(note.id)" :key="note.id" :id="note.id" :data-tooltip="note.tooltip" v-bind="menuButtonBindings(note.id, ['checkBoxNote', 'dynamicNote'])">{{ note.label }}</button>
                    </div>
                </div>
                    <div id="statusBar4" :class="statusBarClass(4)">
                    <div class="checkBoxBar">
                        <button id="timeMeter" @click="notationSelect('timeMeter')" data-tooltip="Time Meter" v-bind="menuButtonBindings('timeMeter')"><AppIcon id="timeMeterImg" name="time-signature" /></button>
                        <button id="bpmMeter" @click="notationSelect('bpmMeter')" data-tooltip="BPM" v-bind="menuButtonBindings('bpmMeter')"><AppIcon id="bpmMeterImg" name="tempo" /></button>
                        <button id="addMeasure" @click="addBlock()" data-tooltip="Add Measure" class="checkBoxNote"><AppIcon id="addMeasureImg" name="bar-add" /></button>
                        <button id="removeMeasure" @click="removeBlock()" data-tooltip="Remove Measure" class="checkBoxNote"><AppIcon
                                id="removeMeasureImg" name="bar-remove" /></button>
                        <button id="openBar" @click="measureSelect('openBar')" data-tooltip="Add Open Bar" v-bind="menuButtonBindings('openBar')"><AppIcon id="openBarImg" name="repeat-open" /></button>
                        <button id="closeBar" @click="notationSelect('closeBar')" data-tooltip="Add Close Bar" v-bind="menuButtonBindings('closeBar')"><AppIcon id="closeBarImg" name="repeat-close" /></button>
                        <button id="repeatAlternative" @click="notationSelect('repeatAlternative')" data-tooltip="Add Repeat Alternative" v-bind="menuButtonBindings('repeatAlternative')"><AppIcon
                                id="repeatAlternativeImg" name="volta" /></button>
                    </div>
                </div>
                    <div id="statusBar5" :class="statusBarClass(5)">
                    <div class="checkBoxBar">
                        <button id="addChord" @click="notationSelect('addChord')" data-tooltip="Add Chord" v-bind="menuButtonBindings('addChord')"><AppIcon id="addChordImg" name="chord" /></button>
                        <button id="addText" @click="notationSelect('addText')" data-tooltip="Add Text" v-bind="menuButtonBindings('addText')"><AppIcon id="addTextImg" name="text" /></button>
                        <button id="addMarker" @click="notationSelect('addMarker')" data-tooltip="Add Marker" v-bind="menuButtonBindings('addMarker')"><AppIcon id="addMarkerImg" name="marker" /></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="sideBarButtons">
        <label class="bpmSidebarLabel">BPM</label>
        <div id="tempoMeter" @mousedown="(e: MouseEvent) => { changeTempoFunc(e) }" class="disable-select">{{ currentTempo }}</div>
        <button id="classicalToggleButton" @click="toggleClassicalNotationView()" data-tooltip="Piano Note View"
                :class="['classicalButton', { classicalBack: classicalNotationActive }]"><AppIcon id="classicalToggle" name="notation" /></button>
        <button data-tooltip="Chords Menu" class="classicalButton" @click="modalManager.toggleByModal(MODALS.CHORD_MANAGER, {trackId: currentTrackId})">
            <AppIcon id="chordSection" name="chords" />
        </button>
        <button id="zoomIn" @click="zoomTab(true)" data-tooltip="Zoom In" class="classicalButton"><AppIcon id="zoomInImg" name="zoom-in" /></button>
        <button id="zoomOut" @click="zoomTab(false)" data-tooltip="Zoom Out" class="classicalButton"><AppIcon id="zoomOutImg" name="zoom-out" /></button>
        <button id="fullscreen" @click="typedEventBus.emit('ui.disablePageMode')" data-tooltip="Fullscreen" class="classicalButton"><AppIcon id="fullscreenImg" name="fullscreen" /></button>

        <button id="guitarEyeToggle" @click="modalManager.toggleByModal(MODALS.GUITAR)" data-tooltip="Virtual Guitar" class="classicalButton">
            <AppIcon name="guitar" />
        </button>
        <button id="pianoEyeToggle" @click="modalManager.toggleByModal(MODALS.PIANO)" data-tooltip="Virtual Piano" class="classicalButton">
            <AppIcon name="piano" />
        </button>

        <label id="voiceLabel">Voice</label>
        <button id="voice0" @click="selectVoice(0)" :class="voiceButtonClass(0)">1</button>
        <button id="voice1" @click="selectVoice(1)" :class="voiceButtonClass(1)">2</button>
        <!--<div id="pageLayoutToggle"></div>-->
    </div>
    <div id="trackCapsule">
        <div id="trackSign"><img id="trackSignImg" :src="instrumentIconSrc('guitar')" /></div>
    </div>
</template>

<script setup lang="ts">
import { instrumentIconSrc } from '../data/instrumentData';
import { addBlock, removeBlock } from '../services/editor/measureStructureCommands';
import { zoomTab } from '../services/editor/zoom';
import { modalManager } from '../services/dialogs/modalManager';
import { classicalNotation } from '../services/notation/classicalNotationAdapter';
import Settings from '../stores/settingsState';
import liveInput from '../services/midi/liveInput';
import { typedEventBus } from '../utils/typedEventBus';
import Song from '../stores/song';
import { usePlaybackEngine } from '../composables/usePlaybackEngine';
import { playbackTransportState } from '../stores/playbackTransportState';
import { computed, ref } from 'vue';
import { MODALS } from '../services/dialogs/modalTypes';
import { openSongFile } from '../services/songImport';
import { confirmReplaceUnsavedSong } from '../services/songAutosave';
import { clampTempo } from '../utils/tempo';
import { setSongTempo } from '../services/editor/songSettingsCommands';
import { useEditorScopeState } from '../stores/editorScopeState';
import { useTempoState } from '../stores/tempoState';
import { useMenuActions } from '../composables/useMenuActions';
import { useToolbarState } from '../composables/useToolbarState';
import { useUndoRedo } from '../composables/useUndoRedo';
import { toggleDraftsPanel } from '../stores/draftsPanelState';
import { toggleShortcutsHelp } from '../stores/shortcutsHelpState';
import PracticeControls from './PracticeControls.vue';
import SaveFormatMenu from './SaveFormatMenu.vue';
import AppIcon from './AppIcon.vue';
import { switchTrack } from '../services/editor/trackLoading';

// File input ref for opening files
const fileInputRef = ref<HTMLInputElement | null>(null);
const isPreparingRecording = ref(false);
const selectedTuplet = ref('3');
const selectedBarId = ref(1);
const { currentTrackId, currentVoiceId } = useEditorScopeState();
const { currentTempo } = useTempoState();
const { togglePlay: togglePlayback, stop: stopPlayback, preload: preloadPlayback } = usePlaybackEngine();
const { canUndo, canRedo, undo, redo } = useUndoRedo();
const toolbar = useToolbarState(selectedTuplet);
const { availableTuplets, noteTiedTo } = toolbar;
const classicalNotationActive = computed(() => Settings.vexFlowIsActive);

async function toggleClassicalNotationView() {
  await classicalNotation.toggleClassicalVisibility();
}

function isMenuButtonPressed(id: string) {
    return toolbar.isPressed(id);
}

function isMenuButtonDisabled(id: string) {
    return toolbar.isDisabled(id);
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
});

function selectBar(id: number) {
    selectedBarId.value = id;
}

function selectVoice(voiceId: number) {
    switchTrack(Song.currentTrackId, voiceId, false, null);
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
        openSongFile(files);
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
    // One undo step per drag; this also marks the song as changed for autosave.
    setSongTempo(Song.bpm, oldBpm);
}

function tempoMeterMouseMove(event: MouseEvent) {
    const mouseYnew = event.pageY;
    Song.setTempo(clampTempo(oldBpm + initYPos - mouseYnew));
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
    if (liveInput.isRecording) {
        isPreparingRecording.value = false;
        liveInput.stopRecording();
    } else {
        isPreparingRecording.value = true;
        liveInput.recordMidi();
    }
}
</script>