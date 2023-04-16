<template>
  <BaseModal>
    <template #title>Drum Info</template>
    <div id="drumInfo">
      <div
        v-for="(drumInfo, key) in audioEngine.noteToDrum"
        :key="key"
        @click="placeNote(key)"
      >
        <span>{{ drumInfo[0] }}</span>
        <!-- <span class="sp2">{{ audioEngine.noteToDrum[key][5] }}</span> -->
        <span class="sp3">{{ key }}</span>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import audioEngine from "../assets/js/audioEngine";
import AppManager from "../assets/js/appManager";
import { tab } from "../assets/js/tab";

const {
  trackId, blockId, voiceId, beatId, string,
} = tab.markedNoteObj;

const placeNote = (key: number) => {
  AppManager.placeNote(trackId, blockId, voiceId, beatId, string, key);
};
</script>
