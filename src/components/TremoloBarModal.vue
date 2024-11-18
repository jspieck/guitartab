<template>
  <BaseModal :modal-id="MODALS.TREMOLO_BAR.id">
    <template #title>Tremolo Bar</template>
    <div class="tremoloEditorContainer">
      <svg 
        ref="tremoloEditorRef" 
        width="300" 
        height="300"
        @mousedown="handleMouseDown"
      ></svg>
      <div class="select tremoloSelect">
        <select 
          v-model="selectedPreset"
          @change="(e) => handler.applyTremoloPreset(Number((e.target as HTMLSelectElement).value))"
        >
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
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { TremoloBarModalHandler } from "../assets/js/modals/tremoloBarModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const tremoloEditorRef = ref<SVGElement | null>(null);
const selectedPreset = ref("0");
const handler = modalManager.getHandler(MODALS.TREMOLO_BAR.id) as TremoloBarModalHandler;

const handleMouseDown = (e: MouseEvent) => {
  handler.handleMouseDown(e, tremoloEditorRef.value!);
};

const handleSubmit = () => {
  handler.applyTremoloChanges();
  handler.closeModal();
};

onMounted(() => {
  if (tremoloEditorRef.value) {
    handler.initializeTremoloEditor(tremoloEditorRef.value);
  }
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
  position: relative;
  width: 200px;
}

.select select {
  width: 100%;
  padding: 0.5rem;
  cursor: pointer;
  appearance: none;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.select__arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #333;
  pointer-events: none;
}
</style>
