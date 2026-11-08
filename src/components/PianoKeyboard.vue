<template>
    <div class="piano">
        <ul :id="listId">
            <li v-for="key in keys" :key="key.pitch">
                <div class="key" :class="classesOf(key.pitch)"
                    :data-pitch="key.pitch" @mousedown="press(key.pitch)"></div>
                <div v-if="key.hasUpperKey" class="upper-key" :class="classesOf(key.pitch + 1)"
                    :data-pitch="key.pitch + 1" @mousedown="press(key.pitch + 1)"></div>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import liveInput from '../services/midi/liveInput';

/**
 * The piano keys of the Piano dialog and the practice dock (Big win 28): `pressed` keys light
 * up, `ahead` keys (the next beats, nearest first) are ringed fainter the further away they
 * are. A click sounds the key through the live input until the mouse is let go.
 */
const props = withDefaults(defineProps<{
    pressed: ReadonlySet<number>
    ahead?: readonly ReadonlySet<number>[]
    listId?: string
}>(), { ahead: () => [], listId: undefined });

const WHITE_KEYS = 56;

// Key numbers are MIDI pitches, starting at C; E and B have no black key above them.
const keys: { pitch: number; hasUpperKey: boolean }[] = [];
for (let i = 0, pitch = 0; i < WHITE_KEYS; i += 1) {
    const hasUpperKey = i % 7 !== 2 && i % 7 !== 6;
    keys.push({ pitch, hasUpperKey });
    pitch += hasUpperKey ? 2 : 1;
}

function classesOf(pitch: number) {
    if (props.pressed.has(pitch)) return 'activeKey';
    const step = props.ahead.findIndex((set) => set.has(pitch));
    return step >= 0 ? `aheadKey aheadKey${step + 1}` : '';
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
