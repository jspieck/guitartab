<template>
    <div id="sequencerBar">
        <div id="sequencerWrapper">
            <div id="sequencerSideBar" :class="{'mininized': sequencerWrapperMininized}">
                <div class="labelDiv headerDiv">
                    <img id="sequencerToggle" class="labelImg sequencerHeaderImg"
                        src="../assets/images/sequencerToggle.svg" @click="toggleSequencerWrapperMinimize" />
                    <div class="label unselectable">Sequencer</div>
                    <div id="sequencerEdit" @click="toggleSequencerEditMode" :style="{ background: editModeActive ? 'transparent' : 'rgba(103, 103, 103, 0.22)' }">
                        <img id="sequencerEditImg" src="../assets/images/cogWheel.svg" alt="Edit Sequencer">
                    </div>
                    <img id="sequencerAddInstrument" data-tooltip="Add Instrument"
                        src="../assets/images/addInstrument.svg" @click="openAddTrack" />
                    <div id="sequencerPanInstrument" v-if="!editModeActive">Pan</div>
                    <div id="sequencerRevInstrument" v-if="!editModeActive">Rev</div>
                    <div id="sequencerChoInstrument" v-if="!editModeActive">Cho</div>
                </div>
                <div id="sequencerMenuBody" @scroll="sequencerScrollEvent">
                    <div id="masterRowMenu" class="labelDiv disable-select">
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
                        <Fader :fader-id="0" ref="masterFaderRef" />
                    </div>
                    <div v-for="(track, trackId) in reactiveSongData.tracks" :key="trackId" class="labelDiv disable-select">
                        <img :id="`labelImg${trackId}`" class="labelImg"
                            :src="Helper.getIconSrc(reactiveSongData.playBackInstrument[trackId]?.instrument)"
                            @click="handleClick(trackId)" :style="getBorderStyle(trackId)" />
                        <div :id="`instrumentLabel${trackId}`" :class="['label', 'instrumentLabel', { activeInstrument: activeInstrumentIndex === trackId }]"
                            @click="handleTrackLabelClick(trackId)" @keyup="handleKeyUp(trackId)">{{
                                instrumentLabelName[trackId] }}</div>
                        <div class="muteBtn" v-if="editModeActive" @click="muteButtonClickEvent($event, trackId)">
                            <div :class="['muteBtnCircle', { muted: reactiveSongData.playBackInstrument[trackId].mute }]">M</div>
                        </div>
                        <div class="soloBtn" v-if="editModeActive" @click="soloButtonClickEvent($event, trackId)">
                            <div :class="['muteBtnCircle', { muted: reactiveSongData.playBackInstrument[trackId].solo }]">S</div>
                        </div>
                        <Fader :fader-id="trackId" v-if="editModeActive" :ref="(el: any) => { if (el) setFaderRef(el); }"/>
                        <Knob :id="`panKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="panKnobRotate"
                            :start="reactiveSongData.playBackInstrument[trackId]?.balance || 0" :min="0" :max="127" :mid-knob="true" />
                        <Knob :id="`reverbKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="reverbKnobRotate"
                            :start="reactiveSongData.playBackInstrument[trackId]?.reverb || 0" :min="0" :max="127" :mid-knob="false" />
                        <Knob :id="`chorusKnob${trackId}`" v-if="!editModeActive" :data-id="trackId" :rotate-func="chorusKnobRotate"
                            :start="reactiveSongData.playBackInstrument[trackId]?.chorus || 0" :min="0" :max="127" :mid-knob="false" />
                        <img :id="`instrumentChange_${trackId}`" v-if="!editModeActive" class="instrumentChange"
                            :src="getChangeButtonImage" @click="openInstrumentSettings(trackId)" />
                        <img :id="`instrumentListDelete_${trackId}`" v-if="!editModeActive" class="instrumentListDelete"
                            :src="getTrashButtonImage" @click="deleteTrack(trackId)" />
                    </div>
                </div>
            </div>
            <div id="composition">
                <div id="sequencerMain">
                    <div id="sequencerMainHeader">
                        <div class="sequencerOneBlock"
                            @click="sequencerClick($event, reactiveSongData.currentTrackId, reactiveSongData.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <span v-for="blockId in numBlocks" :key="blockId" class="beat beatNumber">
                                {{ blockId - 1 }}
                            </span>
                        </div>
                        <span id="indicatorCellHeader" :style="{ left: indicatorLeft + 'px' }"></span>
                        <SequenceMarker :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="30" />
                    </div>
                    <div id="sequencerMainBody" @scroll="sequencerScrollEvent">
                        <div id="masterRowMain" class="sequencerOneBlock"
                            @click="sequencerClick($event, reactiveSongData.currentTrackId, reactiveSongData.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <div v-for="blockId in numBlocks" :key="blockId"
                                :id="`sequenceMaster_${blockId - 1}`" class="beat masterBeat">
                                <div v-if="reactiveSongData.measureMeta[blockId - 1]?.marker" class="beatText">{{
                                    reactiveSongData.measureMeta[blockId - 1].marker.text }}</div>
                            </div>
                        </div>
                        <template v-for="(track, trackId) in reactiveSongData.tracks" :key="trackId">
                            <div class="sequencerOneBlock" @click="sequencerClick($event, trackId, reactiveSongData.currentVoiceId)"
                                @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                                <span v-for="blockId in numBlocks" :key="blockId"
                                    :id="`sequence_${trackId}_${blockId - 1}`" class="beat"
                                    :style="beatStyle(trackId, blockId - 1)"></span>
                            </div>
                        </template>
                        <span id="indicator" :style="{ height: indicatorLineHeight + 'px', left: indicatorLeft + 'px' }"></span>
                        <span id="indicatorCell" :style="{ left: indicatorLeft + 'px', top: indicatorCellTop + 'px' }"></span>
                        <SequenceMarker :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="reactiveSongData.tracks.length * 30 + 30" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, Ref, onMounted, onUpdated, onBeforeUnmount, watch, nextTick } from 'vue';
