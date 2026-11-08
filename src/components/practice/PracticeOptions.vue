<template>
  <div class="practice-options">
    <template v-if="transport">
      <label class="practice-options__row">
        Speed
        <select id="practiceSheetSpeed" :value="practiceState.playbackRate" @change="onSpeedChange">
          <option v-for="rate in speedOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
        </select>
      </label>
      <label class="practice-options__row practice-options__row--check">
        <input id="practiceSheetMetronome" v-model="practiceState.metronome" type="checkbox" />
        Metronome
      </label>
    </template>
    <label v-if="countIn" class="practice-options__row practice-options__row--check">
      <input id="countInEnabled" v-model="practiceState.countIn" type="checkbox" />
      Count-in (one bar before playing)
    </label>
    <label class="practice-options__row practice-options__row--check">
      <input id="bigBeatEnabled" v-model="practiceState.bigBeat" type="checkbox" />
      Big beat counter (also counts in)
    </label>

    <fieldset class="practice-options__group">
      <legend>Speed trainer</legend>
      <label class="practice-options__row practice-options__row--check">
        <input id="speedTrainerEnabled" v-model="practiceState.trainer" type="checkbox" />
        Speed up after every loop pass
      </label>
      <label class="practice-options__row">
        Step
        <select id="speedTrainerStep" v-model.number="practiceState.trainerStep">
          <option v-for="step in stepOptions" :key="step" :value="step">+{{ formatPercent(step) }}</option>
        </select>
      </label>
      <label class="practice-options__row">
        Up to
        <select id="speedTrainerTarget" v-model.number="practiceState.trainerTarget">
          <option v-for="rate in targetOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
        </select>
      </label>
      <label class="practice-options__row">
        A section starts at
        <select id="speedTrainerStart" v-model.number="practiceState.trainerStart">
          <option v-for="rate in startOptions" :key="rate" :value="rate">{{ formatPercent(rate) }}</option>
        </select>
      </label>
      <p v-if="sectionSpeeds.length" id="sectionSpeeds" class="practice-options__hint">
        Reached: <span v-for="(section, index) in sectionSpeeds" :key="section.startBlock">{{ index ? ', ' : '' }}{{ section.text }} {{ formatPercent(section.rate) }}</span>
      </p>
    </fieldset>

    <fieldset class="practice-options__group">
      <legend>Loop</legend>
      <div class="practice-options__row practice-options__loop">
        <label for="loopFromBar">Bars</label>
        <input id="loopFromBar" v-model.number="fromBar" type="number" min="1" :max="barCount" inputmode="numeric" aria-label="Loop from bar" />
        <span aria-hidden="true">to</span>
        <input id="loopToBar" v-model.number="toBar" type="number" min="1" :max="barCount" inputmode="numeric" aria-label="Loop to bar" />
        <button id="loopBarsApply" type="button" @click="applyLoop">Loop</button>
        <button v-if="playbackLoopState.active" id="loopBarsClear" type="button" @click="clearRange">Off</button>
      </div>
    </fieldset>

    <label class="practice-options__row">
      Under the tab
      <select id="practiceDockSelect" v-model="practiceDockState.instrument">
        <option value="off">Nothing</option>
        <option value="guitar">Fretboard</option>
        <option value="piano">Keyboard</option>
      </select>
    </label>

    <p class="practice-options__hint">
      Drag a range of beats on the tab, or click a marker in the sequencer, to loop it; drag the
      A and B handles to move the loop's ends. With the trainer on, each section starts at its
      own speed and climbs from there. Speed and loop are remembered per song.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { practiceState, setPlaybackRate } from '../../stores/practiceState'
import { practiceDockState } from '../../stores/practiceDockState'
import { playbackLoopState } from '../../stores/playbackLoopState'
import { sectionPracticeState } from '../../stores/sectionPracticeState'
import { songState } from '../../stores/songState'
import { clearRange } from '../../services/editor/rangeSelection'
import { loopBars } from '../../services/sectionLoops'
import { sectionAt } from '../../utils/markerSections'

/**
 * The practice options: count-in, big beat counter, speed trainer (with a start speed per
 * section, Big win 28), the loop by bar numbers and the fretboard/keyboard under the tab.
 * In the toolbar's practice popover; on phones a sheet with speed and metronome as well.
 */
withDefaults(defineProps<{ transport?: boolean; countIn?: boolean }>(), { transport: false, countIn: true })

const BASE_SPEEDS = [0.25, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.1, 1.25, 1.5]
const stepOptions = [0.02, 0.05, 0.1]
const targetOptions = [0.8, 0.9, 1, 1.1, 1.25, 1.5]
const startOptions = [0.5, 0.6, 0.7, 0.8, 0.9]

const speedOptions = computed(() => [...new Set([...BASE_SPEEDS, practiceState.playbackRate])].sort((a, b) => a - b))

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)} %`
}

function onSpeedChange(event: Event): void {
  setPlaybackRate(Number((event.target as HTMLSelectElement).value))
}

const barCount = computed(() => songState.measureMeta.length)

// the fields start at the current loop (or bar 1 to 4)
const fromBar = ref(1)
const toBar = ref(4)
watch(
  () => [playbackLoopState.active, playbackLoopState.startBlock, playbackLoopState.endBlock] as const,
  ([active, start, end]) => {
    if (!active) return
    fromBar.value = start + 1
    toBar.value = end + 1
  },
  { immediate: true },
)

function applyLoop(): void {
  if (!Number.isFinite(fromBar.value) || !Number.isFinite(toBar.value)) return
  loopBars(fromBar.value - 1, toBar.value - 1)
}

const sectionSpeeds = computed(() =>
  Object.entries(sectionPracticeState.rates)
    .map(([start, rate]) => {
      const section = sectionAt(songState.measureMeta, Number(start))
      return { startBlock: Number(start), rate, text: section?.text ?? `Bar ${Number(start) + 1}` }
    })
    .sort((a, b) => a.startBlock - b.startBlock),
)
</script>

<style scoped>
.practice-options__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0;
}

.practice-options__row--check {
  justify-content: flex-start;
  white-space: nowrap;
}

.practice-options__group {
  margin: 8px 0 4px;
  padding: 0;
  border: 0;
}

.practice-options__group legend {
  padding: 0;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.practice-options__loop {
  justify-content: flex-start;
}

.practice-options__loop input {
  width: 4.2em;
}

.practice-options__loop button {
  font: inherit;
  padding: 1px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.practice-options__hint {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
</style>
