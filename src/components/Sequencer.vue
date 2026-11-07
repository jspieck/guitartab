<template>
    <div id="sequencerBar">
        <div id="sequencerWrapper" :class="{ minimized: sequencerMinimized }">
            <div id="sequencerSideBar">
                <div class="labelDiv headerDiv">
                    <button id="sequencerToggle" type="button" class="labelImg sequencerHeaderImg seq-icon-button"
                        aria-label="Collapse or expand the sequencer" v-hint="sequencerMinimized ? 'Show the sequencer' : 'Collapse the sequencer'"
                        @click="toggleSequencerWrapperMinimize">
                        <AppIcon :name="sequencerMinimized ? 'chevron-up' : 'chevron-down'" />
                    </button>
                    <div class="label unselectable">Sequencer</div>
                    <div id="sequencerEdit" role="button" tabindex="0" @click="toggleSequencerEditMode" @keydown.enter.prevent="toggleSequencerEditMode"
                        v-hint="editModeActive ? 'Show the pan, reverb and chorus knobs instead of the faders' : 'Show volume faders, mute and solo'"
                        :aria-label="editModeActive ? 'Show pan, reverb and chorus' : 'Show volume faders'"
                        :style="{ background: editModeActive ? 'transparent' : 'var(--seq-edit-off)' }">
                        <AppIcon id="sequencerEditImg" name="settings" />
                    </div>
                    <button id="sequencerAddInstrument" type="button" class="seq-icon-button" v-hint="'Add an instrument (a new track)'"
                        aria-label="Add instrument" @click="openAddTrack">
                        <AppIcon name="add" />
                    </button>
                    <div id="sequencerPanInstrument" v-if="!editModeActive" v-hint="'Pan: where a track sits between left and right'">Pan</div>
                    <div id="sequencerRevInstrument" v-if="!editModeActive" v-hint="'Rev: how much reverb (room) a track gets'">Rev</div>
                    <div id="sequencerChoInstrument" v-if="!editModeActive" v-hint="'Cho: how much chorus (shimmer) a track gets'">Cho</div>
                    <div id="sequencerAmpInstrument" v-if="!editModeActive" v-hint="'Amp: guitar amp and cabinet (drive, tone, speaker)'">Amp</div>
                </div>
                <div id="sequencerMenuBody" ref="sequencerMenuBodyRef" :style="{ '--sequencer-scrollbar-gap': scrollbarGap + 'px' }"
                    @wheel="forwardMenuWheel">
                    <!-- The master has no pan/reverb/chorus: with the knobs shown, its EQ and Comp sit after those columns. -->
                    <div id="masterRowMenu" class="labelDiv disable-select" :class="{ 'labelDiv--knobs': !editModeActive }">
                        <img id="labelImgMaster" class="labelImg" :src="settingsIconSrc" alt="" />
                        <div id="instrumentLabelMaster" class="label instrumentLabel">
                            Master
                        </div>
                        <div class="masterFxBtn" :class="{ fxActive: eqActive }" role="button" tabindex="0"
                            :title="`Master equalizer${eqActive ? ' (shaping the sound)' : ' (flat)'}`" aria-label="EQ: master equalizer"
                            v-hint="'Master equalizer: shape the tone of the whole song'"
                            @click="toggleDialog(DIALOGS.EQUALIZER)"
                            @keydown.enter.prevent="toggleDialog(DIALOGS.EQUALIZER)">EQ</div>
                        <div class="masterFxBtn" :class="{ fxActive: compressorActive }" role="button" tabindex="0"
                            :title="`Master compressor${compressorActive ? '' : ' (bypassed)'}`" aria-label="Comp: master compressor"
                            v-hint="'Master compressor: even out loud and quiet parts'"
                            @click="toggleDialog(DIALOGS.COMPRESSOR)"
                            @keydown.enter.prevent="toggleDialog(DIALOGS.COMPRESSOR)">Comp</div>
                        <Fader v-if="editModeActive" :fader-id="0" ref="masterFaderRef" label="Master volume" v-hint="'Master volume'" />
                    </div>
                    <div v-for="(track, trackId) in reactiveSongData.tracks" :key="trackId" class="labelDiv disable-select"
                        :class="{ 'labelDiv--mixer': editModeActive }">
                        <img :id="`labelImg${trackId}`" class="labelImg" role="button" tabindex="0"
                            :alt="`Change the instrument of ${instrumentLabelName[trackId]}`"
                            @keydown.enter.prevent="handleClick(trackId)"
                            :src="instrumentIconSrc(reactiveSongData.playBackInstrument[trackId]?.instrument)"
                            v-hint="`Change the instrument of ${instrumentLabelName[trackId]}`"
                            @click="handleClick(trackId)" :style="getBorderStyle(trackId)" />
                        <div :id="`instrumentLabel${trackId}`" :class="['label', 'instrumentLabel', { activeInstrument: activeInstrumentIndex === trackId }]"
                            v-hint="`Edit ${instrumentLabelName[trackId]} in the tab`"
                            @click="handleTrackLabelClick(trackId)" @keyup="handleKeyUp(trackId)">{{
                                instrumentLabelName[trackId] }}</div>
                        <button type="button" class="muteBtn" v-if="editModeActive" v-hint="`Mute ${instrumentLabelName[trackId]}`"
                            :aria-label="`Mute ${instrumentLabelName[trackId]}`" :aria-pressed="!!reactiveSongData.playBackInstrument[trackId]?.mute"
                            @click="toggleTrackFlag(trackId, 'mute')">
                            <span :class="['muteBtnCircle', { muted: reactiveSongData.playBackInstrument[trackId]?.mute }]">M</span>
                        </button>
                        <button type="button" class="soloBtn" v-if="editModeActive" v-hint="`Solo ${instrumentLabelName[trackId]}: play only the soloed tracks`"
                            :aria-label="`Solo ${instrumentLabelName[trackId]}`" :aria-pressed="!!reactiveSongData.playBackInstrument[trackId]?.solo"
                            @click="toggleTrackFlag(trackId, 'solo')">
                            <span :class="['muteBtnCircle', { muted: reactiveSongData.playBackInstrument[trackId]?.solo }]">S</span>
                        </button>
                        <!-- Fader ids: 0 is the master, tracks count from 1. -->
                        <Fader :fader-id="trackId + 1" :label="`${instrumentLabelName[trackId]} volume`" v-if="editModeActive" :ref="(el: any) => { if (el) setFaderRef(el); }"
                            v-hint="`${instrumentLabelName[trackId]} volume: ${formatAmount(reactiveSongData.playBackInstrument[trackId]?.volume ?? 0)}`"/>
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.balance ?? 64" :min="0" :max="127"
                            bipolar :default-value="64" :format="formatPan" :aria-label="`${instrumentLabelName[trackId]} pan`"
                            v-hint="`${instrumentLabelName[trackId]} pan: ${formatPan(reactiveSongData.playBackInstrument[trackId]?.balance ?? 64)}${KNOB_HELP}`"
                            @update:model-value="panKnobRotate($event, trackId)" />
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.reverb ?? 0" :min="0" :max="127"
                            :default-value="0" :format="formatAmount" :aria-label="`${instrumentLabelName[trackId]} reverb`"
                            v-hint="`${instrumentLabelName[trackId]} reverb: ${formatAmount(reactiveSongData.playBackInstrument[trackId]?.reverb ?? 0)}${KNOB_HELP}`"
                            @update:model-value="reverbKnobRotate($event, trackId)" />
                        <RotaryKnob v-if="!editModeActive" class="seqKnob" :size="26" :show-value="false"
                            :model-value="reactiveSongData.playBackInstrument[trackId]?.chorus ?? 0" :min="0" :max="127"
                            :default-value="0" :format="formatAmount" :aria-label="`${instrumentLabelName[trackId]} chorus`"
                            v-hint="`${instrumentLabelName[trackId]} chorus: ${formatAmount(reactiveSongData.playBackInstrument[trackId]?.chorus ?? 0)}${KNOB_HELP}`"
                            @update:model-value="chorusKnobRotate($event, trackId)" />
                        <button v-if="!editModeActive" :id="`trackAmp_${trackId}`" type="button" class="masterFxBtn seqAmpBtn" data-amp-opener
                            :class="{ fxActive: ampOn(trackId) }" :aria-pressed="ampOn(trackId)"
                            :aria-label="`Amp of ${instrumentLabelName[trackId]}`"
                            v-hint="`${instrumentLabelName[trackId]} amp: ${ampOn(trackId) ? 'on' : 'off'} · click for drive, tone and cabinet`"
                            @click="openAmpPanel($event, trackId)">Amp</button>
                        <!-- The last column: settings, instrument and delete, in a menu (TrackRowMenu). -->
                        <button :id="`instrumentChange_${trackId}`" type="button" class="instrumentChange seq-icon-button"
                            :aria-label="`${instrumentLabelName[trackId]} track menu`" aria-haspopup="menu"
                            :aria-expanded="trackMenu?.trackId === trackId"
                            v-hint="`Track settings, instrument or delete ${instrumentLabelName[trackId]}`"
                            @click="toggleTrackMenu($event, trackId)"><AppIcon name="edit" /></button>
                    </div>
                </div>
                <TrackAmpPanel v-if="ampPanel" :key="ampPanel.trackId" :track-id="ampPanel.trackId"
                    :track-name="instrumentLabelName[ampPanel.trackId]" :anchor="ampPanel.anchor" @close="closeAmpPanel" />
                <TrackRowMenu v-if="trackMenu" :key="trackMenu.trackId" :track-id="trackMenu.trackId"
                    :track-name="instrumentLabelName[trackMenu.trackId]" :anchor="trackMenu.anchor" @close="trackMenu = null" />
            </div>
            <div id="composition">
                <div id="sequencerMain">
                    <div id="sequencerMainHeader" ref="sequencerMainHeaderRef"
                        :style="{ '--sequencer-vscrollbar-gap': verticalScrollbarGap + 'px' }">
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
                    <div id="sequencerMainBody" ref="sequencerMainBodyRef" @scroll="sequencerScrollEvent">
                        <div id="masterRowMain" class="sequencerOneBlock"
                            @click="sequencerClick($event, reactiveSongData.currentTrackId, reactiveSongData.currentVoiceId)"
                            @mousedown="sequencerMouseDown" @mouseup="sequencerMouseUp" @mousemove="sequencerMouseMove">
                            <div v-for="blockId in numBlocks" :key="blockId"
                                :id="`sequenceMaster_${blockId - 1}`" class="beat masterBeat">
                                <!-- Labels near the end grow leftwards, so they never stick out of the sequencer. -->
                                <!-- A marker loops its section (up to the next marker) when clicked. -->
                                <button v-if="reactiveSongData.measureMeta[blockId - 1]?.marker" type="button" class="beatText"
                                    :class="{ 'beatText--end': blockId > numBlocks - 3, 'beatText--looped': sectionLooped(blockId - 1) }"
                                    :aria-pressed="sectionLooped(blockId - 1)"
                                    :title="`Loop ${reactiveSongData.measureMeta[blockId - 1].marker?.text}`"
                                    @mousedown.stop @mouseup.stop @click.stop="toggleSectionLoop(blockId - 1)">{{
                                    reactiveSongData.measureMeta[blockId - 1].marker?.text }}</button>
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
import { instrumentIconSrc, publicUrl } from '../data/instrumentData';
import { computed, ref, onMounted, onUpdated, onBeforeUnmount, watch, nextTick } from 'vue';
import fastdom from 'fastdom';
import Settings from '../stores/settingsState';
import { audioGraph } from '../services/audio/audioGraph';
import { applyRangeAsLoop, clearRange, startRange, extendRange } from '../services/editor/rangeSelection';
import playback from '../services/playback';
import { typedEventBus } from '../utils/typedEventBus';
import { DIALOGS, toggleDialog } from '../services/dialogs/dialogs';
import { masterEqualizer } from '../services/audio/masterEqualizer';
import { masterCompressor } from '../services/audio/masterCompressor';
import editorCore from '../services/editor/editorCore';
import RotaryKnob from './audio/RotaryKnob.vue';
import TrackAmpPanel from './audio/TrackAmpPanel.vue';
import { trackAmp } from '../services/audio/ampModel';
import SequenceMarker from './SequenceMarker.vue';
import Fader from './Fader.vue';
import { openAddTrack, openChangeInstrument } from '../services/editor/trackActions';
import TrackRowMenu from './TrackRowMenu.vue';
import { registerMeterCanvas, sequencerState, setSequencerRange } from '../stores/sequencerState';
import { useSongData } from '../composables/useSongData';
import { changeTrackWithLoading, focusEditorPosition } from '../services/editorNavigation';
import AppIcon from './AppIcon.vue';
import { vHint } from '../composables/vHint';
import { isSectionLooped, toggleSectionLoop } from '../services/sectionLoops';
import { playbackLoopState } from '../stores/playbackLoopState';
import { sectionAt } from '../utils/markerSections';

