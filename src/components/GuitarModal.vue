<template>
    <BaseModal>
        <template #title>Guitar</template>
        <div id="guitar" class="guitar">
            <ul ref="stringsList" class="strings">
                <li v-for="index in numStrings" :key="'string-' + index" class="string"
                    :style="{ top: `${(index - 1) / (numStrings - 1) * 100}%` }"></li>
            </ul>
            <ul id="stringsListBackTop" class="strings">
                <li v-for="index in halfStrings" :key="'stringBackTop-' + index" class="string"
                    :style="{ top: `${((index - 1) / (numStrings - 1)) * 100}%` }"></li>
            </ul>
            <ul id="stringsListBackBottom" class="strings">
                <li v-for="index in (numStrings - halfStrings)" :key="'stringBackBottom-' + (index + halfStrings - 1)"
                    class="string" :style="{ top: `${((index + halfStrings - 2) / (numStrings - 1)) * 100}%` }"></li>
            </ul>
            <div class="guitar-neck">
                <div v-if="capo > 0" class="capo" :style="{ right: `${capoStyleRight}%` }"></div>
                <div class="fret first"></div>
                <div ref="fretContainer" class="frets">
                    <div v-for="index in numFrets" :key="'fret-' + index" class="fret"
                        :style="{ left: `${(index) / (numFrets + 1) * 100}%` }"></div>
                </div>
                <div class="fret last"></div>
                <ul ref="dots" class="dots">
                    <li v-for="position in dotPositions" :key="'dot-' + position" class="dot"
                        :style="{ right: `${((position - 0.5) / (numFrets + 1)) * 100}%` }"></li>
                </ul>
                <div ref="guitarMarkerContainer">
                    <div v-for="i in numStrings" :key="'guitarNoteMarker-row-' + i">
                        <template v-for="j in numFrets" :key="'guitarNoteMarker-' + i + '_' + j">
                            <div v-if="isNoteMarkerVisible(i - 1, j - 1)" class="guitarNoteMarker"
                                :id="`gnm${(i as number) - 1}_${(j as number) - 1}`"
                                :style="{ right: `calc(${((j as number) / (numFrets + 1)) * 100}% - 12px)`, top: `${(((i as number) - 1) / (numStrings - 1)) * 100}%` }">
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </BaseModal>
</template>
  
<script setup lang="ts">
import { Ref, ref, computed, onUpdated } from 'vue';
import Song from '../assets/js/songData';
import interact from 'interactjs';
import BaseModal from './BaseModal.vue';

const numStrings: Ref<number> = ref(6);
const numFrets: Ref<number> = ref(25);

const dotPositions = ref([3, 5, 7, 9, 15, 17, 19, 21]);

const stringsList = ref(null);
const fretContainer = ref(null);
const dots = ref(null);
const guitarMarkerContainer = ref(null);
const halfStrings = computed(() => Math.ceil(numStrings.value / 2));
const capo: Ref<number> = ref(0);

onUpdated(() => {
    interact('#guitar').resizable({
        preserveAspectRatio: false,
        edges: {
            left: false, right: false, bottom: false, top: true,
        },
    }).on('resizemove', (event) => {
        const { target } = event;
        target.style.width = `${event.rect.width}px`;
        target.style.height = `${event.rect.height}px`;
    });
});

const capoStyleRight = computed(() => {
    const fretPercentage = (capo.value - 1) / (numFrets.value + 1) * 100;
    return capo.value > 0 ? fretPercentage - 1.3 : 0;
});

function setCapo(newCapo: number) {
    capo.value = newCapo;
}

const noteMarkersVisibility = ref(Array.from({ length: numStrings.value }, () => Array.from({ length: numFrets.value }, () => true)));

function isNoteMarkerVisible(string: number, fret: number) {
    return noteMarkersVisibility.value[string][fret];
}

function markNoteOnGuitar(string: number, fretWithCapo: number) {
    const { capo } = Song.tracks[Song.currentTrackId];
    if (fretWithCapo !== capo) {
        noteMarkersVisibility.value[string][fretWithCapo - 1] = true;
    }
    const stringDom = (stringsList.value! as HTMLElement).children[string];
    if (stringDom != null) {
        (stringDom as HTMLElement).style.borderBottom = '3px solid #cfbf89';
    }
}

function unmarkNoteOnGuitar(string: number, fretWithCapo: number) {
    noteMarkersVisibility.value[string][fretWithCapo - 1] = false;
    const stringDom = (stringsList.value! as HTMLElement).children[string];
    if (stringDom != null) {
        (stringDom as HTMLElement).style.borderBottom = '2px solid #958963';
    }
}


defineExpose({
    numStrings,
    numFrets,
    markNoteOnGuitar,
    unmarkNoteOnGuitar,
    setCapo
})
</script>
