<template>
  <BaseModal id="infoModal">
    <template #title>Track Info</template>
    <label>Title:</label>
    <input v-model="infoModalData.title" />
    <label>Subtitle:</label>
    <input v-model="infoModalData.subtitle" />
    <label>Artist:</label>
    <input v-model="infoModalData.artist" />
    <label>Album:</label>
    <input v-model="infoModalData.album" />
    <label>Author:</label>
    <input v-model="infoModalData.author" />
    <label>Music:</label>
    <input v-model="infoModalData.music" />
    <label>Copyright:</label>
    <input v-model="infoModalData.copyright" />
    <label>Writer:</label>
    <input v-model="infoModalData.writer" />
    <label>Instructions:</label>
    <input v-model="infoModalData.instructions" />
    <label>Comments:</label>
    <textarea v-model="infoModalData.comments[0]"></textarea>
    <SubmitButton :submitInfo="submitInfo" />
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { ref, reactive } from "vue";
import modalHandler from "../assets/js/modalHandler";
import Song from "../assets/js/songData";

const infoModalData = reactive({
  title: "",
  subtitle: "",
  artist: "",
  album: "",
  author: "",
  music: "",
  copyright: "",
  writer: "",
  instructions: "",
  comments: [""],
  bound: false,
});

function submitInfo() {
  modalHandler.closeModal("trackInfoModal");
  if (infoModalData.title != null) {
    Song.songDescription.title = infoModalData.title;
  }
  if (infoModalData.subtitle != null) {
    Song.songDescription.subtitle = infoModalData.subtitle;
  }
  if (infoModalData.artist != null) {
    Song.songDescription.artist = infoModalData.artist;
  }
  if (infoModalData.album != null) {
    Song.songDescription.album = infoModalData.album;
  }
  if (infoModalData.author != null) {
    Song.songDescription.author = infoModalData.author;
  }
  if (infoModalData.music != null) {
    Song.songDescription.music = infoModalData.music;
  }
  if (infoModalData.copyright != null) {
    Song.songDescription.copyright = infoModalData.copyright;
  }
  if (infoModalData.writer != null) {
    Song.songDescription.writer = infoModalData.writer;
  }
  if (infoModalData.instructions != null) {
    Song.songDescription.instructions = infoModalData.instructions;
  }
  if (infoModalData.comments != null) {
    // eslint-disable-next-line prefer-destructuring
    Song.songDescription.comments[0] = infoModalData.comments[0];
  }

  document.getElementById("tabTitle")!.textContent = Song.songDescription.title;
  document.getElementById("tabAuthor")!.textContent =
    Song.songDescription.author;
}

// displayModal('trackInfoModal', 'Info');
</script>
