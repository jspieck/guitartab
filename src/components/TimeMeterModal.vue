<template>
  <BaseModal>
    <template #title>Time Meter</template>
    <div class="timeMeterSelectCapsule">
      <label class="labelTopMargin">Numerator</label>
      <div class="select">
        <select v-model="numerator">
          <option v-for="n in 31" :key="n" :value="n">{{ n }}</option>
        </select>
        <div class="select__arrow"></div>
      </div>
      <label class="labelTopMargin">Denominator</label>
      <div class="select timeMeterSelect">
        <select v-model="denominator">
          <option v-for="n in denominators" :key="n" :value="n">{{ n }}</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton :submitInfo="onSelectButtonClick" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseModal from "./BaseModal.vue";
import Song from "../assets/js/songData";
import modalHandler from "../assets/js/modalHandler";
import AppManager from "../assets/js/appManager";
import { revertHandler } from "../assets/js/revertHandler";
import { tab } from "../assets/js/tab";

const numerator = ref(4);
const denominator = ref(4);
const denominators = [1, 2, 4, 8, 16, 32];

const props = defineProps({
  trackId: {
    type: Number,
    required: true,
  },
  blockId: {
    type: Number,
    required: true,
  },
  voiceId: {
    type: Number,
    required: true,
  },
});

function onSelectButtonClick() {
  const blockId = props.blockId;
  Song.measureMeta[blockId].timeMeterPresent = true;
  modalHandler.closeModal("timeMeterModal");
  // TODO arrays
  const numeratorBefore = Song.measureMeta[blockId].numerator;
  const denominatorBefore = Song.measureMeta[blockId].denominator;

  Song.measureMeta[blockId].numerator = numerator.value;
  Song.measureMeta[blockId].denominator = denominator.value;

  const notesBefore = AppManager.checkAndAdaptTimeMeter(blockId);
  if (notesBefore == null) {
    Song.measureMeta[blockId].numerator = numeratorBefore;
    Song.measureMeta[blockId].denominator = denominatorBefore;
    Song.measureMeta[blockId].timeMeterPresent = false;
    return;
  }
  // Set until the end of track/ next timeMeter
  for (let bId = blockId + 1; bId < Song.measureMeta.length; bId += 1) {
    if (Song.measureMeta[bId].timeMeterPresent) break;
    Song.measureMeta[bId].numerator = Song.measureMeta[blockId].numerator;
    Song.measureMeta[bId].denominator = Song.measureMeta[blockId].denominator;
  }

  const { numerator, denominator } = Song.measureMeta[blockId];
  revertHandler.addTimeMeter(
    props.trackId,
    blockId,
    props.voiceId,
    numeratorBefore,
    numerator,
    denominatorBefore,
    denominator,
    false,
    true,
    notesBefore
  );

  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
}

function setTimeMeterState(blockId: number) {
  if (Song.measureMeta[blockId].denominator != null) {
    denominator.value = Song.measureMeta[blockId].denominator;
  }
  if (Song.measureMeta[blockId].numerator != null) {
    numerator.value = Song.measureMeta[blockId].numerator;
  }
}

setTimeMeterState(props.blockId);
</script>
