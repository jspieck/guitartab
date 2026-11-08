<template>
    <section id="practiceDock" class="practiceDock" :class="`practiceDock--${practiceDockState.instrument}`"
        aria-label="Fretboard and keyboard">
        <div class="practiceDock__bar">
            <div class="practiceDock__switch" role="radiogroup" aria-label="Instrument">
                <button v-for="option in INSTRUMENTS" :key="option.value" type="button" role="radio"
                    :aria-checked="practiceDockState.instrument === option.value"
                    :class="{ 'is-on': practiceDockState.instrument === option.value }"
                    @click="setDockInstrument(option.value)">{{ option.label }}</button>
            </div>
            <label class="practiceDock__ahead">
                <span>Show next</span>
                <select v-model.number="practiceDockState.ahead" aria-label="Next beats shown">
                    <option :value="0">no beats</option>
                    <option :value="1">1 beat</option>
                    <option :value="2">2 beats</option>
                </select>
            </label>
            <span class="practiceDock__legend" aria-hidden="true">
                <span class="practiceDock__dot"></span> now
                <template v-if="practiceDockState.ahead > 0"><span class="practiceDock__ring"></span> next</template>
            </span>
            <button type="button" class="practiceDock__close" aria-label="Hide the fretboard and keyboard"
                v-hint="'Hide (Practice options bring it back)'" @click="setDockInstrument('off')">
                <AppIcon name="close" :size="12" />
            </button>
        </div>
        <div v-if="practiceDockState.instrument === 'guitar'" class="practiceDock__neck">
            <Fretboard :num-strings="numStrings" :capo="capo" :marks="fretMarks" />
        </div>
        <div v-else class="practiceDock__keys">
            <PianoKeyboard :pressed="pressedPitches" :ahead="aheadPitches" list-id="practiceDockKeys" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import Fretboard from '../Fretboard.vue';
import PianoKeyboard from '../PianoKeyboard.vue';
import { vHint } from '../../composables/vHint';
import { songState } from '../../stores/songState';
import { selectionState } from '../../stores/selectionState';
import { playbackTransportState } from '../../stores/playbackTransportState';
import { playbackLoopState } from '../../stores/playbackLoopState';
import { soundingNotes } from '../../stores/soundingNotesState';
import { barVersion } from '../../stores/renderVersionState';
import { practiceDockState, setDockInstrument, type DockInstrument } from '../../stores/practiceDockState';
import { currentLoopInterval } from '../../services/editor/rangeSelection';
import { beatNotes, upcomingBeats, type BeatPosition, type DockNote, type DockSong } from '../../services/practiceDock';
import type { FretboardMark } from '../../utils/fretboard';

/**
 * The fretboard or keyboard under the tab (Big win 28): the notes sounding now (playback,
 * MIDI keyboard, piano clicks) or, when stopped, the beat at the cursor; and the next one or
 * two beats as fading rings, on the strings the tab puts them on.
 */
const INSTRUMENTS: { value: DockInstrument; label: string }[] = [
    { value: 'guitar', label: 'Guitar' },
    { value: 'piano', label: 'Piano' },
];

const trackId = computed(() => songState.currentTrackId);
const track = computed(() => songState.tracks[trackId.value]);
const numStrings = computed(() => Math.max(2, track.value?.strings.length ?? 6));
const capo = computed(() => track.value?.capo ?? 0);

const song = computed<DockSong>(() => ({
    measures: songState.measures[trackId.value] ?? [],
    strings: track.value?.strings ?? [],
    capo: capo.value,
}));

/** Where the dock reads from: the beat playing, or the cursor's beat when stopped. */
const position = computed<BeatPosition>(() => playbackTransportState.isPlaying
    ? { blockId: playbackTransportState.blockId, beatId: playbackTransportState.beatId }
    : { blockId: selectionState.cursor.blockId, beatId: selectionState.cursor.beatId });

/** The notes now: what playback sounds, else the cursor's beat; plus live notes either way. */
const nowNotes = computed<DockNote[]>(() => {
    const live = Object.values(soundingNotes.live)
        .filter((note) => note.string >= 0)
        .map((note) => ({ string: note.string, neckFret: note.fret, pitch: note.pitch }));
    if (playbackTransportState.isPlaying) {
        const playing = soundingNotes.playback
            .filter((note) => note != null)
            .map((note) => ({ string: note!.string, neckFret: note!.fret, pitch: note!.pitch }));
        return [...playing, ...live];
    }
    void barVersion(trackId.value, position.value.blockId);
    return [...beatNotes(song.value, songState.currentVoiceId, position.value), ...live];
});

const ahead = computed(() => {
    if (practiceDockState.ahead <= 0) return [];
    void playbackLoopState.active;
    const beats = upcomingBeats(song.value, songState.currentVoiceId, position.value, practiceDockState.ahead,
        currentLoopInterval());
    // edits to those bars show at once
    beats.forEach((beat) => void barVersion(trackId.value, beat.position.blockId));
    return beats.map((beat) => beat.notes);
});

const fretMarks = computed<FretboardMark[]>(() => [
    ...nowNotes.value.map((note) => ({ string: note.string, neckFret: note.neckFret })),
    ...ahead.value.flatMap((notes, index) => notes.map((note) => ({ string: note.string, neckFret: note.neckFret, ahead: index + 1 }))),
]);

const pressedPitches = computed(() => new Set([
    ...nowNotes.value.map((note) => note.pitch),
    // live notes without a string (piano clicks) light up on the keys
    ...Object.values(soundingNotes.live).map((note) => note.pitch),
]));
const aheadPitches = computed(() => ahead.value.map((notes) => new Set(notes.map((note) => note.pitch))));
</script>

<style scoped>
.practiceDock {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-raised);
    border-top: 1px solid var(--color-border);
}

.practiceDock__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 3px 8px;
    font-size: 12px;
    color: var(--color-text-muted);
}

.practiceDock__switch {
    display: inline-flex;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
}

.practiceDock__switch button {
    font: inherit;
    padding: 2px 10px;
    border: 0;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
}

.practiceDock__switch button.is-on {
    background: var(--color-accent);
    color: var(--color-on-accent);
}

.practiceDock__ahead {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.practiceDock__ahead select {
    font: inherit;
    padding: 1px 4px;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
}

.practiceDock__legend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.practiceDock__dot,
.practiceDock__ring {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--red-300);
}

.practiceDock__ring {
    margin-left: 6px;
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--red-300);
}

.practiceDock--piano .practiceDock__dot {
    background: var(--amber-400);
}

.practiceDock--piano .practiceDock__ring {
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--amber-500);
}

.practiceDock__close {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
}

.practiceDock__close:hover {
    background: var(--color-hover);
}

.practiceDock__neck {
    height: 120px;
}

.practiceDock__keys {
    height: 84px;
    overflow-x: auto;
    overflow-y: hidden;
}

.practiceDock__keys :deep(.piano) {
    min-width: 1064px;
}

.practiceDock__keys :deep(.piano ul) {
    margin: 0;
    padding: 0;
    height: 84px;
}

/* Phones: a lower neck, the keys scroll sideways */
.layout-compact .practiceDock__neck {
    height: 96px;
}

.layout-compact .practiceDock__legend {
    display: none;
}
</style>