/** Whether the marker at `blockId` is the section being looped (reads the reactive loop state). */
function sectionLooped(blockId: number): boolean {
    void playbackLoopState.active;
    const section = sectionAt(reactiveSongData.measureMeta, blockId);
    return section != null && isSectionLooped(section.startBlock, section.endBlock);
}

const { reactiveSongData, syncSongData, songDataVersion } = useSongData();

const colorPalette = ['#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D', '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B'];
const SEQUENCER_BLOCK_WIDTH = 30;
const KNOB_HELP = ' · drag up/down or scroll to change, double-click to reset';

let sequencerMouseDownClientX = 0;
let sequencerClickDown = false;
let sequencerIntervalSet = false;
let indicatorPosition = { trackId: 0, blockId: 0 };
const masterFaderRef = ref<InstanceType<typeof Fader> | null>(null);

const editModeActive = computed(() => sequencerState.editMode);
const eqActive = computed(() => !masterEqualizer.isFlat());
const compressorActive = computed(() => !masterCompressor.bypass.value);
const sequencerMinimized = ref(false);
const blockIntervalStart = computed(() => sequencerState.rangeStart);
const blockIntervalEnd = computed(() => sequencerState.rangeEnd);
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

watch(() => sequencerState.indicator, ({ trackId, blockId }) => setIndicator(trackId, blockId));

