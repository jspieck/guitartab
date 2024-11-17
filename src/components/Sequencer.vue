<template>
    <div id="sequencerBar">
        <div id="sequencerWrapper">
            <div id="sequencerSideBar" :class="{'mininized': sequencerWrapperMininized}">
                <div class="labelDiv headerDiv">
                    <img id="sequencerToggle" class="labelImg sequencerHeaderImg"
                        src="../assets/images/sequencerToggle.svg" @click="toggleSequencerWrapperMinimize" />
                    <div class="label unselectable">Sequencer</div>
                    <div id="sequencerEdit" @click="toggleSequencerEditMode" :background="editModeActive ? 'transparent' : 'rgba(103, 103, 103, 0.22)'">
                        <img id="sequencerEditImg" src="../assets/images/cogWheel.svg" alt="Edit Sequencer">
                    </div>
                    <img id="sequencerAddInstrument" data-tooltip="Add Instrument"
                        src="../assets/images/addInstrument.svg" @click="openAddTrack" />
                    <div id="sequencerPanInstrument" v-if="!editModeActive">Pan</div>
                    <div id="sequencerRevInstrument" v-if="!editModeActive">Rev</div>
                    <div id="sequencerChoInstrument" v-if="!editModeActive">Cho</div>
                </div>
                <div id="sequencerMenuBody" :scrollTop="sequencerScrollTop">
                    <div id="masterRow" class="labelDiv disable-select">
                        <img id="labelImgMaster" class="labelImg" :src="settingsIconSrc" />
                        <div id="instrumentLabelMaster" class="label instrumentLabel">
                            Master
                        </div>
                        <div class="muteBtn" @click="modalManager.toggleModal('equalizerModal', 'EQ')">
                            <div class="muteBtnCircle">EQ</div>
                        </div>
                        <div class="soloBtn" @click="modalManager.toggleModal('compressorModal', '34')">
                            <div class="muteBtnCircle">C</div>
                        </div>
                        <Fader :id="0" />
                    </div>
                    <div v-for="trackId in Song.tracks.length" :key="trackId" class="labelDiv disable-select">
                        <img :id="`labelImg${trackId}`" class="labelImg"
                            :src="Helper.getIconSrc(Song.playBackInstrument[trackId]?.instrument)"
                            @click="handleClick(trackId)" :style="getBorderStyle(trackId)" />
                        <div :id="`instrumentLabel${trackId}`" :class="['label', 'instrumentLabel', { activeInstrument: activeInstrumentIndex === trackId }]"
                            @click="handleTrackLabelClick(trackId)" @keyup="handleKeyUp(trackId)">{{
                                instrumentLabelName[trackId] }}</div>
                        <div class="muteBtn" v-if="editModeActive" @click="muteButtonClickEvent($event, trackId)">
                            <div :class="['muteBtnCircle', { muted: Song.playBackInstrument[trackId].mute }]">M</div>
                        </div>
                        <div class="soloBtn" v-if="editModeActive" @click="soloButtonClickEvent($event, trackId)">
                            <div :class="['muteBtnCircle', { muted: Song.playBackInstrument[trackId].solo }]">S</div>
                        </div>
                        <Fader :id="trackId" v-if="editModeActive" ref="faders"/>
                        <Knob :id="`panKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="panKnobRotate"
                            :start="Song.playBackInstrument[trackId].balance" :min="0" :max="127" :mid-knob="true" />
                        <Knob :id="`reverbKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="reverbKnobRotate"
                            :start="Song.playBackInstrument[trackId].reverb" :min="0" :max="127" :mid-knob="false" />
                        <Knob :id="`chorusKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="chorusKnobRotate"
                            :start="Song.playBackInstrument[trackId].chorus" :min="0" :max="127" :mid-knob="false" />
                        <img :id="`instrumentChange_${trackId}`" v-if="!editModeActive" class="instrumentChange"
                            :src="getChangeButtonImage" @click="openInstrumentSettings(trackId)" />
                        <img :id="`instrumentListDelete_${trackId}`" v-if="!editModeActive" class="instrumentListDelete"
                            :src="getTrashButtonImage" @click="deleteTrack(trackId)" />
                    </div>
                </div>
            </div>
            <div id="composition">
                <div id="sequencerMain">
                    <div id="sequencerMainHeader" :scrollLeft="sequencerScrollLeft">
                        <div class="sequencerOneBlock"
                            @click="sequencerClick($event, Song.currentTrackId, Song.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <span v-for="blockId in numBlocks" :key="blockId" class="beat beatNumber"
                                :symbol="blockId.toString()"></span>
                        </div>
                        <span id="indicatorCellHeader" :left="`${indicatorLeft}px`"></span>
                        <SequenceMarker :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="30" />
                    </div>
                    <div id="sequencerMainBody" @scroll="sequencerScrollEvent">
                        <div id="masterRow" class="sequencerOneBlock"
                            @click="sequencerClick($event, Song.currentTrackId, Song.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <div v-for="blockId in numBlocks" :key="blockId"
                                :id="`sequenceMaster_${blockId}`" class="beat masterBeat">
                                <div v-if="Song.measureMeta[blockId].marker" class="beatText">{{
                                    Song.measureMeta[blockId].marker.text }}</div>
                            </div>
                        </div>
                        <template v-for="trackId in Song.tracks.length" :key="index">
                            <div class="sequencerOneBlock" @click="sequencerClick($event, trackId, Song.currentVoiceId)"
                                @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                                <span v-for="blockId in numBlocks" :key="blockId"
                                    :id="`sequence_${trackId}_${blockId}`" class="beat"
                                    :style="beatStyle(trackId, blockId)"></span>
                            </div>
                        </template>
                        <span id="indicator" :height="`${indicatorLineHeight}px`" :left="`${indicatorLeft}px`"></span>
                        <span id="indicatorCell" :left="`${indicatorLeft}px`" :top="`${indicatorCellTop}px`"></span>
                        <SequenceMarker :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="Song.tracks.length * 30 + 30" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, Ref } from 'vue';
