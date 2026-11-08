<template>
    <BaseModal :modal-id="DIALOGS.PIANO.id" resize="x">
        <template #title>Piano</template>
        <template #title-actions>
            <button type="button" class="dockButton" @click="dock" v-hint="'Show the keyboard under the tab instead'">Dock under the tab</button>
        </template>
        <div id="piano" class="pianoHost">
            <PianoKeyboard :pressed="soundingPitches" list-id="pianoList" />
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue';
import PianoKeyboard from './PianoKeyboard.vue';
import { DIALOGS, closeDialog } from '../services/dialogs/dialogs'
import { soundingPitches } from '../stores/soundingNotesState';
import { setDockInstrument } from '../stores/practiceDockState';
import { vHint } from '../composables/vHint';

function dock() {
    setDockInstrument('piano');
    closeDialog(DIALOGS.PIANO);
}
</script>

<style scoped>
.pianoHost {
    width: 100%;
    height: 100%;
}
</style>
