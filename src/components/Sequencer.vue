<template>
    <div id="sequencerBar">
        <div id="sequencerWrapper" :class="{ minimized: sequencerMinimized }">
            <div id="sequencerSideBar">
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
                <div id="sequencerMenuBody" ref="sequencerMenuBodyRef">
                    <div id="masterRowMenu" class="labelDiv disable-select">
                        <img id="labelImgMaster" class="labelImg" :src="settingsIconSrc" />
                        <div id="instrumentLabelMaster" class="label instrumentLabel">
                            Master
                        </div>
                        <div class="masterFxBtn" :class="{ fxActive: eqActive }" role="button" tabindex="0"
                            :title="`Master equalizer${eqActive ? ' (shaping the sound)' : ' (flat)'}`" aria-label="Open master equalizer"
                            @click="modalManager.toggleModal('equalizerModal', 'EQ')"
                            @keydown.enter.prevent="modalManager.toggleModal('equalizerModal', 'EQ')">EQ</div>
                        <div class="masterFxBtn" :class="{ fxActive: compressorActive }" role="button" tabindex="0"
                            :title="`Master compressor${compressorActive ? '' : ' (bypassed)'}`" aria-label="Open master compressor"
                            @click="modalManager.toggleModal('compressorModal', 'Compressor')"
                            @keydown.enter.prevent="modalManager.toggleModal('compressorModal', 'Compressor')">Comp</div>
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
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.balance ?? 64" :min="0" :max="127"
                            bipolar :default-value="64" :format="formatPan" :aria-label="`${instrumentLabelName[trackId]} pan`"
                            @update:model-value="panKnobRotate($event, trackId)" />
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.reverb ?? 0" :min="0" :max="127"
                            :default-value="0" :format="formatAmount" :aria-label="`${instrumentLabelName[trackId]} reverb`"
                            @update:model-value="reverbKnobRotate($event, trackId)" />
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.chorus ?? 0" :min="0" :max="127"
                            :default-value="0" :format="formatAmount" :aria-label="`${instrumentLabelName[trackId]} chorus`"
                            @update:model-value="chorusKnobRotate($event, trackId)" />
                        <img :id="`instrumentChange_${trackId}`" v-if="!editModeActive" class="instrumentChange"
                            :src="getChangeButtonImage" @click="openInstrumentSettings(trackId)" />
                        <img :id="`instrumentListDelete_${trackId}`" v-if="!editModeActive" class="instrumentListDelete"
                            :src="getTrashButtonImage" @click="deleteTrack(trackId)" />
                    </div>
                </div>
            </div>
            <div id="composition">
                <div id="sequencerMain">
                    <div id="sequencerMainHeader" ref="sequencerMainHeaderRef">
                        <div class="sequencerOneBlock"
                            @click="sequencerClick($event, reactiveSongData.currentTrackId, reactiveSongData.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <span v-for="blockId in numBlocks" :key="blockId" class="beat beatNumber">
                                {{ blockId - 1 }}
                            </span>
                        </div>
                        <span id="indicatorCellHeader" :style="{ left: indicatorLeft + 'px' }"></span>
                        <SequenceMarker v-if="hasIntervalSelection" :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="30" />
                    </div>
                    <div id="sequencerMainBody" ref="sequencerMainBodyRef" :key="`${renderKey}-${songDataVersion}`" @scroll="sequencerScrollEvent">
                        <div id="masterRowMain" class="sequencerOneBlock"
                            @click="sequencerClick($event, reactiveSongData.currentTrackId, reactiveSongData.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <div v-for="blockId in numBlocks" :key="blockId"
                                :id="`sequenceMaster_${blockId - 1}`" class="beat masterBeat">
                                <!-- Labels near the end grow leftwards, so they never stick out of the sequencer. -->
                                <div v-if="reactiveSongData.measureMeta[blockId - 1]?.marker" class="beatText"
                                    :class="{ 'beatText--end': blockId > numBlocks - 3 }"
                                    :title="reactiveSongData.measureMeta[blockId - 1].marker?.text">{{
                                    reactiveSongData.measureMeta[blockId - 1].marker?.text }}</div>
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
                        <SequenceMarker v-if="hasIntervalSelection" :block-start="blockIntervalStart" :block-end="blockIntervalEnd" :height="reactiveSongData.tracks.length * 30 + 30" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUpdated, onBeforeUnmount, watch, nextTick } from 'vue';
