<template>
    <BaseModal :modal-id="DIALOGS.GUITAR.id" resize="xy">
        <template #title>Guitar</template>
        <div id="guitar" class="guitar">
            <!-- Seen from the audience, as before: the nut on the right. -->
            <Fretboard :num-strings="numStrings" :capo="capo" :marks="marks" nut="right" />
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseModal from './BaseModal.vue';
import Fretboard from './Fretboard.vue';
import { DIALOGS } from '../services/dialogs/dialogs';
import { songState } from '../stores/songState';
import { soundingFrets } from '../stores/soundingNotesState';
import type { FretboardMark } from '../utils/fretboard';

const track = computed(() => songState.tracks[songState.currentTrackId]);
const numStrings = computed(() => Math.max(2, track.value?.strings.length ?? 6));
const capo = computed(() => track.value?.capo ?? 0);

// `SoundingNote.fret` already counts from the nut, capo included.
const marks = computed<FretboardMark[]>(() =>
    soundingFrets.value.map((note) => ({ string: note.string, neckFret: note.fret })));
</script>

<style scoped>
.guitar {
    width: 100%;
    height: 100%;
}
</style>
