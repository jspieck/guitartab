<template>
  <BaseModal :modalId="MODALS.INFO.id">
    <template #title>Track Info</template>
      <div class="modal-stack">
        <div class="modal-section">
          <div class="modal-field-grid two-column">
            <div v-for="field in fields" :key="field.name" :class="['modal-field', { 'field-span-two': field.fullWidth }]">
              <label :for="field.name">
                {{ field.label }}
              </label>
              <input
                v-if="field.type !== 'textarea'"
                :id="field.name"
                v-model="infoData[field.name]"
                :type="field.type"
              />
              <textarea
                v-else
                :id="field.name"
                v-model="infoData[field.name]"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-submit-row">
          <SubmitButton @submitInfo="submitInfo" />
        </div>
      </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import BaseModal from "./BaseModal.vue";
import { modalManager } from "../services/dialogs/modalManager";
import { InfoModalHandler } from "../services/dialogs/infoModalHandler";
import { MODALS } from "../services/dialogs/modalTypes";
import SubmitButton from "./SubmitButton.vue";

const handler = modalManager.getHandler<InfoModalHandler>(MODALS.INFO.id);
const infoData = reactive(handler.getInfoData());

type InfoFieldName = keyof typeof infoData;
type InfoField = {
  name: InfoFieldName;
  label: string;
  type: 'text' | 'textarea';
  fullWidth?: boolean;
};

const fields: InfoField[] = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'subtitle', label: 'Subtitle', type: 'text' },
  { name: 'artist', label: 'Artist', type: 'text' },
  { name: 'album', label: 'Album', type: 'text' },
  { name: 'author', label: 'Author', type: 'text' },
  { name: 'music', label: 'Music', type: 'text' },
  { name: 'copyright', label: 'Copyright', type: 'text' },
  { name: 'writer', label: 'Writer', type: 'text' },
  { name: 'instructions', label: 'Instructions', type: 'text', fullWidth: true },
  { name: 'comments', label: 'Comments', type: 'textarea', fullWidth: true },
];

function submitInfo() {
    handler.submitInfo(infoData);
}
</script>

<style scoped>
.field-span-two {
  grid-column: 1 / -1;
}
</style>
