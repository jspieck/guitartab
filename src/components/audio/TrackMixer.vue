<template>
    <div class="tm">
        <div class="ap-toolbar">
            <span class="ap-section-label">{{ tracks.length }} {{ tracks.length === 1 ? 'track' : 'tracks' }}</span>
            <span class="ap-toolbar-spacer"></span>
            <span v-if="soloCount > 0" class="mx-solo-note">{{ soloCount }} soloed</span>
        </div>

        <div class="mx-strips" :style="{ maxWidth: `${maxStripsWidth}px` }">
            <section v-for="strip in tracks" :key="strip.trackId" class="mx-strip tm-strip ap-card"
                :class="{ 'tm-strip-silent': !strip.audible, 'tm-strip-current': strip.trackId === currentTrackId }"
                :style="{ '--strip-color': strip.color }" :aria-label="strip.name">
                <header class="mx-strip-head tm-head" :title="strip.name">
                    <img v-if="strip.icon" class="tm-icon" :src="strip.icon" alt="" />
                    <span class="mx-strip-name">{{ strip.name }}</span>
                </header>
                <div class="mx-buttons">
                    <button type="button" class="mx-btn mx-btn-mute" :aria-pressed="strip.muted"
                        :aria-label="`Mute ${strip.name}`" title="Mute" @click="toggleFlag(strip.trackId, 'mute')">M</button>
                    <button type="button" class="mx-btn mx-btn-solo" :aria-pressed="strip.soloed"
                        :aria-label="`Solo ${strip.name}`" title="Solo" @click="toggleFlag(strip.trackId, 'solo')">S</button>
                </div>
                <div class="tm-inserts">
                    <button type="button" class="tm-fx" :class="{ 'tm-fx-on': strip.eqOn, 'tm-fx-open': isEditing('eq', strip.trackId) }"
                        :aria-pressed="strip.eqOn" :aria-label="`EQ: equalizer of ${strip.name}`"
                        :title="`Equalizer${strip.eqOn ? ' (shaping the sound)' : ' (flat)'}`"
                        @click="openInsert('eq', strip.trackId)">EQ</button>
                    <button type="button" class="tm-fx" :class="{ 'tm-fx-on': strip.compOn, 'tm-fx-open': isEditing('comp', strip.trackId) }"
                        :aria-pressed="strip.compOn" :aria-label="`Comp: compressor of ${strip.name}`"
                        :title="`Compressor${strip.compOn ? '' : ' (off)'}`"
                        @click="openInsert('comp', strip.trackId)">Comp</button>
                </div>
                <RotaryKnob :model-value="strip.pan" :min="0" :max="127" bipolar :default-value="64" :size="34"
                    :aria-label="`${strip.name} pan`" :format="formatPan" @update:model-value="setPan(strip.trackId, $event)" />
                <div class="mx-fader-row">
                    <div class="mx-meter" aria-hidden="true">
                        <div class="mx-meter-fill" :ref="(el: unknown) => setMeterRef(strip.trackId, el as HTMLElement | null)"></div>
                    </div>
                    <VerticalFader :model-value="strip.gain" :default-value="DEFAULT_VOLUME / 100" :height="150"
                        :aria-label="`${strip.name} volume`" @update:model-value="setVolume(strip.trackId, $event)" />
                </div>
                <span class="mx-db ap-num">{{ formatGainDb(strip.gain) }} dB</span>
            </section>

            <section class="mx-strip tm-strip tm-master ap-card" aria-label="Master">
                <header class="mx-strip-head tm-head">
                    <span class="mx-strip-name">Master</span>
                </header>
                <div class="tm-inserts tm-master-inserts">
                    <button type="button" class="tm-fx" :class="{ 'tm-fx-on': masterEqOn, 'tm-fx-open': isEditing('eq', null) }"
                        :aria-pressed="masterEqOn" aria-label="EQ: master equalizer"
                        :title="`Master equalizer${masterEqOn ? ' (shaping the sound)' : ' (flat)'}`"
                        @click="openInsert('eq', null)">EQ</button>
                    <button type="button" class="tm-fx" :class="{ 'tm-fx-on': masterCompOn, 'tm-fx-open': isEditing('comp', null) }"
                        :aria-pressed="masterCompOn" aria-label="Comp: master compressor"
                        :title="`Master compressor${masterCompOn ? '' : ' (bypassed)'}`"
                        @click="openInsert('comp', null)">Comp</button>
                </div>
                <div class="mx-fader-row">
                    <div class="mx-meter" aria-hidden="true">
                        <div class="mx-meter-fill" :ref="(el: unknown) => setMeterRef(MASTER, el as HTMLElement | null)"></div>
                    </div>
                    <VerticalFader :model-value="masterGain" :default-value="1" :height="150"
                        aria-label="Master volume" @update:model-value="setMasterVolume" />
                </div>
                <span class="mx-db ap-num">{{ formatGainDb(masterGain) }} dB</span>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * The mixer's track view: a channel strip per track (mute, solo, channel EQ and compressor,
 * pan, volume, meter) and the master strip. Edits are live and without undo steps, like the
 * sequencer's knobs; the volume is the same value as the sequencer's fader.
 */
