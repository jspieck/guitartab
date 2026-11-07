<template>
  <div class="practice-controls" @keydown.esc="trainerOpen = false">
    <label class="practice-controls__speed" data-tip="Playback speed">
      <span class="practice-controls__sr">Playback speed</span>
      <select id="playbackSpeed" class="tb-pill" :value="practiceState.playbackRate" @change="onSpeedChange">
        <option v-for="rate in speedOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
      </select>
    </label>

    <button
      id="metronomeToggle"
      type="button"
      class="tb-button"
      :class="{ 'is-pressed': practiceState.metronome }"
      :aria-pressed="practiceState.metronome"
      aria-label="Metronome"
      data-tip="Metronome"
      @click="practiceState.metronome = !practiceState.metronome"
    >
      <AppIcon name="metronome" />
    </button>

    <!-- On a narrow toolbar count-in and trainer fold into the menu behind the chevron. -->
    <div v-if="!folded" ref="trainerRef" class="practice-controls__extras" data-fold="practiceExtras">
      <button
        id="countInToggle"
        type="button"
        class="tb-button tb-button--text practice-controls__count-in"
        :class="{ 'is-pressed': practiceState.countIn }"
        :aria-pressed="practiceState.countIn"
        aria-label="Count-in 1·2·3·4"
        data-tip="Count-in (one bar)"
        @click="practiceState.countIn = !practiceState.countIn"
      >
        1·2·3·4
      </button>
      <button
        id="speedTrainerToggle"
        type="button"
        class="tb-button"
        :class="{ 'is-pressed': practiceState.trainer }"
        :aria-expanded="trainerOpen"
        aria-label="Speed trainer"
        data-tip="Speed trainer"
        @click="toggleTrainer"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 18l6-6 4 4 6-8" />
          <path d="M15 8h5v5" />
        </svg>
      </button>
    </div>
    <button
      v-else
      id="practiceMenuButton"
      ref="trainerRef"
      type="button"
      class="tb-button"
      :class="{ 'is-pressed': practiceState.countIn || practiceState.trainer || practiceState.bigBeat }"
      :aria-expanded="trainerOpen"
      aria-label="Count-in and speed trainer"
      data-tip="Count-in and speed trainer"
      data-fold-menu
      @click="toggleTrainer"
    >
      <AppIcon name="chevron-down" :size="16" />
    </button>
    <!-- The toolbar clips its overflow, so the popover is rendered at the end of <body>. -->
    <Teleport to="body">
      <div
        v-if="trainerOpen"
        ref="popoverRef"
        class="practice-controls__popover"
        role="dialog"
        aria-label="Speed trainer"
        :style="popoverStyle"
        @keydown.esc="trainerOpen = false"
      >
        <label v-if="folded" class="practice-controls__row practice-controls__row--check">
          <input id="countInEnabled" v-model="practiceState.countIn" type="checkbox" />
          Count-in (one bar before playing)
        </label>
        <label class="practice-controls__row practice-controls__row--check">
          <input id="bigBeatEnabled" v-model="practiceState.bigBeat" type="checkbox" />
          Big beat counter (also counts in)
        </label>
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
          Select a range of measures to loop, or click a marker in the sequencer to loop its
          section. Start below the target speed, e.g. at 70 %. Speed and loop are remembered per song.
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { practiceState, setPlaybackRate } from '../stores/practiceState'
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{ folded?: boolean }>(), { folded: false })

const BASE_SPEEDS = [0.25, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.1, 1.25, 1.5]

const trainerOpen = ref(false)
const trainerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
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

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (trainerOpen.value && !trainerRef.value?.contains(target) && !popoverRef.value?.contains(target)) {
    trainerOpen.value = false
  }
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style scoped>
.practice-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.practice-controls__extras {
  display: flex;
  align-items: center;
  gap: 2px;
}

.practice-controls__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.practice-controls__speed {
  margin-right: 2px;
}

.practice-controls__count-in {
  width: auto;
  padding: 0 6px;
  font-size: var(--text-sm);
  letter-spacing: 0.5px;
}

.practice-controls__popover {
  position: fixed;
  z-index: 1000;
  width: 260px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: var(--text-md);
  line-height: 1.4;
  box-shadow: var(--shadow-popover);
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
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
</style>