import fastdom from 'fastdom';
import Settings from '../assets/js/settingManager';
import { audioEngine } from '../assets/js/audioEngine';
import Song from '../assets/js/songData';
import { overlayHandler } from '../assets/js/overlayHandler';
import Helper from '../assets/js/helper';
import playBackLogic from '../assets/js/playBackLogicNew';
import AppManager from '../assets/js/appManager';
import { svgDrawer } from '../assets/js/svgDrawer';
import { modalManager } from '../assets/js/modals/modalManager';
import Knob from './Knob.vue';
import SequenceMarker from './SequenceMarker.vue';
import Fader from './Fader.vue';
import { AddTrackModalHandler } from '../assets/js/modals/addTrackModalHandler';
import { DeleteTrackModalHandler } from '../assets/js/modals/deleteTrackModalHandler';

const colorPalette = ['#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D', '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B'];
const SEQUENCER_BLOCK_WIDTH = 30;

let sequencerMouseDownClientX = 0;
let sequencerClickDown = false;
let sequencerIntervalSet = false;
let indicatorPosition = { trackId: 0, blockId: 0 };
let faders: Ref<Array<typeof Fader>> = ref([]);

const sequencerScrollTop = ref(0);
const sequencerScrollLeft = ref(0);
const editModeActive = ref(false);
const sequencerWrapperMininized = ref(false);
const blockIntervalStart = ref(0);
const blockIntervalEnd = ref(0);
const indicatorLineHeight = ref(0);
const indicatorLeft = ref(0);
const indicatorCellTop = ref(0);

const instrumentLabelName = reactive(Song.tracks.map(track => track.name));
const activeInstrumentIndex = ref(Song.currentTrackId);

const handleTrackLabelClick = (trackId: number) => {
    if (Song.currentTrackId !== trackId) {
        document.getElementById('loadingWheel')!.style.display = 'block';
        setTimeout(() => {
            activeInstrumentIndex.value = trackId;
            const blockId = playBackLogic.getCurrentBlock();
            setIndicator(trackId, blockId);
            AppManager.changeTrack(trackId, 0, false, () => {
                svgDrawer.setNewClickedPos(trackId, blockId, Song.currentVoiceId, 0, 1);
                svgDrawer.scrollToSvgBlock(trackId, Song.currentVoiceId, blockId);
                document.getElementById('loadingWheel')!.style.display = 'none';
            });
        }, 0);
    }
}

