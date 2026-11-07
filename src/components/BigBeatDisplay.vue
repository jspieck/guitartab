<template>
  <div v-if="visible" class="big-beat" :class="{ 'big-beat--count-in': beatClockState.countIn, 'big-beat--one': beatClockState.beat === 1 }" aria-hidden="true">
    <div class="big-beat__label">{{ label }}</div>
    <div class="big-beat__number">{{ beatClockState.beat }}</div>
    <div class="big-beat__dots">
      <span
        v-for="beat in beatClockState.beats"
        :key="beat"
        class="big-beat__dot"
        :class="{ 'big-beat__dot--on': beat <= beatClockState.beat }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { beatClockState } from '../stores/beatClockState'
import { practiceState } from '../stores/practiceState'
import Settings from '../stores/settingsState'

// A visual aid only: screen readers would hear a number every beat.
const visible = computed(() => practiceState.bigBeat && Settings.songPlaying && beatClockState.beat > 0)
const label = computed(() => (beatClockState.countIn ? 'Count-in' : `Bar ${beatClockState.blockId + 1}`))
</script>

<style scoped>
.big-beat {
  position: fixed;
  top: 96px;
  right: 24px;
  z-index: 40;
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 132px;
  padding: 10px 16px 14px;
  border-radius: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md, none);
  pointer-events: none;
}

.big-beat__label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.big-beat__number {
  font-size: 88px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.big-beat--one .big-beat__number {
  color: var(--color-accent);
}

.big-beat--count-in .big-beat__number {
  color: var(--color-warning);
}

.big-beat__dots {
  display: flex;
  gap: 6px;
}

.big-beat__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-border);
}

.big-beat__dot--on {
  background: var(--color-accent);
}

@media (max-width: 899px) {
  .big-beat {
    top: auto;
    bottom: 120px;
    right: 12px;
    min-width: 96px;
  }

  .big-beat__number {
    font-size: 64px;
  }
}
</style>
