<template>
    <div>
        <div class="modalTopBar">
            <label class="modalTopBarLabel">Guitar</label>
            <div id="guitarModalClose" class="modal_close">
                <div class="icon">
                    <svg viewBox="0 0 32 32">
                        <use xlink:href="#close-icon"></use>
                    </svg>
                </div>
            </div>
        </div>
        <div class="modalBody">
            <div id="guitar" class="guitar">
                <ul id="stringsList" class="strings">
                    <li v-for="index in numStrings" :key="'string-' + index" class="string"
                        :style="{ top: `${(index - 1) / (numStrings - 1) * 100}%` }"></li>
                </ul>
                <!-- ... -->
                <div id="fretContainer" class="frets">
                    <div v-for="index in numFrets" :key="'fret-' + index" class="fret"
                        :style="{ left: `${(index) / (numFrets + 1) * 100}%` }"></div>
                </div>
                <!-- ... -->
                <ul id="dots" class="dots">
                    <li v-for="position in dotPositions" :key="'dot-' + position" class="dot"
                        :style="{ right: `${((position - 0.5) / (numFrets + 1)) * 100}%` }"></li>
                </ul>
                <!-- ... -->
                <div id="guitarMarkerContainer">
                    <div v-for="i in numStrings" :key="'guitarNoteMarker-row-' + i">
                        <div v-for="j in numFrets" :key="'guitarNoteMarker-' + i + '_' + j" class="guitarNoteMarker"
                            :id="`gnm${i - 1}_${j - 1}`"
                            :style="{ right: `calc(${((j) / (numFrets + 1)) * 100}% - 12px)`, top: `${((i - 1) / (numStrings - 1)) * 100}%` }">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
import { computed, ref } from 'vue';

// Set the props for numStrings and numFrets
const props = defineProps({
    numStrings: { type: Number, required: true },
    numFrets: { type: Number, required: true },
});

// Compute the dotPositions array
const dotPositions = ref([3, 5, 7, 9, 15, 17, 19, 21]);

</script>
  