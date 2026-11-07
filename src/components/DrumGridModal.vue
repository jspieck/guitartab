<template>
  <BaseModal :modal-id="DIALOGS.DRUM_GRID.id" resize="x">
    <template #title>Step grid</template>
    <div class="drum-grid">
      <p v-if="drumMap == null" class="drum-grid-hint">Select a drum track to edit its bars as a step grid.</p>
      <template v-else>
        <div class="drum-grid-bar">
          <button type="button" class="drum-grid-nav" aria-label="Previous bar" :disabled="blockId <= 0" @click="goToBar(blockId - 1)">
            <AppIcon name="bar-back" />
          </button>
          <span class="drum-grid-title">Bar {{ blockId + 1 }}<span v-if="voiceId === 1"> · voice 2</span></span>
          <button type="button" class="drum-grid-nav" aria-label="Next bar" :disabled="blockId + 1 >= barCount" @click="goToBar(blockId + 1)">
            <AppIcon name="bar-forward" />
          </button>
          <label class="drum-grid-step">
            Step
            <select v-model="step" aria-label="Step length">
              <option value="e">1/8</option>
              <option value="s">1/16</option>
              <option value="t">1/32</option>
            </select>
          </label>
        </div>
        <p v-if="grid.offGrid" class="drum-grid-warning" role="note">
          This bar has hits between the steps (triplets or shorter notes). A click here puts them on the grid.
        </p>
        <div class="drum-grid-scroll">
          <table class="drum-grid-table" :aria-label="`Drums of bar ${blockId + 1}`">
            <tbody>
              <tr v-for="midi in rows" :key="midi">
                <th scope="row">
                  <button type="button" class="drum-grid-drum" :title="`${drumName(midi)} (hear it)`" @click="playDrum(trackId, voiceId, midi)">
                    <span class="drum-grid-label">{{ drumLabel(midi) }}</span>
                    <span class="drum-grid-name">{{ drumName(midi) }}</span>
                  </button>
                </th>
                <td v-for="(drums, column) in grid.hits" :key="column" :class="{ 'drum-grid-beat': column % stepsPerBeat === 0 }">
                  <button
                    type="button"
                    class="drum-grid-cell"
                    :class="{ 'drum-grid-cell--on': drums.has(midi), 'drum-grid-cell--beat': column % stepsPerBeat === 0 }"
                    :aria-pressed="drums.has(midi)"
                    :aria-label="`${drumName(midi)}, step ${column + 1}`"
                    :data-step="column"
                    :data-drum="midi"
                    @click="toggle(column, midi, !drums.has(midi))"
                  ></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="drum-grid-footer">
          <span class="drum-grid-hint">Each click is one undo step. Letter keys enter drums at the cursor (Help: ?).</span>
          <button type="button" class="drum-grid-link" @click="openDialog(DIALOGS.DRUM_INFO, {})">Drum map…</button>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import AppIcon from './AppIcon.vue'
import Song from '../stores/song'
import { selectionState } from '../stores/selectionState'
import { DIALOGS, openDialog } from '../services/dialogs/dialogs'
import { drumGridOf, drumMapOf, playDrum, setDrumGridCell } from '../services/editor/drumTracks'
import { drumLabel, drumName } from '../utils/drumMap'
import { GRID_STEPS, type GridStep } from '../utils/drumGrid'
import { typedEventBus } from '../utils/typedEventBus'

const step = ref<GridStep>('s')
const stepTicks = computed(() => GRID_STEPS[step.value])

const trackId = computed(() => selectionState.cursor.trackId)
const voiceId = computed(() => selectionState.cursor.voiceId)
const blockId = computed(() => selectionState.cursor.blockId)
const barCount = computed(() => Song.measures[trackId.value]?.length ?? 0)

const drumMap = computed(() => drumMapOf(trackId.value))
/** Highest line first, as in the tab. */
const rows = computed(() => [...(drumMap.value ?? [])].reverse())

const grid = computed(() => drumGridOf({ trackId: trackId.value, blockId: blockId.value, voiceId: voiceId.value }, stepTicks.value))

/** Steps per beat of the time signature (a quarter in 4/4), for the beat lines. */
const stepsPerBeat = computed(() => {
  const denominator = Song.measureMeta[blockId.value]?.denominator ?? 4
  return Math.max(1, Math.round(64 / denominator / stepTicks.value))
})

function toggle(column: number, midi: number, on: boolean) {
  setDrumGridCell({ trackId: trackId.value, blockId: blockId.value, voiceId: voiceId.value }, stepTicks.value, column, midi, on)
}

function goToBar(target: number) {
  const { trackId: track, voiceId: voice, string } = selectionState.cursor
  typedEventBus.emit('navigation.setClickedPos', { trackId: track, blockId: target, voiceId: voice, beatId: 0, string })
}
</script>

<style scoped>
.drum-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.drum-grid-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.drum-grid-title {
  min-width: 90px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}
.drum-grid-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-sunken);
  color: var(--color-text);
  cursor: pointer;
}
.drum-grid-nav:disabled {
  color: var(--color-text-faint);
  cursor: default;
}
.drum-grid-step {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
}
.drum-grid-step select {
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-field);
  color: var(--color-text);
}
.drum-grid-warning {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--color-accent-soft);
  color: var(--color-on-accent-soft);
  font-size: 12px;
}
.drum-grid-scroll {
  overflow-x: auto;
}
.drum-grid-table {
  border-collapse: collapse;
}
.drum-grid-table th {
  position: sticky;
  left: 0;
  z-index: 1;
  padding: 0 6px 0 0;
  background: var(--color-surface);
  font-weight: normal;
}
.drum-grid-table td {
  padding: 1px;
}
.drum-grid-table td.drum-grid-beat {
  padding-left: 5px;
}
.drum-grid-drum {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 130px;
  padding: 2px 4px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.drum-grid-drum:hover {
  background: var(--color-hover);
}
.drum-grid-label {
  min-width: 26px;
  color: var(--color-accent);
  font-weight: 700;
}
.drum-grid-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.drum-grid-cell {
  display: block;
  width: 22px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface-sunken);
  cursor: pointer;
}
.drum-grid-cell--beat {
  border-color: var(--color-border-strong);
}
.drum-grid-cell:hover {
  border-color: var(--color-accent);
}
.drum-grid-cell--on {
  border-color: var(--color-accent);
  background: var(--color-accent);
}
.drum-grid-cell:focus-visible,
.drum-grid-drum:focus-visible,
.drum-grid-nav:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}
.drum-grid-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.drum-grid-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
.drum-grid-link {
  flex: none;
  border: none;
  background: none;
  color: var(--color-accent);
  font-size: 12px;
  cursor: pointer;
}
</style>