import fastdom from 'fastdom';
import Settings from '../assets/js/settingManager';
import { audioEngine } from '../assets/js/audioEngine';
import Song from '../assets/js/songData';
import { overlayHandler } from '../assets/js/overlayHandler';
import Helper from '../assets/js/helper';
import playBackLogic from '../assets/js/playBackLogicNew';
import AppManager from '../assets/js/appManager';
import { typedEventBus } from '../utils/typedEventBus';
import { modalManager } from '../assets/js/modals/modalManager';
import Knob from './Knob.vue';
import SequenceMarker from './SequenceMarker.vue';
import Fader from './Fader.vue';
import { AddTrackModalHandler } from '../assets/js/modals/addTrackModalHandler';
import { DeleteTrackModalHandler } from '../assets/js/modals/deleteTrackModalHandler';
import { MODALS } from "../assets/js/modals/modalTypes";
import { sequencerHandler } from '../assets/js/sequencerHandler';
import EventBus from '../assets/js/eventBus';
import { useSongData } from '../composables/useSongData';

const { reactiveSongData, syncSongData } = useSongData();

const colorPalette = ['#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D', '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B'];
const SEQUENCER_BLOCK_WIDTH = 30;

let sequencerMouseDownClientX = 0;
let sequencerClickDown = false;
let sequencerIntervalSet = false;
let indicatorPosition = { trackId: 0, blockId: 0 };
let masterFaderRef: Ref<InstanceType<typeof Fader> | null> = ref(null);

const sequencerScrollTop = ref(0);
const sequencerScrollLeft = ref(0);
const editModeActive = ref(false);
const sequencerWrapperMininized = ref(false);
const blockIntervalStart = ref(0);
const blockIntervalEnd = ref(0);
const indicatorLineHeight = ref(0);
const indicatorLeft = ref(0);
const indicatorCellTop = ref(0);

// Track names - use a computed property for reactivity
const instrumentLabelName = computed(() => {
    if (!reactiveSongData.tracks) return [];
    return reactiveSongData.tracks.map((track, index) => {
        const name = track?.name?.trim();
        return name || `Track ${index + 1}`;
    });
});
const activeInstrumentIndex = ref(reactiveSongData.currentTrackId);

// Update track names when song data changes
const updateTrackNames = () => {
    activeInstrumentIndex.value = reactiveSongData.currentTrackId;
};

watch(() => reactiveSongData.tracks, updateTrackNames, { deep: true });
watch(() => reactiveSongData.currentTrackId, (newId) => {
    activeInstrumentIndex.value = newId;
});

// Register with SequencerHandler
sequencerHandler.registerEditModeActiveRef(editModeActive);
sequencerHandler.registerSequencerSetIndicatorCallback(setIndicator);

