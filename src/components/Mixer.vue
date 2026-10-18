<template>
    <BaseModal :modal-id="MODALS.MIXER.id">
        <template #title>Drum Mixer</template>
        <div class="ap-root mx">
            <div class="ap-toolbar">
                <div class="ap-segmented" role="group" aria-label="Which drum pieces to show">
                    <button type="button" class="ap-btn" :aria-pressed="view === 'song'" @click="view = 'song'">
                        In this song <span class="mx-count">{{ usedNotes.size }}</span>
                    </button>
                    <button type="button" class="ap-btn" :aria-pressed="view === 'kit'" @click="view = 'kit'">
                        Full kit <span class="mx-count">{{ strips.length }}</span>
                    </button>
                </div>
                <span class="ap-toolbar-spacer"></span>
                <span v-if="soloCount > 0" class="mx-solo-note">{{ soloCount }} soloed</span>
                <button type="button" class="ap-btn" :disabled="!hasChanges" @click="resetAll">Reset all</button>
            </div>

            <div v-if="visibleStrips.length === 0" class="mx-empty ap-card">
                <p>This song has no drum notes yet.</p>
                <button type="button" class="ap-btn" @click="view = 'kit'">Show the full kit</button>
            </div>

            <div v-else class="mx-strips" :style="{ maxWidth: `${maxStripsWidth}px` }">
                <section v-for="strip in visibleStrips" :key="strip.note" class="mx-strip ap-card"
                    :class="[`mx-group-${strip.group}`, { 'mx-strip-silent': !isAudible(strip) }]"
                    :aria-label="strip.name">
                    <header class="mx-strip-head" :title="`${strip.name} (MIDI note ${strip.note})`">
                        <span class="mx-strip-name">{{ strip.name }}</span>
                        <span class="mx-strip-note ap-num"><i class="mx-swatch" aria-hidden="true"></i>{{ strip.note }}</span>
                    </header>
                    <div class="mx-buttons">
                        <button type="button" class="mx-btn mx-btn-mute" :aria-pressed="strip.muted"
                            :aria-label="`Mute ${strip.name}`" title="Mute" @click="setMuted(strip, !strip.muted)">M</button>
                        <button type="button" class="mx-btn mx-btn-solo" :aria-pressed="strip.soloed"
                            :aria-label="`Solo ${strip.name}`" title="Solo" @click="setSoloed(strip, !strip.soloed)">S</button>
                    </div>
                    <RotaryKnob :model-value="strip.pan" :min="-1" :max="1" bipolar :default-value="0" :size="34"
                        :aria-label="`${strip.name} pan`" :format="formatPan" @update:model-value="setPan(strip, $event)" />
                    <div class="mx-fader-row">
                        <div class="mx-meter" aria-hidden="true">
                            <div class="mx-meter-fill" :ref="(el: unknown) => setMeterRef(strip.note, el as HTMLElement | null)"></div>
                        </div>
                        <VerticalFader :model-value="strip.volume" :default-value="strip.defaultVolume" :height="150"
                            :aria-label="`${strip.name} volume`" @update:model-value="setVolume(strip, $event)" />
                    </div>
                    <span class="mx-db ap-num">{{ formatGainDb(strip.volume) }} dB</span>
                </section>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import RotaryKnob from './audio/RotaryKnob.vue';
import VerticalFader from './audio/VerticalFader.vue';
import './audio/audioPlugin.css';
import audioEngine from '../assets/js/audioEngine';
import { MODALS } from '../assets/js/modals/modalTypes';
import { modalManager } from '../assets/js/modals/modalManager';
import { formatGainDb, getUsedDrumNotes } from '../services/drumMixer';
import { useAnimationLoop, useModalOpen } from '../composables/useModalOpen';

type DrumGroup = 'kick' | 'snare' | 'tom' | 'hat' | 'cymbal' | 'perc';

interface DrumStrip {
    note: number;
    name: string;
    group: DrumGroup;
    volume: number;
    defaultVolume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
}

const FIRST_DRUM_NOTE = 35;
const STRIP_WIDTH = 74;
const PEAK_FALL_PER_FRAME = 0.025;

