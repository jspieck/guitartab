<template>
  <BaseModal :modal-id="MODALS.TIME_METER.id">
    <template #title>Time Meter</template>
    <div class="timeMeterSelectCapsule">
      <label class="labelTopMargin">Numerator</label>
      <div class="select">
        <select 
          :value="handler.getModalState().numerator"
          @change="(e) => handler.updateNumerator(Number((e.target as HTMLSelectElement).value))"
        >
          <option v-for="n in 31" :key="n" :value="n">{{ n }}</option>
        </select>
        <div class="select__arrow"></div>
      </div>
      <label class="labelTopMargin">Denominator</label>
      <div class="select timeMeterSelect">
        <select 
          :value="handler.getModalState().denominator"
          @change="(e) => handler.updateDenominator(Number((e.target as HTMLSelectElement).value))"
        >
          <option v-for="n in denominators" :key="n" :value="n">{{ n }}</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { TimeMeterModalHandler } from "../assets/js/modals/timeMeterModalHandler";
import SubmitButton from "./SubmitButton.vue";
import { modalManager } from "../assets/js/modals/modalManager";

const denominators = [1, 2, 4, 8, 16, 32];
const handler = modalManager.getHandler(MODALS.TIME_METER.id) as TimeMeterModalHandler;

function handleSubmit() {
  handler.handleSubmit();
  handler.closeModal();
}

onMounted(() => {
  handler.setTimeMeterState();
});
</script>

<style scoped>
.timeMeterSelectCapsule {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.select {
  position: relative;
  width: 100%;
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

.labelTopMargin {
  margin-top: 0.5rem;
}
</style>