import { computed, ref, watch } from 'vue';
import RotaryKnob from './RotaryKnob.vue';
import VerticalFader from './VerticalFader.vue';
import Song from '../../stores/song';
import { audioGraph } from '../../services/audio/audioGraph';
import { masterEqualizer } from '../../services/audio/masterEqualizer';
import { masterCompressor } from '../../services/audio/masterCompressor';
import { trackCompressorActive, trackEqActive } from '../../services/audio/trackInserts';
import { DIALOGS, isDialogOpen, openDialog, closeDialog } from '../../services/dialogs/dialogs';
import { getDialogHandler } from '../../services/dialogs/dialogHandlers';
import type { PlainModalHandler } from '../../services/dialogs/baseModalHandler';
import { previewTrackVolume } from '../../services/editor/songSettingsCommands';
import editorCore from '../../services/editor/editorCore';
import { notifySongDataChanged } from '../../services/appEvents';
import { formatGainDb } from '../../services/drumMixer';
import { instrumentIconSrc } from '../../data/instrumentData';
import { songState } from '../../stores/songState';
import { useAnimationLoop, useDialogOpen } from '../../composables/useDialogOpen';

const STRIP_WIDTH = 84;
const MASTER = -1;
const DEFAULT_VOLUME = 100;
/** track volume is 0–127 with 100 = unity gain (`previewTrackVolume`) */
const MAX_VOLUME = 127;
const PEAK_FALL_PER_FRAME = 0.025;

const isOpen = useDialogOpen(DIALOGS.MIXER.id);
const currentTrackId = computed(() => songState.currentTrackId);

const soloCount = computed(() => Song.playBackInstrument.filter((instrument) => instrument?.solo).length);

const tracks = computed(() => Song.tracks.map((track, trackId) => {
    const instrument = Song.playBackInstrument[trackId];
    const { red = 128, green = 128, blue = 128 } = track.color ?? {};
    const muted = instrument?.mute === true;
    const soloed = instrument?.solo === true;
    return {
        trackId,
        name: track.name?.trim() || `Track ${trackId + 1}`,
        icon: instrumentIconSrc(instrument?.instrument),
        color: `rgb(${red}, ${green}, ${blue})`,
        muted,
        soloed,
        audible: soloCount.value > 0 ? soloed : !muted,
        pan: instrument?.balance ?? 64,
        gain: (instrument?.volume ?? DEFAULT_VOLUME) / 100,
        eqOn: trackEqActive(trackId),
        compOn: trackCompressorActive(trackId),
    };
}));

const masterEqOn = computed(() => !masterEqualizer.isFlat());
const masterCompOn = computed(() => !masterCompressor.bypass.value);
const masterGain = ref(audioGraph.masterGain.gain.value);
watch(isOpen, (open) => {
    if (open) masterGain.value = audioGraph.masterGain.gain.value;
});

const maxStripsWidth = computed(() => Math.min(window.innerWidth - 80, 10 * (STRIP_WIDTH + 6)));

function toggleFlag(trackId: number, flag: 'mute' | 'solo') {
    editorCore.togglePlayBackInstrumentFlag(trackId, flag);
}

function setPan(trackId: number, value: number) {
    const balance = Math.abs(value - 64) < 1 ? 64 : Math.round(value);
    editorCore.setPlayBackInstrumentEffect(trackId, 'balance', balance);
    audioGraph.setEffectGain(trackId, balance, 'pan');
    notifySongDataChanged();
}