import fastdom from 'fastdom';
import Settings from '../assets/js/settingManager';
import { audioEngine } from '../assets/js/audioEngine';
import { overlayHandler } from '../assets/js/overlayHandler';
import Helper from '../assets/js/helper';
import playBackLogic from '../assets/js/playbackEngine';
import { typedEventBus } from '../utils/typedEventBus';
import { showUserError } from '../services/userNotifications';
import { modalManager } from '../assets/js/modals/modalManager';
import type { EqualizerModalHandler } from '../assets/js/modals/equalizerModalHandler';
import type { CompressorModalHandler } from '../assets/js/modals/compressorModalHandler';
import editorCore from '../services/editor/editorCore';
import RotaryKnob from './audio/RotaryKnob.vue';
import SequenceMarker from './SequenceMarker.vue';
import Fader from './Fader.vue';
import { AddTrackModalHandler } from '../assets/js/modals/addTrackModalHandler';
import { MODALS } from "../assets/js/modals/modalTypes";
import { sequencerHandler } from '../assets/js/sequencerHandler';
import { useSongData } from '../composables/useSongData';
import { changeTrackWithLoading, focusEditorPosition } from '../services/editorNavigation';
import changeButtonImage from '../assets/images/change.svg';
import trashButtonImage from '../assets/images/trashCan.svg';
import masterSettingsIcon from '../assets/images/instrumentIcons/myMasterDesign.svg';

const { reactiveSongData, syncSongData, songDataVersion } = useSongData();

const colorPalette = ['#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D', '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B'];
const SEQUENCER_BLOCK_WIDTH = 30;

let sequencerMouseDownClientX = 0;
let sequencerClickDown = false;
let sequencerIntervalSet = false;
let indicatorPosition = { trackId: 0, blockId: 0 };
const masterFaderRef = ref<InstanceType<typeof Fader> | null>(null);

const editModeActive = ref(false);
const equalizerHandler = modalManager.getHandler<EqualizerModalHandler>('equalizerModal');
const compressorHandler = modalManager.getHandler<CompressorModalHandler>('compressorModal');
const eqActive = computed(() => !equalizerHandler.isFlat());
const compressorActive = computed(() => !compressorHandler.bypass.value);
const sequencerMinimized = ref(false);
const renderKey = ref(0);
const blockIntervalStart = ref(-1);
const blockIntervalEnd = ref(-1);
const indicatorLineHeight = ref(0);
const indicatorLeft = ref(0);
const indicatorCellTop = ref(0);
const sequencerMenuBodyRef = ref<HTMLElement | null>(null);
const sequencerMainHeaderRef = ref<HTMLElement | null>(null);
const sequencerMainBodyRef = ref<HTMLElement | null>(null);

// Track names
const instrumentLabelName = computed(() => {
    if (!reactiveSongData.tracks) return [];
    return reactiveSongData.tracks.map((track, index) => {
        const name = track?.name?.trim();
        return name || `Track ${index + 1}`;
    });
});
const activeInstrumentIndex = ref(reactiveSongData.currentTrackId);

const updateTrackNames = () => {
    activeInstrumentIndex.value = reactiveSongData.currentTrackId;
};

// A deep watch on tracks walked every track on each edit; song loads bump songDataVersion.
watch(songDataVersion, updateTrackNames);
watch(() => reactiveSongData.currentTrackId, (newId) => {
    activeInstrumentIndex.value = newId;
});

sequencerHandler.registerEditModeActiveRef(editModeActive);
sequencerHandler.registerSequencerSetIndicatorCallback(setIndicator);

const forceSequencerRedraw = () => {
    syncSongData();
    renderKey.value++;
};
sequencerHandler.registerSequencerRedrawCallback(forceSequencerRedraw);

const setFaderRef = (el: any) => {
    if (el) {
        const fader = el as any;
        if (fader.context && fader.id !== undefined) {
            sequencerHandler.registerFaderContext(fader.id, fader.context);
        }
    }
};

const registerFaderContexts = () => {
    if (masterFaderRef.value) {
        const masterFader = masterFaderRef.value as any;
        if (masterFader.context) {
            sequencerHandler.registerFaderContext(0, masterFader.context);
        }
    }
};

onMounted(() => {
    registerFaderContexts();
    setIndicator(reactiveSongData.currentTrackId || 0, 0);
    updateTrackNames();
});

onUpdated(() => {
    registerFaderContexts();
});

