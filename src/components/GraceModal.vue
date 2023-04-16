<template>
  <BaseModal>
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
import { revertHandler } from "../assets/js/revertHandler";
import classicalNotation from "../assets/js/vexflowClassical";
import { svgDrawer } from "../assets/js/svgDrawer";
import { modalHandler } from "../assets/js/modalHandler";
import EventBus from "../assets/js/eventBus";

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

/* let graceModalData = {
      duration: 'e',
      setOnBeat: 'before',
      dynamic: 'mf',
      transition: '',
      fret: -1,
      bound: false,
      string: 0,
      height: 0,
      dead: false,
    }; */

let gracePresentBefore: { [n: string]: boolean } = {};

function handleArrChange(arr: NoteSelection) {
  const { note } = arr.notes[0];
  gracePresentBefore = {};
  for (const no of arr.notes) {
    const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
    gracePresentBefore[noteStr] = no.note.gracePresent;
  }
  setGraceState(note);
  modalHandler.displayModal("addGraceModal", "Grace");
}

watchEffect(() => {
  if (props.arr) {
    // Whenever the 'arr' prop changes, this function will be called
    handleArrChange(props.arr);
  }
});

const graceModalDataDefault = {
  fret: 0,
  duration: "s",
  dynamic: "f",
  transition: "none",
  setOnBeat: "before",
};

const graceModalData = ref({ ...graceModalDataDefault });

const onGraceSelectButtonClick = () => {
  modalHandler.closeModal("addGraceModal");
  if (!props.arr) return null;

  for (const no of props.arr.notes) {
    const noteInArr = no.note;
    const graceObjBefore = noteInArr.graceObj;

    const graceObj = {
      ...graceModalData.value,
      string: 0,
      height: 0,
      dead: false,
    };
    noteInArr.graceObj = graceObj;

    if (!noteInArr.gracePresent) {
      noteInArr.gracePresent = true;
      EventBus.emit("menu.activateEffectsForNote", noteInArr)
    }

    const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
    revertHandler.addGrace(
      no.trackId,
      no.blockId,
      no.voiceId,
      no.beatId,
      no.string,
      // TODO turned undefined grace into noteInArr.grace. Is that correct?
      graceObjBefore,
      noteInArr.graceObj,
      gracePresentBefore[noteStr],
      noteInArr.gracePresent
    );
  }
  const { trackId } = props.arr.notes[0];
  const { voiceId } = props.arr.notes[0];
  classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
  svgDrawer.rerenderBlocks(trackId, props.arr.blocks, voiceId);
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