function setVolume(trackId: number, gain: number) {
    previewTrackVolume(trackId, Math.min(MAX_VOLUME, Math.max(0, Math.round(gain * 100))));
    notifySongDataChanged();
}

function setMasterVolume(gain: number) {
    // the sequencer's master slider stops at unity too
    masterGain.value = Math.min(1, gain);
    audioGraph.setMasterGain(masterGain.value);
}

function formatPan(value: number): string {
    const pan = (value - 64) / 63.5;
    if (Math.abs(pan) < 0.02) return 'C';
    return `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`;
}

// ---- EQ / Comp buttons open the shared panels, aimed at this strip.
type Insert = 'eq' | 'comp';
const PANELS = { eq: DIALOGS.EQUALIZER, comp: DIALOGS.COMPRESSOR } as const;

function panelTrackId(insert: Insert): number | null | undefined {
    if (!isDialogOpen(PANELS[insert].id)) return undefined;
    const handler = getDialogHandler<PlainModalHandler<{ trackId?: number | null }>>(PANELS[insert].id);
    return handler.params.value?.trackId ?? null;
}

function isEditing(insert: Insert, trackId: number | null): boolean {
    return panelTrackId(insert) === trackId;
}

/** Opens the panel for this strip; a second click on the same strip closes it. */
function openInsert(insert: Insert, trackId: number | null) {
    if (isEditing(insert, trackId)) closeDialog(PANELS[insert]);
    else void openDialog(PANELS[insert], { trackId });
}

// ---- Meters are written straight to the DOM; 60 fps through Vue would be wasteful.
const meterEls = new Map<number, HTMLElement>();
const meterLevels = new Map<number, number>();
let samples: Float32Array | null = null;

function setMeterRef(id: number, el: HTMLElement | null) {
    if (el) meterEls.set(id, el);
    else meterEls.delete(id);
}

function peakLevel(analyser: AnalyserNode): number {
    if (samples == null || samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (let i = 0; i < samples.length; i += 1) {
        const value = Math.abs(samples[i]);
        if (value > peak) peak = value;
    }
    // -48..0 dBFS mapped onto the meter height.
    return peak > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(peak) + 48) / 48)) : 0;
}

useAnimationLoop(isOpen, () => {
    for (const [id, el] of meterEls) {
        const analyser = id === MASTER ? audioGraph.masterAnalyser : audioGraph.busses[id]?.meterAnalyser();
        if (analyser == null) continue;
        const shown = Math.max(peakLevel(analyser), (meterLevels.get(id) ?? 0) - PEAK_FALL_PER_FRAME);
        meterLevels.set(id, shown);
        // Clipping (not scaling) keeps the green/amber/red zones at fixed levels.
        el.style.clipPath = `inset(${((1 - shown) * 100).toFixed(1)}% 0 0 0)`;
    }
});
</script>

<style scoped>
.tm {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: fit-content;
    min-width: 360px;
}

.tm-strip {
    --group-color: var(--strip-color);
    flex: 0 0 84px;
    width: 84px;
    border-top: 3px solid var(--strip-color);
}
/* the track being edited; border only: a raised background would dim the fader scale's contrast */
.tm-strip-current {
    border-color: var(--ap-border-strong);
    border-top-color: var(--strip-color);
}
.tm-strip-silent {
    opacity: 0.5;
}

.tm-master {
    --strip-color: var(--ap-accent);
    margin-left: 6px;
    border-color: var(--ap-border-strong);
}

.tm-head {
    gap: 4px;
}
.tm-icon {
    width: 22px;
    height: 22px;
    object-fit: contain;
}

.tm-inserts {
    display: flex;
    gap: 4px;
}
.tm-master-inserts {
    margin-top: 26px;
}
.tm-fx {
    min-width: 30px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid var(--ap-border);
    border-radius: 4px;
    background: var(--ap-inset);
    color: var(--ap-muted);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
}
.tm-fx:hover {
    border-color: var(--ap-border-strong);
    color: var(--ap-text);
}
.tm-fx:focus-visible {
    outline: 2px solid var(--ap-accent);
    outline-offset: 1px;
}
.tm-fx-on {
    border-color: color-mix(in srgb, var(--ap-accent) 60%, transparent);
    color: var(--ap-accent);
}
.tm-fx-open {
    background: var(--ap-accent);
    border-color: var(--ap-accent);
    color: var(--gray-950);
}
</style>
