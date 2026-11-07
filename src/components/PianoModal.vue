<template>
    <BaseModal :modal-id="DIALOGS.PIANO.id" resize="x">
        <template #title>Piano</template>
        <div id="piano" class="piano">
            <ul id="pianoList">
                <li v-for="key in keys" :key="key.pitch">
                    <div class="key" :class="{ activeKey: soundingPitches.has(key.pitch) }"
                        :data-pitch="key.pitch" @mousedown="press(key.pitch)"></div>
                    <div v-if="key.hasUpperKey" class="upper-key"
                        :class="{ activeKey: soundingPitches.has(key.pitch + 1) }"
                        :data-pitch="key.pitch + 1" @mousedown="press(key.pitch + 1)"></div>
                </li>
            </ul>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import BaseModal from './BaseModal.vue';
import { DIALOGS } from '../services/dialogs/dialogs'
import liveInput from '../services/midi/liveInput';
import { soundingPitches } from '../stores/soundingNotesState';

const WHITE_KEYS = 56;

// Key numbers are MIDI pitches, starting at C; E and B have no black key above them.
const keys: { pitch: number; hasUpperKey: boolean }[] = [];
for (let i = 0, pitch = 0; i < WHITE_KEYS; i += 1) {
    const hasUpperKey = i % 7 !== 2 && i % 7 !== 6;
    keys.push({ pitch, hasUpperKey });
    pitch += hasUpperKey ? 2 : 1;
}

let held = -1;

function release() {
    if (held !== -1) liveInput.noteOff(held);
    held = -1;
}

function press(pitch: number) {
    release();
    held = pitch;
    liveInput.noteOn(pitch, 80);
    // The key sounds until the mouse is let go anywhere.
    window.addEventListener('mouseup', release, { once: true });
}

onBeforeUnmount(release);
</script>
