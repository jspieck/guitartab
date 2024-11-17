<template>
  <BaseModal>
    <template #title>Tremolo Picking</template>
    <label>Choose note length</label>
    <div class="tremoloPickingSelect">
      <div class="select">
        <select id="tremoloPickingSelection">
          <option value="e">Eighth</option>
          <option value="s">Sixteenth</option>
          <option value="t">Thirty-Second</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton :submitInfo="onSelectButtonClick" />
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import BaseModal from "./BaseModal.vue";
import { TremoloPickingModalHandler } from "../assets/js/modals/tremoloPickingModalHandler";
import { Measure, Note } from "../assets/js/songData";

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

const handler = new TremoloPickingModalHandler();

function onSelectButtonClick() {
  handler.applyTremoloPicking();
}

onMounted(() => {
  /* handler.openModal({
    notes: props.notes as Note[],
    blocks: props.blocks as number[],
    beats: props.beats as { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Measure }[],
    isVariableSet: props.isVariableSet
  }); */
});
</script>

<style scoped>
.tremoloPickingSelect {
  margin: 1rem 0;
}
</style>
