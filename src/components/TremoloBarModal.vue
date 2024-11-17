<template>
  <BaseModal>
    <template #title>Tremolo Bar</template>
    <div class="tremoloEditorContainer">
      <svg id="tremoloEditor" width="100%" height="300"></svg>
      <div class="select tremoloSelect">
        <select id="tremoloSelection">
          <option value="0">Dive</option>
          <option value="1">Dip</option>
          <option value="2">Release Up</option>
          <option value="3">Inverted Dip</option>
          <option value="4">Return</option>
          <option value="5">Release Down</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton :submitInfo="onSelectButtonClick" />
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import { TremoloBarModalHandler } from "../assets/js/modals/tremoloBarModalHandler";
import { Note, Measure } from "../assets/js/songData";

const props = defineProps({
  notes: {
    type: Array,
    required: true
  },
  blocks: {
    type: Array,
    required: true
  },
  beats: {
    type: Array,
    required: true
  },
  isVariableSet: {
    type: Boolean,
    required: true
  }
});

const handler = new TremoloBarModalHandler();

function onSelectButtonClick() {
  handler.applyTremoloChanges();
}

onMounted(() => {
  /* handler.openModal({
    notes: props.notes as { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[],
    blocks: props.blocks as number[],
    beats: props.beats as { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Measure }[],
    isVariableSet: props.isVariableSet
  }); */
});
</script>

<style scoped>
.tremoloEditorContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.tremoloSelect {
  width: 200px;
}
</style>