// Register redraw callback
const forceSequencerRedraw = () => {
    // Force Vue to re-render by updating reactive refs if needed
    sequencerScrollTop.value = sequencerScrollTop.value;
    sequencerScrollLeft.value = sequencerScrollLeft.value;
};
sequencerHandler.registerSequencerRedrawCallback(forceSequencerRedraw);

// Clear and rebuild fader refs array
const setFaderRef = (el: any) => {
    if (el) {
        // Immediately register this fader's context when it's created
        const fader = el as any;
        if (fader.context && fader.id !== undefined) {
            sequencerHandler.registerFaderContext(fader.id, fader.context);
        }
    }
};

// Function to register all fader contexts
const registerFaderContexts = () => {
    // Register master fader context
    if (masterFaderRef.value) {
        const masterFader = masterFaderRef.value as any;
        if (masterFader.context) {
            sequencerHandler.registerFaderContext(0, masterFader.context);
        }
    }
};

// Lifecycle hooks to manage fader context registration
onMounted(() => {
    registerFaderContexts();
    // Initialize indicator position
    setIndicator(reactiveSongData.currentTrackId || 0, 0);
    // Initialize scroll positions
    sequencerScrollTop.value = 0;
    sequencerScrollLeft.value = 0;
    // Initialize track names
    updateTrackNames();
});

onUpdated(() => {
    registerFaderContexts();
});

onBeforeUnmount(() => {
    // Cleanup: unregister all fader contexts
    sequencerHandler.unregisterFaderContext(0); // Master
    for (let i = 1; i <= reactiveSongData.tracks.length; i++) {
        sequencerHandler.unregisterFaderContext(i);
    }
});

const handleTrackLabelClick = (trackId: number) => {
    if (reactiveSongData.currentTrackId !== trackId) {
        document.getElementById('loadingWheel')!.style.display = 'block';
        setTimeout(() => {
            activeInstrumentIndex.value = trackId;
            const blockId = playBackLogic.getCurrentBlock();
            setIndicator(trackId, blockId);
            AppManager.changeTrack(trackId, 0, false, () => {
                nextTick(() => {
                    typedEventBus.emit('navigation.setClickedPos', { trackId, blockId, voiceId: reactiveSongData.currentVoiceId, beatId: 0, string: 1 });
                    typedEventBus.emit('navigation.scrollToBlock', { trackId, voiceId: reactiveSongData.currentVoiceId, blockId });
                    document.getElementById('loadingWheel')!.style.display = 'none';
                });
            });
        }, 0);
    }
}

function toggleSequencerWrapperMinimize() {
    sequencerWrapperMininized.value = !sequencerWrapperMininized;
}

const numBlocks = computed(() => {
    if (!reactiveSongData.measures || reactiveSongData.measures.length === 0 || !reactiveSongData.measures[0])
        return 0;
    return reactiveSongData.measures[0].length;
})

const handleKeyUp = (trackId: number) => {
    if (!reactiveSongData.tracks || !reactiveSongData.tracks[trackId] || !instrumentLabelName.value[trackId]) {
        return;
    }
    Song.tracks[trackId].name = instrumentLabelName.value[trackId];
    syncSongData();
}

const beatStyle = (trackId: number, index: number) => {
    if (!reactiveSongData.measures[trackId] || !reactiveSongData.measures[trackId][index]) {
        return '';
    }
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
    if (!Settings.sequencerTrackColor || !reactiveSongData.tracks || !reactiveSongData.tracks[trackId]) {
        return "";
    }
    const { red, green, blue } = reactiveSongData.tracks[trackId].color;
    return `border-left: 3px solid rgb(${red}, ${green}, ${blue});`;
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
    if (!Song.measures || Song.measures.length <= 1) {
        alert('At least one track must be available!');
        return;
    }
    modalManager.getHandler(MODALS.DELETE_TRACK.id).openModal({trackId});
}

function toggleSequencerEditMode() {
    sequencerHandler.toggleEditMode();
}

function soloButtonClickEvent(e: Event, k: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[k]) {
        return;
    }
    let circleBtn = e.target as HTMLElement;
    if (circleBtn.classList.contains('soloBtn')) {
        circleBtn = circleBtn.firstChild as HTMLElement;
    }
    if (!reactiveSongData.playBackInstrument[k].solo) {
        circleBtn.classList.add('muted');
    } else {
        circleBtn.classList.remove('muted');
    }
    Song.playBackInstrument[k].solo = !Song.playBackInstrument[k].solo;
    syncSongData();
}