onBeforeUnmount(() => {
    sequencerHandler.unregisterFaderContext(0);
    for (let i = 1; i <= reactiveSongData.tracks.length; i++) {
        sequencerHandler.unregisterFaderContext(i);
    }
});

const handleTrackLabelClick = (trackId: number) => {
    if (reactiveSongData.currentTrackId !== trackId) {
        const blockId = playBackLogic.getCurrentBlock();
        changeTrackWithLoading(trackId, 0, (complete) => {
            nextTick(() => {
                focusEditorPosition({
                    trackId,
                    blockId,
                    voiceId: reactiveSongData.currentVoiceId,
                    beatId: 0,
                    string: 1,
                }, { updatePlaybackPosition: false });
                complete();
            });
        }, {
            onBeforeChange: () => {
                activeInstrumentIndex.value = trackId;
                setIndicator(trackId, blockId);
            },
        });
    }
}

function toggleSequencerWrapperMinimize() {
    sequencerMinimized.value = !sequencerMinimized.value;
}

const numBlocks = computed(() => {
    if (!reactiveSongData.measures || reactiveSongData.measures.length === 0 || !reactiveSongData.measures[0])
        return 0;
    return reactiveSongData.measures[0].length;
});

const hasIntervalSelection = computed(() => blockIntervalStart.value >= 0 && blockIntervalEnd.value >= 0);

function clearIntervalOverlay() {
    blockIntervalStart.value = -1;
    blockIntervalEnd.value = -1;
}

sequencerHandler.registerClearIntervalOverlayCallback(clearIntervalOverlay);

const handleKeyUp = (trackId: number) => {
    if (!reactiveSongData.tracks || !reactiveSongData.tracks[trackId] || !instrumentLabelName.value[trackId]) {
        return;
    }
    editorCore.setTrackName(trackId, instrumentLabelName.value[trackId]);
    syncSongData();
}

const beatStyle = (trackId: number, index: number) => {
    if (!reactiveSongData.measures[trackId] || !reactiveSongData.measures[trackId][index]) {
        return '';
    }
    return editorCore.isBeatEmpty(trackId, index)
        ? ''
        : { background: colorPalette[trackId % colorPalette.length] };
};

const getChangeButtonImage = changeButtonImage;

const getTrashButtonImage = trashButtonImage;

const settingsIconSrc = masterSettingsIcon;

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
    if (!editorCore.canDeleteTrack()) {
        showUserError('A song needs at least one track.');
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
    editorCore.togglePlayBackInstrumentFlag(k, 'solo');
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
    editorCore.togglePlayBackInstrumentFlag(k, 'mute');
    syncSongData();
}

function panKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'balance', scaled);
    audioEngine.setEffectGain(trackId, scaled, 'pan');
    syncSongData();
}

function reverbKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'reverb', scaled);
    audioEngine.setEffectGain(trackId, scaled, 'reverb');
    syncSongData();
}

function chorusKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'chorus', scaled);
    audioEngine.setEffectGain(trackId, scaled, 'chorus');
    syncSongData();
}

function formatPan(value: number): string {
    const pan = Math.round(((value - 64) / 63) * 100);
    if (Math.abs(pan) < 2) return 'Center';
    return `${pan < 0 ? 'L' : 'R'} ${Math.abs(pan)}`;
}

function formatAmount(value: number): string {
    return `${Math.round((value / 127) * 100)}%`;
}

const sequencerScrollEvent = (event: Event) => {
    const target = event.target as HTMLElement;
    fastdom.mutate(() => {
        if (sequencerMenuBodyRef.value) {
            sequencerMenuBodyRef.value.scrollTop = target.scrollTop;
        }
        if (sequencerMainHeaderRef.value) {
            sequencerMainHeaderRef.value.scrollLeft = target.scrollLeft;
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
                changeTrackWithLoading(trackId, 0, (complete) => {
                    focusEditorPosition({ trackId, blockId, voiceId, beatId: 0, string: 1 });
                    complete();
                }, {
                    onBeforeChange: () => {
                        activeInstrumentIndex.value = trackId;
                    },
                });
            } else {
                focusEditorPosition({ trackId, blockId, voiceId, beatId: 0, string: 1 });
            }
            overlayHandler.resetOverlays();
        }
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
            if (sequencerMainBodyRef.value) {
                sequencerMainBodyRef.value.scrollLeft = (blockId * SEQUENCER_BLOCK_WIDTH);
            }
        });
    }
}

</script>