<template>
  <div class="practice-controls" @keydown.esc="trainerOpen = false">
    <label class="practice-controls__speed" data-tooltip="Playback speed">
      <span class="practice-controls__sr">Playback speed</span>
      <select id="playbackSpeed" :value="practiceState.playbackRate" @change="onSpeedChange">
        <option v-for="rate in speedOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
      </select>
    </label>

    <button
      id="metronomeToggle"
      type="button"
      class="practice-controls__toggle"
      :class="{ active: practiceState.metronome }"
      :aria-pressed="practiceState.metronome"
      aria-label="Metronome"
      data-tooltip="Metronome"
      @click="practiceState.metronome = !practiceState.metronome"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 3h6l4 18H5z" />
        <path d="M12 16l5-9" stroke-linecap="round" />
      </svg>
    </button>

    <button
      id="countInToggle"
      type="button"
      class="practice-controls__toggle practice-controls__toggle--text"
      :class="{ active: practiceState.countIn }"
      :aria-pressed="practiceState.countIn"
      aria-label="Count-in"
      data-tooltip="Count-in (one bar)"
      @click="practiceState.countIn = !practiceState.countIn"
    >
      1·2·3·4
    </button>

    <div ref="trainerRef" class="practice-controls__trainer">
      <button
        id="speedTrainerToggle"
        type="button"
        class="practice-controls__toggle"
        :class="{ active: practiceState.trainer }"
        :aria-expanded="trainerOpen"
        aria-label="Speed trainer"
        data-tooltip="Speed trainer"
        @click="toggleTrainer"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 18l6-6 4 4 6-8" />
          <path d="M15 8h5v5" />
        </svg>
      </button>
      <!-- The toolbar clips its overflow, so the popover is rendered at the end of <body>. -->
      <Teleport to="body">
        <div
          v-if="trainerOpen"
          class="practice-controls__popover"
          role="dialog"
          aria-label="Speed trainer"
          :style="popoverStyle"
          @keydown.esc="trainerOpen = false"
        >
          <label class="practice-controls__row practice-controls__row--check">
            <input id="speedTrainerEnabled" v-model="practiceState.trainer" type="checkbox" />
            Speed up after every loop pass
          </label>
          <label class="practice-controls__row">
            Step
            <select id="speedTrainerStep" v-model.number="practiceState.trainerStep">
              <option v-for="step in stepOptions" :key="step" :value="step">+{{ formatPercent(step) }}</option>
            </select>
          </label>
          <label class="practice-controls__row">
            Up to
            <select id="speedTrainerTarget" v-model.number="practiceState.trainerTarget">
              <option v-for="rate in targetOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
            </select>
          </label>
          <p class="practice-controls__hint">
            Select a range of measures to loop. Start below the target speed, e.g. at 70 %.
          </p>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { practiceState, setPlaybackRate } from '../stores/practiceState'

const BASE_SPEEDS = [0.25, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.1, 1.25, 1.5]

const trainerOpen = ref(false)
const trainerRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const stepOptions = [0.02, 0.05, 0.1]
const targetOptions = [0.8, 0.9, 1, 1.1, 1.25, 1.5]

// The trainer can produce speeds between the presets; keep the current one selectable.
const speedOptions = computed(() => [...new Set([...BASE_SPEEDS, practiceState.playbackRate])].sort((a, b) => a - b))

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)} %`
}

function toggleTrainer(): void {
  if (!trainerOpen.value) {
    const rect = trainerRef.value?.getBoundingClientRect()
    popoverStyle.value = rect ? { top: `${rect.bottom + 6}px`, left: `${Math.max(8, rect.right - 250)}px` } : {}
  }
  trainerOpen.value = !trainerOpen.value
}

function onSpeedChange(event: Event): void {
  setPlaybackRate(Number((event.target as HTMLSelectElement).value))
}
</script>

<style scoped>
.practice-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  font-size: 12px;
}

.practice-controls__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.practice-controls__speed select {
  height: 22px;
  padding: 0 2px;
  border: 1px solid var(--color-border-strong);
  border-radius: 4px;
  background: var(--color-field);
  color: var(--color-text);
  font-size: 12px;
}

.practice-controls__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 24px;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.practice-controls__toggle--text {
  font-size: 11px;
  letter-spacing: 0.5px;
}

.practice-controls__toggle:hover {
  background: var(--color-active);
}

.practice-controls__toggle.active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.practice-controls__toggle:focus-visible,
.practice-controls__speed select:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.practice-controls__trainer {
  position: relative;
}

.practice-controls__popover {
  position: fixed;
  z-index: 1000;
  width: 250px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-inverse);
  color: var(--color-inverse-text);
  line-height: 1.4;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-shadow) 20%, transparent);
}

.practice-controls__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0;
}

.practice-controls__row--check {
  justify-content: flex-start;
  white-space: nowrap;
}

.practice-controls__hint {
  margin: 6px 0 0;
  color: var(--color-inverse-muted);
  font-size: 11px;
}
</style>