function toggleSequencerWrapperMinimize() {
    sequencerWrapperMininized.value = !sequencerWrapperMininized;
}

const numBlocks = computed(() => {
    if (Song.measures.length == 0)
        return 0;
    return Song.measures[0].length;
})

const handleKeyUp = (trackId: number) => {
    Song.tracks[trackId].name = instrumentLabelName[trackId];
}

const beatStyle = (trackId: number, index: number) => {
    return Song.isBeatEmpty(trackId, index)
        ? ''
        : { background: colorPalette[trackId % colorPalette.length] };
};

const getChangeButtonImage = computed(() => {
    return Settings.darkMode
        ? './src/assets/images/changeWhite.svg'
        : './src/assets/images/change.svg';
});

const getTrashButtonImage = computed(() => {
    return Settings.darkMode
        ? './src/assets/images/trashCanWhite.svg'
        : './src/assets/images/trashCan.svg';
});

const settingsIconSrc = computed(() => {
    if (Settings.darkMode) {
        return "./src/assets/images/instrumentIcons/myMasterDesignWhite.svg";
    } else {
        return "./src/assets/images/instrumentIcons/myMasterDesign.svg";
    }
});

const getBorderStyle = (trackId: number) => {
    if (Settings.sequencerTrackColor && Song.tracks[trackId] != null) {
        const { red, green, blue } = Song.tracks[trackId].color;
        return `border-left: 3px solid rgb(${red}, ${green}, ${blue});`;
    }
    return "";
};

const handleClick = (trackId: number) => {
    const handler = modalManager.getHandler(MODALS.ADD_TRACK.id) as AddTrackModalHandler;
    handler.setNumberOfTrackToAdd(trackId);
    handler.openModal();
};

function openInstrumentSettings(trackId: number) {
    const handler = modalManager.getHandler(MODALS.ADD_TRACK.id) as AddTrackModalHandler;
    handler.setNumberOfTrackToAdd(trackId);
    modalManager.getHandler(MODALS.INSTRUMENT_SETTINGS.id).openModal({trackId});
}

function openAddTrack() {
    const handler = modalManager.getHandler(MODALS.ADD_TRACK.id) as AddTrackModalHandler;
    handler.setNumberOfTrackToAdd(-1);
    handler.openModal();
}

function deleteTrack(trackId: number) {
    if (Song.measures.length > 1) {
        modalManager.getHandler(MODALS.DELETE_TRACK.id).openModal({trackId});
    } else {
        alert('At least one track must be available!');
    }
}

function toggleSequencerEditMode() {
    editModeActive.value = !editModeActive.value;
}

function soloButtonClickEvent(e: Event, k: number) {
    let circleBtn = e.target as HTMLElement;
    if (circleBtn.classList.contains('soloBtn')) {
        circleBtn = circleBtn.firstChild as HTMLElement;
    }
    if (!Song.playBackInstrument[k].solo) {
        circleBtn.classList.add('muted');
    } else {
        circleBtn.classList.remove('muted');
    }
    Song.playBackInstrument[k].solo = !Song.playBackInstrument[k].solo;
}

function muteButtonClickEvent(e: Event, k: number) {
    let circleBtn = e.target as HTMLElement | null;
    if (circleBtn != null) {
        if (circleBtn.classList.contains('muteBtn')) {
            circleBtn = circleBtn.firstChild as HTMLElement | null;
        }
        if (circleBtn != null) {
            if (!Song.playBackInstrument[k].mute) {
                circleBtn.classList.add('muted');
            } else {
                circleBtn.classList.remove('muted');
            }
        }
    }
    Song.playBackInstrument[k].mute = !Song.playBackInstrument[k].mute;
}

function panKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    const scaled = (angle / 360) * 127; // scale value to the range of 0 to 127
    Song.playBackInstrument[trackId].balance = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'pan');
}

function reverbKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].reverb = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'reverb');
}

function chorusKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].chorus = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'chorus');
}

function getVolumeCanvasContext(i: number) {
    if (faders.value.length > i) {
        return faders.value[i].context;
    }
    return null;
}

