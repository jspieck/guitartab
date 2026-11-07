<template>
  <BaseModal :modal-id="DIALOGS.DRUM_INFO.id">
    <template #title>Drum map</template>
    <div class="drum-map">
      <p v-if="drumMap == null" class="drum-map-hint">
        Select a drum track: its drum map lists the drums it uses, one tab line each.
      </p>
      <template v-else>
        <p class="drum-map-hint">
          The lines of {{ trackName }}, top line first. Click a drum to put it at the cursor (again: take it away).
        </p>
        <ol class="drum-map-lines" aria-label="Drum lines, top first">
          <li v-for="(midi, index) in linesTopFirst" :key="midi" class="drum-map-line" :data-drum="midi">
            <button type="button" class="drum-map-place" :title="`${drumName(midi)} at the cursor`" @click="toggleDrumAtCursor(midi)">
              <span class="drum-map-label">{{ drumLabel(midi) }}</span>
              <span class="drum-map-name">{{ drumName(midi) }}</span>
              <span class="drum-map-meta">{{ midi }}</span>
              <kbd v-if="keyOf(midi)" class="drum-map-key" :title="`Key ${keyOf(midi)}`">{{ keyOf(midi) }}</kbd>
              <span class="drum-map-meta drum-map-hits">{{ hitText(midi) }}</span>
            </button>
            <button type="button" class="drum-map-icon" :aria-label="`Move ${drumName(midi)} up`" :disabled="index === 0" @click="move(midi, 1)">
              <AppIcon name="chevron-up" />
            </button>
            <button type="button" class="drum-map-icon" :aria-label="`Move ${drumName(midi)} down`" :disabled="index === linesTopFirst.length - 1" @click="move(midi, -1)">
              <AppIcon name="chevron-down" />
            </button>
            <button type="button" class="drum-map-icon" :aria-label="`Remove ${drumName(midi)}`" :disabled="drumMap.length <= 1" @click="remove(midi)">
              <AppIcon name="trash" />
            </button>
          </li>
        </ol>
        <section v-for="group in addGroups" :key="group.name" class="drum-map-group">
          <h3 class="drum-map-heading">Add · {{ group.name }}</h3>
          <div class="drum-map-grid">
            <button v-for="midi in group.drums" :key="midi" type="button" class="drum-map-item"
              :title="`Add a line for ${drumName(midi)} (note ${midi})`" @click="add(midi)">
              <span class="drum-map-note">{{ midi }}</span>
              <span class="drum-map-name">{{ drumName(midi) }}</span>
            </button>
          </div>
        </section>
      </template>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import AppIcon from './AppIcon.vue'
import Song from '../stores/song'
import { selectionState } from '../stores/selectionState'
import { showNotification } from '../stores/notificationState'
import { DIALOGS } from '../services/dialogs/dialogs'
import { drumHitCounts, drumMapOf, setDrumMap, toggleDrumAtCursor } from '../services/editor/drumTracks'
import { undoHistory } from '../services/editor/editCommands'
import { DRUM_KEYS } from '../utils/keyboardShortcuts'
import { GM_DRUMS, drumLabel, drumName, insertDrum } from '../utils/drumMap'

const GROUPS: { name: string; test: (midi: number) => boolean }[] = [
  { name: 'Kicks & snares', test: (midi) => midi <= 40 },
  { name: 'Toms', test: (midi) => [41, 43, 45, 47, 48, 50].includes(midi) },
  { name: 'Hi-hats & cymbals', test: (midi) => [42, 44, 46, 49, 51, 52, 53, 55, 57, 59].includes(midi) },
  { name: 'Percussion', test: () => true },
]

const trackId = computed(() => selectionState.cursor.trackId)
const drumMap = computed(() => drumMapOf(trackId.value))
const trackName = computed(() => Song.tracks[trackId.value]?.name || 'this track')
const linesTopFirst = computed(() => [...(drumMap.value ?? [])].reverse())

// reads the song through its reactive proxy, so it counts again after every edit
const hitCounts = computed(() => drumHitCounts(trackId.value))

const addGroups = computed(() => {
  const missing = GM_DRUMS.filter((midi) => !drumMap.value?.includes(midi))
  return GROUPS.map((group, index) => ({
    name: group.name,
    drums: missing.filter((midi) => GROUPS.findIndex((g) => g.test(midi)) === index),
  })).filter((group) => group.drums.length > 0)
})

function keyOf(midi: number): string | undefined {
  const map = drumMap.value ?? []
  return DRUM_KEYS.find((entry) => entry.drums.find((drum) => map.includes(drum)) === midi)?.key
}

function hitText(midi: number): string {
  const count = hitCounts.value.get(midi) ?? 0
  return count === 1 ? '1 hit' : `${count} hits`
}

/** Moves a line up (+1) or down (-1) in the tab. */
function move(midi: number, by: 1 | -1) {
  const map = [...(drumMap.value ?? [])]
  const from = map.indexOf(midi)
  const to = from + by
  if (from < 0 || to < 0 || to >= map.length) return
  map.splice(from, 1)
  map.splice(to, 0, midi)
  setDrumMap(trackId.value, map, `Move ${drumName(midi)}`)
}

function add(midi: number) {
  const map = [...(drumMap.value ?? [])]
  insertDrum(map, midi)
  setDrumMap(trackId.value, map, `Add ${drumName(midi)}`)
}

function remove(midi: number) {
  const hits = hitCounts.value.get(midi) ?? 0
  const map = (drumMap.value ?? []).filter((drum) => drum !== midi)
  if (!setDrumMap(trackId.value, map, `Remove ${drumName(midi)}`)) return
  if (hits > 0) {
    showNotification(`Removed ${drumName(midi)} and its ${hits === 1 ? 'hit' : `${hits} hits`}.`, 'info', {
      label: 'Undo',
      run: () => undoHistory.undo(),
    })
  }
}
</script>

<style scoped>
.drum-map {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.drum-map-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
.drum-map-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.drum-map-line {
  display: flex;
  align-items: center;
  gap: 2px;
}
.drum-map-place {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-sunken);
  color: var(--color-text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.drum-map-place:hover {
  border-color: var(--color-accent);
  background: var(--color-hover);
}
.drum-map-label {
  min-width: 28px;
  color: var(--color-accent);
  font-weight: 700;
}
.drum-map-meta {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.drum-map-hits {
  margin-left: auto;
}
.drum-map-key {
  padding: 0 5px;
  border: 1px solid var(--color-border-strong);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 11px;
}
.drum-map-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}
.drum-map-icon:hover:not(:disabled) {
  background: var(--color-hover);
  color: var(--color-text);
}
.drum-map-icon:disabled {
  color: var(--color-text-faint);
  cursor: default;
}
.drum-map-heading {
  margin: 0 0 6px;
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.drum-map-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
.drum-map-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-sunken);
  color: var(--color-text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}
.drum-map-item:hover {
  border-color: var(--color-accent);
  background: var(--color-hover);
}
.drum-map-place:focus-visible,
.drum-map-item:focus-visible,
.drum-map-icon:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}
.drum-map-note {
  min-width: 18px;
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.drum-map-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
