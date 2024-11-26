<template>
  <BaseModal :modalId="MODALS.INFO.id">
    <template #title>Track Info</template>
      <div>
        <div class="grid grid-cols-2 gap-2">
          <div v-for="field in fields" :key="field.name" :class="field.fullWidth ? 'col-span-2' : ''">
            <label :for="field.name" class="block text-sm font-medium text-gray-700 mb-1">
              {{ field.label }}
            </label>
            <input
              v-if="field.type !== 'textarea'"
              :id="field.name"
              v-model="infoData[field.name as keyof typeof infoData]"
              :type="field.type"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <textarea
              v-else
              :id="field.name"
              v-model="infoData[field.name as keyof typeof infoData]"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            ></textarea>
          </div>
      </div>
  </div>
    <SubmitButton @submitInfo="submitInfo" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import BaseModal from "./BaseModal.vue";
import { modalManager } from "../assets/js/modals/modalManager";
import { InfoModalHandler } from "../assets/js/modals/infoModalHandler";
import { MODALS } from "../assets/js/modals/modalTypes";
import SubmitButton from "./SubmitButton.vue";

const handler = modalManager.getHandler<InfoModalHandler>(MODALS.INFO.id);
const infoData = reactive(handler.getInfoData());

const fields = [
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
