<template>
    <BaseModal :modal-id="DIALOGS.MIXER.id" resize="x">
        <template #title>Mixer</template>
        <div class="ap-root mixer">
            <div class="ap-segmented mixer-views" role="tablist" aria-label="Mixer view">
                <button id="mixerTracksTab" type="button" role="tab" class="ap-btn" :aria-selected="view === 'tracks'"
                    aria-controls="mixerPanel" @click="setView('tracks')">Tracks</button>
                <button id="mixerDrumsTab" type="button" role="tab" class="ap-btn" :aria-selected="view === 'drums'"
                    aria-controls="mixerPanel" @click="setView('drums')">Drum kit</button>
            </div>
            <div id="mixerPanel" role="tabpanel" :aria-labelledby="view === 'tracks' ? 'mixerTracksTab' : 'mixerDrumsTab'">
                <TrackMixer v-if="view === 'tracks'" />
                <DrumKitMixer v-else />
            </div>
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
/**
 * The mixer: a channel strip per track plus the master ("Tracks"), and the drum pieces of the
 * kit ("Drum kit"). Opened from the sequencer and the footer; `{ view: 'drums' }` opens the kit.
 */
import { ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import TrackMixer from './audio/TrackMixer.vue';
import DrumKitMixer from './audio/DrumKitMixer.vue';
import './audio/audioPlugin.css';
import { DIALOGS } from '../services/dialogs/dialogs';
import { getDialogHandler } from '../services/dialogs/dialogHandlers';
import type { PlainModalHandler } from '../services/dialogs/baseModalHandler';

type MixerView = 'tracks' | 'drums';

const dialog = getDialogHandler<PlainModalHandler<{ view?: MixerView }>>(DIALOGS.MIXER.id);
const view = ref<MixerView>(dialog.params.value?.view ?? 'tracks');
watch(dialog.params, (params) => {
    if (params?.view) view.value = params.view;
});

function setView(next: MixerView) {
    view.value = next;
}
</script>

<style scoped>
.mixer-views {
    align-self: flex-start;
}
.mixer-views .ap-btn[aria-selected='true'] {
    background: var(--ap-panel-raised);
    border-color: var(--ap-border-strong);
    color: var(--ap-text);
}
</style>
