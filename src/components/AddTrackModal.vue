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
          type="button"
          class="group-header"
          @click="toggleGroup(i)"
          :class="{ 'active': openGroups[i] }"
        >
          <span class="group-title">{{ group.title }}</span>
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
              type="button"
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
  display: grid;
  gap: 0.5rem;
  max-height: min(66vh, 560px);
  overflow-y: auto;
  padding: 0.125rem;
}

.instrument-group {
  display: grid;
  gap: 0.5rem;
}

.group-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  background: linear-gradient(180deg, var(--modal-card-bg) 0%, var(--modal-card-subtle) 100%);
  color: var(--modal-text-strong);
  border: 1px solid var(--modal-card-border);
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: transform 0.2s, border-color 0.2s, background-color 0.2s;
}

.group-header:hover {
  background: linear-gradient(180deg, var(--modal-card-hover) 0%, var(--modal-card-bg) 100%);
  transform: translateY(-1px);
}

.group-header.active {
  border-color: var(--modal-accent);
  background: linear-gradient(180deg, var(--modal-card-hover) 0%, var(--modal-card-subtle) 100%);
}

.group-title {
  min-width: 0;
  text-align: left;
}

.arrow-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  transition: transform 0.2s;
  fill: currentColor;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.instrument-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0;
}

.instrument-choice {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--modal-card-border);
  background: linear-gradient(180deg, var(--modal-card-bg) 0%, var(--modal-card-subtle) 100%);
  color: var(--modal-text-strong);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.2s, border-color 0.2s, background-color 0.2s;
}

.instrument-choice:hover {
  transform: translateY(-1px);
  border-color: var(--modal-accent);
  background: linear-gradient(180deg, var(--modal-card-hover) 0%, var(--modal-card-bg) 100%);
}

.instrument-icon {
  width: 28px;
  height: 28px;
  padding: 0.35rem;
  border-radius: 10px;
  background: var(--modal-card-hover);
  object-fit: contain;
}

.instrument-name {
  min-width: 0;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.25;
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