const setFaderRef = (el: any) => {
    if (el) {
        const fader = el as any;
        if (fader.context && fader.id !== undefined) {
            registerMeterCanvas(fader.id, fader.context);
        }
    }
};

const registerFaderContexts = () => {
    // The master fader is hidden while the knobs are shown.
    const masterFader = masterFaderRef.value as any;
    registerMeterCanvas(0, masterFader?.context ?? null);
};

// The grid's horizontal scrollbar takes height the track column doesn't have; pad the column by it.
// Its vertical scrollbar takes width the bar-number header doesn't have; pad the header by it,
// so both scroll the same distance sideways.
const scrollbarGap = ref(0);
const verticalScrollbarGap = ref(0);
const measureScrollbarGap = () => {
    const body = sequencerMainBodyRef.value;
    if (!body) return;
    scrollbarGap.value = body.offsetHeight - body.clientHeight;
    verticalScrollbarGap.value = body.offsetWidth - body.clientWidth;
};
let bodyResizeObserver: ResizeObserver | null = null;

/** The track column doesn't scroll itself; the wheel over it scrolls the grid, which it follows. */
function forwardMenuWheel(event: WheelEvent) {
    const body = sequencerMainBodyRef.value;
    if (!body || body.scrollHeight <= body.clientHeight) return;
    event.preventDefault();
    body.scrollTop += event.deltaY;
}

