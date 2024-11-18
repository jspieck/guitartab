<template>
  <BaseModal :modalId="MODALS.ADD_TRACK.id">
    <template #title>New Instrument</template>
    <div class="instrumentContainer">
      <div
        v-for="(group, i) in instrumentGroups"
        :key="i"
        class="instrument-group"
      >
        <button 
          class="group-header"
          @click="toggleGroup(i)"
          :class="{ 'active': openGroups[i] }"
        >
          <span>{{ group.title }}</span>
          <svg 
            class="arrow-icon"
            :class="{ 'rotated': openGroups[i] }"
            viewBox="0 0 24 24"
          >
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <TransitionGroup name="list">
          <div 
            v-if="openGroups[i]"
            class="instrument-list"
            key="list"
          >
            <button
              v-for="choice in group.choices"
              :key="choice"
              class="instrument-choice"
              @click="selectInstrument(choice)"
            >
              <img 
                class="instrument-icon" 
                :src="instrumentList[choice][0]" 
                :alt="instrumentList[choice][1]"
              />
              <span class="instrument-name">{{ instrumentList[choice][1] }}</span>
            </button>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseModal from "./BaseModal.vue";
import { instrumentList } from "../assets/js/instrumentData";
import { modalManager } from "../assets/js/modals/modalManager";
import { AddTrackModalHandler } from "../assets/js/modals/addTrackModalHandler";
import { MODALS } from "../assets/js/modals/modalTypes";

const handler = modalManager.getHandler<AddTrackModalHandler>(MODALS.ADD_TRACK.id);
const instrumentGroups = handler.getInstrumentGroups();
const openGroups = ref<boolean[]>(new Array(instrumentGroups.length).fill(false));

const toggleGroup = (index: number) => {
  openGroups.value[index] = !openGroups.value[index];
};

const selectInstrument = (choice: string) => {
  handler.selectInstrument(choice);
};
</script>

<style scoped>
.instrumentContainer {
  max-height: 70vh;
  overflow-y: auto;
  padding: 1rem;
}

.instrument-group {
  margin-bottom: 0.5rem;
}

.group-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.group-header:hover {
  background: #eeeeee;
}

.group-header.active {
  background: #e0e0e0;
}

.arrow-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.2s;
  fill: currentColor;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.instrument-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.instrument-choice {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  border: none;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.instrument-choice:hover {
  background: #f5f5f5;
}

.instrument-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.instrument-name {
  font-size: 0.9rem;
}

/* Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