function groupOf(name: string): DrumGroup {
    if (/kick/i.test(name)) return 'kick';
    if (/snare|clap|stick/i.test(name)) return 'snare';
    if (/tom/i.test(name)) return 'tom';
    if (/hi-hat/i.test(name)) return 'hat';
    if (/crash|ride|cymbal|splash/i.test(name)) return 'cymbal';
    return 'perc';
}

// Captured when the panel chunk loads, before the user can change anything.
const strips = reactive<DrumStrip[]>(Array.from(audioEngine.noteToDrum.entries()).map(([note, info]) => ({
    note,
    name: info[0],
    group: groupOf(info[0]),
    volume: info[2],
    defaultVolume: info[2],
    pan: info[3],
    muted: info[4] === false,
    soloed: audioEngine.drumSolo.has(note),
})));

const view = ref<'song' | 'kit'>('song');
const usedNotes = ref<Set<number>>(new Set());
const isOpen = useModalOpen(MODALS.MIXER.id);

const visibleStrips = computed(() => (view.value === 'kit'
    ? strips
    : strips.filter((strip) => usedNotes.value.has(strip.note))));
const soloCount = computed(() => strips.filter((strip) => strip.soloed).length);
const hasChanges = computed(() => strips.some((strip) => strip.muted || strip.soloed
    || strip.pan !== 0 || Math.abs(strip.volume - strip.defaultVolume) > 1e-4));
const maxStripsWidth = computed(() => Math.min(window.innerWidth - 80, 13 * (STRIP_WIDTH + 6)));

watch(isOpen, (open) => {
    if (!open) return;
    // A loaded .gt file may have replaced the drum settings since the last visit.
    for (const strip of strips) {
        const info = drumInfo(strip);
        strip.volume = info[2];
        strip.pan = info[3];
        strip.muted = info[4] === false;
    }
    usedNotes.value = getUsedDrumNotes();
    if (usedNotes.value.size === 0 && view.value === 'song') view.value = 'kit';
}, { immediate: true });

// The modal is centred for its size when opened; switching views can make it wider.
watch([isOpen, () => visibleStrips.value.length], ([open]) => {
    if (open) void nextTick(() => modalManager.keepInViewport(MODALS.MIXER.id));
});

function drumBus(strip: DrumStrip) {
    return audioEngine.drumBusses[strip.note - FIRST_DRUM_NOTE];
}

function drumInfo(strip: DrumStrip) {
    return audioEngine.noteToDrum.get(strip.note)!;
}

function isAudible(strip: DrumStrip): boolean {
    return soloCount.value > 0 ? strip.soloed : !strip.muted;
}

function setVolume(strip: DrumStrip, volume: number) {
    strip.volume = volume;
    drumInfo(strip)[2] = volume;
    const bus = drumBus(strip);
    if (bus) bus.volume.gain.setTargetAtTime(volume, audioEngine.context.currentTime, 0.01);
}

function setPan(strip: DrumStrip, pan: number) {
    strip.pan = Math.abs(pan) < 0.02 ? 0 : pan;
    drumInfo(strip)[3] = strip.pan;
    const bus = drumBus(strip);
    if (bus) bus.pan.pan.setTargetAtTime(strip.pan, audioEngine.context.currentTime, 0.01);
}

function setMuted(strip: DrumStrip, muted: boolean) {
    strip.muted = muted;
    drumInfo(strip)[4] = !muted;
}

function setSoloed(strip: DrumStrip, soloed: boolean) {
    strip.soloed = soloed;
    if (soloed) audioEngine.drumSolo.add(strip.note);
    else audioEngine.drumSolo.delete(strip.note);
}

function resetAll() {
    for (const strip of strips) {
        setVolume(strip, strip.defaultVolume);
        setPan(strip, 0);
        setMuted(strip, false);
        setSoloed(strip, false);
    }
}

function formatPan(pan: number): string {
    if (Math.abs(pan) < 0.02) return 'C';
    return `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`;
}

// ---- Meters are written straight to the DOM; 60 fps through Vue would be wasteful.
const meterEls = new Map<number, HTMLElement>();
const meterLevels = new Map<number, number>();
let samples: Float32Array | null = null;

