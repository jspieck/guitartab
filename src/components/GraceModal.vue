<template>
  <BaseModal :modal-id="MODALS.GRACE.id">
    <template #title>Grace</template>
    <div id="graceSelect">
      <label class="labelTopMargin">Fret</label>
      <input v-model="graceModalData.fret" type="number" />

      <label class="labelTopMargin">Note length</label>
      <div class="select">
        <select v-model="graceModalData.duration">
          <option value="e">Eighth</option>
          <option value="s">Sixteenth</option>
          <option value="t">Thirty-Second</option>
        </select>
        <div class="select__arrow"></div>
      </div>

      <label class="labelTopMargin">Time of grace</label>
      <div class="select">
        <select v-model="graceModalData.setOnBeat">
          <option value="before">Before the note</option>
          <option value="with">With the note</option>
        </select>
        <div class="select__arrow"></div>
      </div>

      <label class="labelTopMargin">Dynamic</label>
      <div class="select">
        <select v-model="graceModalData.dynamic">
          <option value="fff">fff</option>
          <option value="ff">ff</option>
          <option value="f">f</option>
          <option value="mf">mf</option>
          <option value="mp">mp</option>
          <option value="p">p</option>
          <option value="pp">pp</option>
          <option value="ppp">ppp</option>
        </select>
        <div class="select__arrow"></div>
      </div>

      <label class="labelTopMargin">Transition</label>
      <div class="select">
        <select v-model="graceModalData.transition">
          <option value="none">None</option>
          <option value="bending">Bending</option>
          <option value="slide">Slide</option>
          <option value="hammer">Hammer</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>

    <SubmitButton :submitInfo="onGraceSelectButtonClick" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import BaseModal from "./BaseModal.vue";
import { Note } from "../assets/js/songData";
import { Measure } from "../assets/js/songData";
import { GraceModalHandler } from "../assets/js/modals/graceModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";
import { MODALS } from "../assets/js/modals/modalTypes";

interface NoteSelection {
  notes: {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    string: number;
    note: Note;
  }[];
  blocks: number[];
  beats: {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    beat: Measure;
  }[];
}

const props = defineProps({
  arr: {
    type: Object as () => NoteSelection | null,
    required: true,
  },
});

const graceModalDataDefault = {
  fret: 0,
  duration: "s",
  dynamic: "f",
  transition: "none",
  setOnBeat: "before",
};

const graceModalData = ref({ ...graceModalDataDefault });

function handleArrChange(arr: NoteSelection) {
  const { note } = arr.notes[0];
  const handler = modalManager.getHandler<GraceModalHandler>('grace');
  
  // Update the handler's state
  handler.openModal({
    notes: arr.notes,
    blocks: arr.blocks,
    beats: arr.beats
  });

  // Update the local UI state
  setGraceState(note);
}

watchEffect(() => {
  if (props.arr) {
    handleArrChange(props.arr);
  }
});

const onGraceSelectButtonClick = () => {
  const handler = modalManager.getHandler<GraceModalHandler>('grace');
  if (handler) {
    // Update the handler's state with the current UI values
    handler.updateGraceData(graceModalData.value);
    handler.applyGrace();
    modalManager.closeModal(handler.modalId);
  }
};

function setGraceState(note: Note) {
  const grace = note.graceObj;
  if (grace != null) {
    graceModalData.value.fret = grace.fret;
    graceModalData.value.duration = grace.duration;
    graceModalData.value.dynamic = grace.dynamic;
    graceModalData.value.transition = grace.transition;
    graceModalData.value.setOnBeat = grace.setOnBeat;
  } else {
    graceModalData.value = { ...graceModalDataDefault };
  }
}
</script>