onMounted(() => {
    measureScrollbarGap();
    if (sequencerMainBodyRef.value && typeof ResizeObserver !== 'undefined') {
        bodyResizeObserver = new ResizeObserver(measureScrollbarGap);
        bodyResizeObserver.observe(sequencerMainBodyRef.value);
    }
    registerFaderContexts();
    setIndicator(reactiveSongData.currentTrackId || 0, 0);
    updateTrackNames();
});

onUpdated(() => {
    registerFaderContexts();
    measureScrollbarGap();
});

onBeforeUnmount(() => {
    bodyResizeObserver?.disconnect();
    registerMeterCanvas(0, null);
    for (let i = 1; i <= reactiveSongData.tracks.length; i++) {
        registerMeterCanvas(i, null);
    }
});

const handleTrackLabelClick = (trackId: number) => {
    if (reactiveSongData.currentTrackId !== trackId) {
        const blockId = playback.getCurrentBlock();
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

const settingsIconSrc = publicUrl('instrumentIcons/myMasterDesign.svg');

const getBorderStyle = (trackId: number) => {
    if (!Settings.sequencerTrackColor || !reactiveSongData.tracks || !reactiveSongData.tracks[trackId]) {
        return "";
    }
    const { red, green, blue } = reactiveSongData.tracks[trackId].color;
    return `border-left: 3px solid rgb(${red}, ${green}, ${blue});`;
};

const handleClick = (trackId: number) => openChangeInstrument(trackId);

function toggleSequencerEditMode() {
    sequencerState.editMode = !sequencerState.editMode;
}

// The buttons' lit state is bound to the song data, which syncSongData refreshes.
function toggleTrackFlag(trackId: number, flag: 'mute' | 'solo') {
    if (!reactiveSongData.playBackInstrument?.[trackId]) {
        return;
    }
    editorCore.togglePlayBackInstrumentFlag(trackId, flag);
    syncSongData();
}

function panKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'balance', scaled);
    audioGraph.setEffectGain(trackId, scaled, 'pan');
    syncSongData();
}

function reverbKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'reverb', scaled);
    audioGraph.setEffectGain(trackId, scaled, 'reverb');
    syncSongData();
}

function chorusKnobRotate(scaled: number, trackId: number) {
    if (!reactiveSongData.playBackInstrument || !reactiveSongData.playBackInstrument[trackId]) {
        return;
    }
    editorCore.setPlayBackInstrumentEffect(trackId, 'chorus', scaled);
    audioGraph.setEffectGain(trackId, scaled, 'chorus');
    syncSongData();
}

// Song.tracks and the channels are reactive, so the buttons light up after an import or undo too.
function ampOn(trackId: number): boolean {
    return reactiveSongData.tracks[trackId] != null && trackAmp(trackId).enabled;
}

const ampPanel = ref<{ trackId: number; anchor: DOMRect } | null>(null);

function openAmpPanel(event: MouseEvent, trackId: number) {
    const reopen = ampPanel.value?.trackId !== trackId;
    const anchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ampPanel.value = null;
    // the next panel mounts after the old one has recorded its changes
    if (reopen) nextTick(() => { ampPanel.value = { trackId, anchor }; });
}

const trackMenu = ref<{ trackId: number; anchor: HTMLElement } | null>(null);

function toggleTrackMenu(event: MouseEvent, trackId: number) {
    const anchor = event.currentTarget as HTMLElement;
    trackMenu.value = trackMenu.value?.trackId === trackId ? null : { trackId, anchor };
}

function closeAmpPanel() {
    const trackId = ampPanel.value?.trackId;
    ampPanel.value = null;
    // back to the button that opened it, for keyboard users
    if (trackId != null) nextTick(() => document.getElementById(`trackAmp_${trackId}`)?.focus());
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
            playback.showBar(blockId);
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
            clearRange();
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
        const lastBlock = numBlocks.value - 1;
        const start = Math.min(lastBlock, Math.max(0, Math.floor((target.scrollLeft + startX - left) / 30)));
        const end = Math.min(lastBlock, Math.max(start, Math.floor((target.scrollLeft + endX - left) / 30)));
        const trackId = reactiveSongData.currentTrackId;
        const voiceId = reactiveSongData.currentVoiceId;
        // initOverlay clears the sequencer range, so the range is set after it.
        startRange(trackId, start, voiceId, 0);
        typedEventBus.emit('navigation.setClickedPos', { trackId, blockId: start, voiceId, beatId: 0, string: 0 });

        const lastBeatId = reactiveSongData.measures[trackId][end][voiceId].length - 1;
        extendRange(trackId, end, voiceId, lastBeatId);
        setSequencerRange(start, end);
        sequencerIntervalSet = true;
    }
}

function sequencerMouseUp() {
    sequencerClickDown = false;
    sequencerMouseDownClientX = 0;
    if (sequencerIntervalSet) {
        applyRangeAsLoop();
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