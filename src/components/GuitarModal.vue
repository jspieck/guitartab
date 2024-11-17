<template>
    <BaseModal :modal-id="MODALS.GUITAR.id">
        <template #title>Guitar</template>
        <div id="guitar" class="guitar">
            <ul ref="stringsList" class="strings">
                <li v-for="index in handler.numStrings.value" :key="'string-' + index" class="string"
                    :style="{ top: `${(index - 1) / (handler.numStrings.value - 1) * 100}%` }"></li>
            </ul>
            <ul id="stringsListBackTop" class="strings">
                <li v-for="index in handler.halfStrings.value" :key="'stringBackTop-' + index" class="string"
                    :style="{ top: `${((index - 1) / (handler.numStrings.value - 1)) * 100}%` }"></li>
            </ul>
            <ul id="stringsListBackBottom" class="strings">
                <li v-for="index in (handler.numStrings.value - handler.halfStrings.value)" :key="'stringBackBottom-' + (index + handler.halfStrings.value - 1)"
                    class="string" :style="{ top: `${((index + handler.halfStrings.value - 2) / (handler.numStrings.value - 1)) * 100}%` }"></li>
            </ul>
            <div class="guitar-neck">
                <div v-if="handler.capo.value > 0" class="capo" :style="{ right: `${handler.capoStyleRight}%` }"></div>
                <div class="fret first"></div>
                <div ref="fretContainer" class="frets">
                    <div v-for="index in handler.numFrets.value" :key="'fret-' + index" class="fret"
                        :style="{ left: `${(index) / (handler.numFrets.value + 1) * 100}%` }"></div>
                </div>
                <div class="fret last"></div>
                <ul ref="dots" class="dots">
                    <li v-for="position in handler.dotPositions.value" :key="'dot-' + position" class="dot"
                        :style="{ right: `${((position - 0.5) / (handler.numFrets.value + 1)) * 100}%` }"></li>
                </ul>
                <div ref="guitarMarkerContainer">
                    <div v-for="i in handler.numStrings.value" :key="'guitarNoteMarker-row-' + i">
                        <template v-for="j in handler.numFrets.value" :key="'guitarNoteMarker-' + i + '_' + j">
                            <div v-if="handler.isNoteMarkerVisible(i - 1, j - 1)" class="guitarNoteMarker"
                                :id="`gnm${(i as number) - 1}_${(j as number) - 1}`"
                                :style="{ right: `calc(${((j as number) / (handler.numFrets.value + 1)) * 100}% - 12px)`, top: `${(((i as number) - 1) / (handler.numStrings.value - 1)) * 100}%` }">
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </BaseModal>
</template>
  
<script setup lang="ts">
import { onUpdated, ref } from 'vue';
import interact from 'interactjs';
import BaseModal from './BaseModal.vue';
import { modalManager } from '../assets/js/modals/modalManager';
import { GuitarModalHandler } from '../assets/js/modals/guitarModalHandler';
import { MODALS } from '../assets/js/modals/modalTypes';

const handler = modalManager.getHandler<GuitarModalHandler>(MODALS.GUITAR.id);
const stringsList = ref<HTMLElement | null>(null);

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

defineExpose({
    numStrings: handler.numStrings,
    numFrets: handler.numFrets,
    markNoteOnGuitar: (string: number, fretWithCapo: number) => {
        const stringDom = stringsList.value?.children[string] as HTMLElement;
        handler.markNoteOnGuitar(string, fretWithCapo, stringDom);
    },
    unmarkNoteOnGuitar: (string: number, fretWithCapo: number) => {
        const stringDom = stringsList.value?.children[string] as HTMLElement;
        handler.unmarkNoteOnGuitar(string, fretWithCapo, stringDom);
    },
    setCapo: handler.setCapo.bind(handler)
})
</script>
