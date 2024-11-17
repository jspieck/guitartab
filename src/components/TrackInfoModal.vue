<template>
  <BaseModal :modalId="MODALS.INFO.id">
    <template #title>Track Info</template>
    <label>Title:</label>
    <input v-model="infoData.title" />
    <label>Subtitle:</label>
    <input v-model="infoData.subtitle" />
    <label>Artist:</label>
    <input v-model="infoData.artist" />
    <label>Album:</label>
    <input v-model="infoData.album" />
    <label>Author:</label>
    <input v-model="infoData.author" />
    <label>Music:</label>
    <input v-model="infoData.music" />
    <label>Copyright:</label>
    <input v-model="infoData.copyright" />
    <label>Writer:</label>
    <input v-model="infoData.writer" />
    <label>Instructions:</label>
    <input v-model="infoData.instructions" />
    <label>Comments:</label>
    <textarea v-model="infoData.comments[0]"></textarea>
    <button 
      class="submitButton" 
      @click="submitInfo"
    >
      Submit
    </button>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import { modalManager } from "../assets/js/modals/modalManager";
import { InfoModalHandler } from "../assets/js/modals/infoModalHandler";
import { MODALS } from "../assets/js/modals/modalTypes";

const handler = modalManager.getHandler<InfoModalHandler>(MODALS.INFO.id);
const infoData = reactive(handler.getInfoData());

function submitInfo() {
    handler.submitInfo(infoData);
}
</script>
