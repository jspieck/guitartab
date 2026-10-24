<template>
    <BaseModal :modal-id="MODALS.GUITAR.id">
        <template #title>Guitar</template>
        <div id="guitar" ref="guitar" class="guitar">
            <ul class="strings">
                <li v-for="string in numStrings" :key="string" class="string"
                    :class="{ stringAnim: soundingStrings.has(string - 1) }"
                    :style="{ top: stringTop(string - 1) }"></li>
            </ul>
            <div class="guitar-neck">
                <div v-if="capo > 0" class="capo" :style="{ right: `${fretRight(capo - 0.5)}%` }"></div>
                <div class="fret first"></div>
                <div class="frets">
                    <div v-for="fret in NUM_FRETS" :key="fret" class="fret"
                        :style="{ left: `${(fret / (NUM_FRETS + 1)) * 100}%` }"></div>
                </div>
                <div class="fret last"></div>
                <ul class="dots">
                    <li v-for="position in DOT_POSITIONS" :key="position" class="dot"
                        :style="{ right: `${fretRight(position - 0.5)}%` }"></li>
                </ul>
                <div id="guitarMarkerContainer">
                    <!-- Open strings only light up the string. -->
                    <div v-for="note in frettedNotes" :key="`${note.string}_${note.fret}`" class="guitarNoteMarker visible"
                        :data-string="note.string" :data-fret="note.fret"
                        :style="{ right: `calc(${fretRight(note.fret)}% - 12px)`, top: stringTop(note.string) }"></div>
                </div>
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import interact from 'interactjs';
import BaseModal from './BaseModal.vue';
import { MODALS } from '../services/dialogs/modalTypes';
import { songState } from '../stores/songState';
import { soundingFrets } from '../stores/soundingNotesState';
import { stringLine } from '../utils/tabStrings';

const NUM_FRETS = 25;
const DOT_POSITIONS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

const track = computed(() => songState.tracks[songState.currentTrackId]);
const numStrings = computed(() => Math.max(2, track.value?.strings.length ?? 6));
const capo = computed(() => track.value?.capo ?? 0);

const frettedNotes = computed(() => soundingFrets.value.filter((note) => note.fret > 0 && note.fret <= NUM_FRETS));
const soundingStrings = computed(() => new Set(soundingFrets.value.map((note) => note.string)));

/** Like the tab: highest string on top. */
function stringTop(string: number): string {
    return `${(stringLine(string, numStrings.value) / (numStrings.value - 1)) * 100}%`;
}

/** Distance of a fret position from the right end of the neck, in percent. */
function fretRight(fret: number): number {
    return (fret / (NUM_FRETS + 1)) * 100;
}

const guitar = ref<HTMLElement | null>(null);
onMounted(() => {
    if (guitar.value == null) return;
    interact(guitar.value).resizable({
        preserveAspectRatio: false,
        edges: { left: false, right: false, bottom: false, top: true },
    }).on('resizemove', (event) => {
        const { target } = event;
        target.style.width = `${event.rect.width}px`;
        target.style.height = `${event.rect.height}px`;
    });
});
onBeforeUnmount(() => {
    if (guitar.value != null) interact(guitar.value).unset();
});
</script>