function muteButtonClickEvent(e: Event, k: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[k]) {
        return;
    }
    let circleBtn = e.target as HTMLElement | null;
    if (circleBtn != null) {
        if (circleBtn.classList.contains('muteBtn')) {
            circleBtn = circleBtn.firstChild as HTMLElement | null;
        }
        if (circleBtn != null) {
            if (!reactiveSongData.playBackInstrument[k].mute) {
                circleBtn.classList.add('muted');
            } else {
                circleBtn.classList.remove('muted');
            }
        }
    }
    Song.playBackInstrument[k].mute = !Song.playBackInstrument[k].mute;
    syncSongData();
}

function panKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    const scaled = (angle / 360) * 127; // scale value to the range of 0 to 127
    Song.playBackInstrument[trackId].balance = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'pan');
    syncSongData();
}

function reverbKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].reverb = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'reverb');
    syncSongData();
}

function chorusKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].chorus = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'chorus');
    syncSongData();
}

const sequencerScrollEvent = (event: UIEvent) => {
    const target = event.target as HTMLElement;
    const isMainBody = target.id === 'sequencerMainBody';
    const isMenuBody = target.id === 'sequencerMenuBody';
    
    if (isMainBody) {
        sequencerScrollTop.value = target.scrollTop;
        sequencerScrollLeft.value = target.scrollLeft;
    } else if (isMenuBody) {
        sequencerScrollTop.value = target.scrollTop;
    }
    
    // Synchronize scrolling between sidebar and header
    fastdom.mutate(() => {
        const menuBody = document.getElementById('sequencerMenuBody');
        const mainBody = document.getElementById('sequencerMainBody');
        const mainHeader = document.getElementById('sequencerMainHeader');
        
        if (isMainBody) {
            if (menuBody && menuBody.scrollTop !== target.scrollTop) {
                menuBody.scrollTop = target.scrollTop;
            }
            if (mainHeader && mainHeader.scrollLeft !== target.scrollLeft) {
                mainHeader.scrollLeft = target.scrollLeft;
            }
        } else if (isMenuBody) {
            if (mainBody && mainBody.scrollTop !== target.scrollTop) {
                mainBody.scrollTop = target.scrollTop;
            }
        }
    });
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
            if (reactiveSongData.currentTrackId !== trackId) {
                setTimeout(() => {
                    document.getElementById('loadingWheel')!.style.display = 'block';
                    activeInstrumentIndex.value = trackId;
                    AppManager.changeTrack(trackId, 0, false, () => {
                        playBackLogic.jumpToPosition(blockId, 0, 0);
                        // beat and string to 0 and 1 for some value
                        typedEventBus.emit('navigation.setClickedPos', { trackId, blockId, voiceId, beatId: 0, string: 1 });
                        typedEventBus.emit('navigation.scrollToBlock', { trackId, voiceId, blockId });
                        document.getElementById('loadingWheel')!.style.display = 'none';
                    });
                });
            } else {
                typedEventBus.emit('navigation.scrollToBlock', { trackId, voiceId, blockId });
                typedEventBus.emit('navigation.setClickedPos', { trackId, blockId, voiceId, beatId: 0, string: 1 });
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
        const trackId = reactiveSongData.currentTrackId;
        const voiceId = reactiveSongData.currentVoiceId;
        overlayHandler.initOverlay(trackId, blockIntervalStart.value, voiceId, 0);
        typedEventBus.emit('navigation.setClickedPos', { trackId, blockId: blockIntervalStart.value, voiceId, beatId: 0, string: 0 });

        const lastBeatId = reactiveSongData.measures[trackId][blockIntervalEnd.value][voiceId].length - 1;
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
    if (!reactiveSongData.measures || reactiveSongData.measures.length === 0) {
        return;
    }
    indicatorLineHeight.value = (reactiveSongData.measures.length + 1) * 30;
    if (trackId !== indicatorPosition.trackId
        || blockId !== indicatorPosition.blockId) {
        indicatorLeft.value = blockId * 30;
        indicatorCellTop.value = (trackId + 1) * 30;
        indicatorPosition = { trackId, blockId };
        fastdom.mutate(() => {
            const element = document.getElementById('sequencerMainBody');
            if (element) {
                element.scrollLeft = (blockId * SEQUENCER_BLOCK_WIDTH);
            }
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
});
</script>