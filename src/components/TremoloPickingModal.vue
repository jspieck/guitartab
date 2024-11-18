<template>
  <BaseModal :modal-id="MODALS.TREMOLO_PICKING.id">
    <template #title>Tremolo Picking</template>
    <div class="tremolo-picking-select">
      <label>Choose note length:</label>
      <div class="select">
        <select 
          :value="handler.getModalState().tremoloPickingLength"
          @change="(e) => handler.updateTremoloPickingLength((e.target as HTMLSelectElement).value)"
        >
          <option value="e">Eighth</option>
          <option value="s">Sixteenth</option>
          <option value="t">Thirty-Second</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { TremoloPickingModalHandler } from "../assets/js/modals/tremoloPickingModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const handler = modalManager.getHandler(MODALS.TREMOLO_PICKING.id) as TremoloPickingModalHandler;

const handleSubmit = () => {
  handler.applyTremoloPicking();
  handler.closeModal();
};
</script>

<style scoped>
.tremolo-picking-select {
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
</style>
