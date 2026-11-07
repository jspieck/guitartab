<template>
  <BaseModal :modal-id="DIALOGS.ADD_TRACK.id" resize="xy">
    <template #title>{{ view.changing ? 'Change instrument' : 'Add instrument' }}</template>
    <div class="instrumentPicker">
      <label class="picker-search">
        <AppIcon name="search" class="picker-search-icon" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Search instruments"
          aria-label="Search instruments"
          autocomplete="off"
          @keydown.enter.prevent="pickFirstMatch"
        />
      </label>

      <div class="picker-categories" role="tablist" aria-label="Instrument family">
        <button
          v-for="category in categories"
          :key="category.index"
          type="button"
          role="tab"
          class="picker-chip"
          :class="{ 'picker-chip--active': activeCategory === category.index }"
          :aria-selected="activeCategory === category.index"
          @click="activeCategory = category.index"
        >{{ category.title }}</button>
      </div>

      <div class="picker-results">
        <section v-for="group in visibleGroups" :key="group.title" class="picker-group">
          <h3 v-if="showGroupTitles" class="picker-group-title">{{ group.title }}</h3>
          <div class="picker-grid">
            <button
              v-for="choice in group.choices"
              :key="choice"
              type="button"
              class="instrument-card"
              :class="{ 'instrument-card--current': choice === view.currentInstrument }"
              :aria-current="choice === view.currentInstrument || undefined"
              @click="selectInstrument(choice)"
            >
              <span class="instrument-tile">
                <img class="instrument-icon" :src="instrumentIconSrc(choice)" alt="" />
              </span>
              <span class="instrument-name">{{ instrumentList[choice][1] }}</span>
              <span v-if="choice === view.currentInstrument" class="instrument-badge">Current</span>
            </button>
          </div>
        </section>
        <p v-if="visibleGroups.length === 0" class="picker-empty">No instrument matches “{{ query.trim() }}”.</p>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import AppIcon from "./AppIcon.vue";
import { instrumentIconSrc, instrumentList } from "../data/instrumentData";
import { getDialogHandler } from "../services/dialogs/dialogHandlers";
import { AddTrackModalHandler } from "../services/dialogs/addTrackModalHandler";
import { DIALOGS } from "../services/dialogs/dialogs"
import { layoutModeState } from "../stores/layoutModeState";

const ALL = -1;

const handler = getDialogHandler<AddTrackModalHandler>(DIALOGS.ADD_TRACK.id);
const view = handler.view;
const instrumentGroups = handler.getInstrumentGroups();
const categories = [
  { index: ALL, title: "All" },
  ...instrumentGroups.map((group, index) => ({ index, title: group.title })),
];

const query = ref("");
const activeCategory = ref(ALL);
const searchInput = ref<HTMLInputElement | null>(null);

const matches = (choice: string, needle: string) =>
  instrumentList[choice][1].toLowerCase().includes(needle);

/** The search looks through every family; without one, the chosen family (or all of them). */
const visibleGroups = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const groups = needle || activeCategory.value === ALL ? instrumentGroups : [instrumentGroups[activeCategory.value]];
  return groups
    .map((group) => ({ title: group.title, choices: needle ? group.choices.filter((c) => matches(c, needle)) : group.choices }))
    .filter((group) => group.choices.length > 0);
});
const showGroupTitles = computed(() => visibleGroups.value.length > 1 || query.value.trim() !== "");

// Each opening starts fresh; the family of the track's instrument is preselected when changing one.
watch(() => view.openCount, () => {
  query.value = "";
  const current = instrumentGroups.findIndex((group) => group.choices.includes(view.currentInstrument));
  activeCategory.value = view.changing && current >= 0 ? current : ALL;
  // On phones the keyboard would cover the sheet.
  if (!layoutModeState.compact) nextTick(() => searchInput.value?.focus());
}, { immediate: true });

watch(query, (text) => {
  if (text.trim()) activeCategory.value = ALL;
});

const selectInstrument = (choice: string) => {
  handler.selectInstrument(choice);
};

function pickFirstMatch() {
  const first = visibleGroups.value[0]?.choices[0];
  if (first && query.value.trim()) selectInstrument(first);
}
</script>

<style scoped>
/* The search and the families stay put; only the instrument list scrolls. */
.instrumentPicker {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  min-height: 0;
  /* The dialog body's max-height (78vh - title bar) minus its padding. */
  height: min(560px, calc(78vh - 68px));
}

.picker-search {
  position: relative;
  display: block;
  flex: 0 0 auto;
}

.picker-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  color: var(--color-text-faint);
  pointer-events: none;
}

/* The id outranks the shared dialog field styles. */
#addTrackModal .picker-search input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-field);
  color: var(--color-text);
  font: inherit;
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

#addTrackModal .picker-search input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.picker-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;
}

.picker-chip {
  padding: 4px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.picker-chip:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.picker-chip--active,
.picker-chip--active:hover {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.picker-results {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0 calc(-1 * var(--space-2));
  padding: 0 var(--space-2) var(--space-2);
  border-top: 1px solid var(--color-divider);
}

.picker-group-title {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: var(--space-3) 0 var(--space-1);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.picker-group:not(:has(.picker-group-title)) {
  padding-top: var(--space-1);
}

/* The gap sits outside the opaque sticky heading, so a lifted (hovered) or focused card in the
   first row isn't drawn under it. */
.picker-grid {
  padding-top: var(--space-2);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: var(--space-2);
}

.instrument-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 14px 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.instrument-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}

.instrument-card:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.instrument-card--current {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.instrument-tile {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.instrument-card--current .instrument-tile {
  background: var(--color-surface);
}

.instrument-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.instrument-name {
  max-width: 100%;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: anywhere;
}

.instrument-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.picker-empty {
  margin: var(--space-6) 0;
  color: var(--color-text-muted);
  text-align: center;
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .instrument-card,
  .instrument-card:hover {
    transition: none;
    transform: none;
  }
}
</style>
