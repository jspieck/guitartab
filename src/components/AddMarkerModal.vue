<template>
  <BaseModal :modal-id="MODALS.MARKER.id">
    <template #title>Add Marker</template>
    <div class="strokeSelect">
      <label class="labelTopMargin">Title:</label>
      <input 
        v-model="handler.getModalState().markerData.text"
        @input="(e) => handler.updateMarkerText((e.target as HTMLInputElement).value)"
        type="text"
        placeholder="Enter marker title"
      />
      <label class="labelTopMargin">Color:</label>
      <div ref="colorPickerRef" class="color-picker"></div>
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { MarkerModalHandler } from "../assets/js/modals/markerModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";
import Picker from 'vanilla-picker';

const handler = modalManager.getHandler(MODALS.MARKER.id) as MarkerModalHandler;
const colorPickerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (colorPickerRef.value) {
    const { color } = handler.getModalState().markerData;
    const picker = new Picker({
      parent: colorPickerRef.value,
      color: `rgb(${color.red},${color.green},${color.blue})`,
      popup: false
    });

    picker.onChange = (color: {rgba: number[]}) => {
      handler.updateMarkerColor({
        red: color.rgba[0],
        green: color.rgba[1],
        blue: color.rgba[2]
      });
    };
  }
});

const handleSubmit = () => {
  handler.applyMarker();
  handler.closeModal();
};
</script>

<style scoped>
.strokeSelect {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.labelTopMargin {
  margin-top: 0.5rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

.color-picker {
  width: 100%;
}
</style>