function setMeterRef(note: number, el: HTMLElement | null) {
    if (el) meterEls.set(note, el);
    else meterEls.delete(note);
}

useAnimationLoop(isOpen, () => {
    for (const [note, el] of meterEls) {
        const bus = audioEngine.drumBusses[note - FIRST_DRUM_NOTE];
        if (bus == null) continue;
        const analyser = bus.analyser;
        if (samples == null || samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        for (let i = 0; i < samples.length; i += 1) {
            const value = Math.abs(samples[i]);
            if (value > peak) peak = value;
        }
        // -48..0 dBFS mapped onto the meter height.
        const level = peak > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(peak) + 48) / 48)) : 0;
        const shown = Math.max(level, (meterLevels.get(note) ?? 0) - PEAK_FALL_PER_FRAME);
        meterLevels.set(note, shown);
        // Clipping (not scaling) keeps the green/amber/red zones at fixed levels.
        el.style.clipPath = `inset(${((1 - shown) * 100).toFixed(1)}% 0 0 0)`;
    }
});
</script>

<style scoped>
.mx {
    width: fit-content;
    min-width: 360px;
}

.mx-count {
    padding: 0 5px;
    border-radius: 999px;
    background: var(--ap-inset);
    color: var(--ap-muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
}

.mx-solo-note {
    color: var(--ap-amber);
    font-size: 11px;
    font-weight: 600;
}

.ap-btn:disabled {
    opacity: 0.45;
    cursor: default;
}

.mx-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 28px 16px;
    color: var(--ap-muted);
}
.mx-empty p {
    margin: 0;
}

.mx-strips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
    scrollbar-color: var(--ap-border-strong) transparent;
}

.mx-strip {
    --group-color: #8a93a3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 0 0 74px;
    width: 74px;
    padding: 0 0 8px;
    overflow: hidden;
    transition: opacity 0.15s ease;
}
.mx-group-kick { --group-color: #ff8a65; }
.mx-group-snare { --group-color: #ffd54f; }
.mx-group-tom { --group-color: #81c784; }
.mx-group-hat { --group-color: #4dd0e1; }
.mx-group-cymbal { --group-color: #64b5f6; }
.mx-group-perc { --group-color: #b388ff; }

.mx-strip-silent {
    opacity: 0.5;
}

.mx-strip-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 100%;
    padding: 6px 4px 0;
    box-sizing: border-box;
    text-align: center;
}
.mx-strip-name {
    display: -webkit-box;
    width: 100%;
    min-height: 26px;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    color: var(--ap-text);
    font-size: 11px;
    font-weight: 600;
    line-height: 13px;
}
.mx-strip-note {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ap-faint);
    font-size: 9px;
}
.mx-swatch {
    width: 6px;
    height: 6px;
    border-radius: 1px;
    background: var(--group-color);
}

.mx-buttons {
    display: flex;
    gap: 4px;
}
.mx-btn {
    width: 24px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--ap-border);
    border-radius: 4px;
    background: var(--ap-inset);
    color: var(--ap-muted);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
}
.mx-btn:hover {
    border-color: var(--ap-border-strong);
    color: var(--ap-text);
}
.mx-btn:focus-visible {
    outline: 2px solid var(--ap-accent);
    outline-offset: 1px;
}
.mx-btn-mute[aria-pressed='true'] {
    background: var(--ap-red);
    border-color: var(--ap-red);
    color: #1a0d0d;
}
.mx-btn-solo[aria-pressed='true'] {
    background: var(--ap-amber);
    border-color: var(--ap-amber);
    color: #1d1505;
}

.mx-fader-row {
    display: flex;
    gap: 4px;
    align-items: stretch;
}

.mx-meter {
    position: relative;
    width: 5px;
    margin: 11px 0;
    border-radius: 2px;
    background: var(--ap-inset);
    overflow: hidden;
}
.mx-meter-fill {
    position: absolute;
    inset: 0;
    clip-path: inset(100% 0 0 0);
    background: linear-gradient(to top, #3fbf7f 0%, #3fbf7f 62%, #f2b84b 85%, #f06c6c 100%);
}

.mx-db {
    color: var(--ap-text);
    font-size: 11px;
    font-weight: 600;
}
</style>
