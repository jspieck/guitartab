<template>
  <BaseModal :modal-id="MODALS.TIME_METER.id">
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
import { modalManager } from "../assets/js/modals/modalManager";
import { TimeMeterModalHandler } from "../assets/js/modals/timeMeterModalHandler";
import { MODALS } from "../assets/js/modals/modalTypes";

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

const handler = new TimeMeterModalHandler();

function onSelectButtonClick() {
  const success = handler.handleSubmit(numerator.value, denominator.value);
  if (success) {
    modalManager.closeModal("timeMeterModal");
  }
}

// Initialize state
// handler.openModal({ trackId: props.trackId, blockId: props.blockId, voiceId: props.voiceId });
</script>