const sequencerScrollEvent = (event: UIEvent) => {
    sequencerScrollTop.value = (event.target as HTMLElement).scrollTop;
    sequencerScrollLeft.value = (event.target as HTMLElement).scrollLeft;
}

function sequencerClick(e: MouseEvent, trackId: number, voiceId: number) {
    if (sequencerIntervalSet) {
        sequencerIntervalSet = false;
        return;
    }
    fastdom.mutate(() => {
        const target = e.target as HTMLElement | null;
        if (target != null) {
            const { left } = target.getBoundingClientRect();
            const blockId = Math.floor((target.scrollLeft + e.clientX - left) / 30);
            playBackLogic.clearQueueAndSetNewBlock(blockId);
            setIndicator(trackId, blockId);
            if (Song.currentTrackId !== trackId) {
                setTimeout(() => {
                    document.getElementById('loadingWheel')!.style.display = 'block';
                    activeInstrumentIndex.value = trackId;
                    AppManager.changeTrack(trackId, 0, false, () => {
                        playBackLogic.jumpToPosition(blockId, 0, 0);
                        // beat and string to 0 and 1 for some value
                        svgDrawer.setNewClickedPos(trackId, blockId, voiceId, 0, 1);
                        svgDrawer.scrollToSvgBlock(trackId, voiceId, blockId);
                        document.getElementById('loadingWheel')!.style.display = 'none';
                    });
                });
            } else {
                svgDrawer.scrollToSvgBlock(trackId, voiceId, blockId);
                svgDrawer.setNewClickedPos(trackId, blockId, voiceId, 0, 1);
                playBackLogic.jumpToPosition(blockId, 0, 0);
            }
        }
        overlayHandler.clearAllOverlays();
    });
}

function sequencerMouseMove(e: MouseEvent) {
    const target: HTMLElement | null = e.target as HTMLElement;
    if (target != null
        && sequencerClickDown
        && Math.abs(sequencerMouseDownClientX - e.clientX) > 10) {
        const { left } = target.getBoundingClientRect();
        const startX = Math.min(sequencerMouseDownClientX, e.clientX);
        const endX = Math.max(sequencerMouseDownClientX, e.clientX);
        blockIntervalStart.value = Math.floor((target.scrollLeft + startX - left) / 30);
        blockIntervalEnd.value = Math.floor((target.scrollLeft + endX - left) / 30);
        const trackId = Song.currentTrackId;
        const voiceId = Song.currentVoiceId;
        overlayHandler.initOverlay(trackId, blockIntervalStart.value, voiceId, 0);
        svgDrawer.setNewClickedPos(trackId, blockIntervalStart.value, voiceId, 0, 0);

        const lastBeatId = Song.measures[trackId][blockIntervalEnd.value][voiceId].length - 1;
        overlayHandler.selectionMove(e, trackId, blockIntervalEnd.value, voiceId, lastBeatId);
        sequencerIntervalSet = true;
    }
}

function sequencerMouseUp() {
    sequencerClickDown = false;
    sequencerMouseDownClientX = 0;
    if (sequencerIntervalSet) {
        overlayHandler.setLoopingInterval();
    }
}

function sequencerMouseDown(e: MouseEvent) {
    sequencerClickDown = true;
    sequencerMouseDownClientX = e.clientX;
}

function setIndicator(trackId: number, blockId: number) {
    indicatorLineHeight.value = (Song.measures.length + 1) * 30;
    if (trackId !== indicatorPosition.trackId
        || blockId !== indicatorPosition.blockId) {
        indicatorLeft.value = blockId * 30;
        indicatorCellTop.value = (trackId + 1) * 30;
        indicatorPosition = { trackId, blockId };
        fastdom.mutate(() => {
            document.getElementById('sequencerMainBody')!.scrollLeft = (blockId * SEQUENCER_BLOCK_WIDTH);
        });
    }
}

defineExpose({
    getChangeButtonImage,
    getTrashButtonImage,
    settingsIconSrc,
    getBorderStyle,
    handleClick,
    reverbKnobRotate,
    chorusKnobRotate,
    getVolumeCanvasContext
});
</script>