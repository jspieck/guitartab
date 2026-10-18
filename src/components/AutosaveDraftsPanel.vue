<template>
  <div v-if="draftsPanelState.open" class="autosave-drafts" role="dialog" aria-label="Recover drafts" @keydown.esc="closeDraftsPanel">
    <div class="autosave-drafts__header">
      <span class="autosave-drafts__title">Recover drafts</span>
      <button type="button" class="autosave-drafts__close" aria-label="Close" @click="closeDraftsPanel">×</button>
    </div>
    <p v-if="loading" class="autosave-drafts__empty">Loading…</p>
    <p v-else-if="drafts.length === 0" class="autosave-drafts__empty">
      No drafts yet. Unsaved changes are kept here automatically.
    </p>
    <ul v-else class="autosave-drafts__list">
      <li v-for="draft in drafts" :key="draft.id" class="autosave-drafts__item">
        <span class="autosave-drafts__name">{{ draft.title }}</span>
        <span class="autosave-drafts__time">{{ formatTime(draft.savedAt) }}</span>
        <button type="button" class="autosave-banner__action" @click="restore(draft)">Restore</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppManager from '../assets/js/appManager'
import {
  flushAutosave,
  listDrafts,
  restoreAutosave,
  type AutosaveSnapshot,
} from '../services/songAutosave'
import { closeDraftsPanel, draftsPanelState } from '../stores/draftsPanelState'

const drafts = ref<AutosaveSnapshot[]>([])
const loading = ref(false)

function formatTime(savedAt: number): string {
  return new Date(savedAt).toLocaleString()
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    // Capture current unsaved edits first, so they show up and are never lost by a restore.
    await flushAutosave()
    drafts.value = await listDrafts()
  } catch (error) {
    console.error('Failed to list drafts', error)
    drafts.value = []
  } finally {
    loading.value = false
  }
}

async function restore(draft: AutosaveSnapshot): Promise<void> {
  await flushAutosave().catch((error) => console.error('Autosave failed', error))
  if (!restoreAutosave(draft)) return
  closeDraftsPanel()
  AppManager.showNotification(`Restored draft of "${draft.title}"`)
}

// Mounted only while the panel is open (App renders it with v-if), so load on mount.
onMounted(() => {
  void refresh()
})
</script>

<style scoped>
.autosave-drafts {
  position: fixed;
  /* Below the toolbar and the recovery banner. */
  top: 140px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  width: min(440px, calc(100vw - 32px));
  max-height: 60vh;
  overflow: auto;
  padding: 12px 14px;
  border-radius: 8px;
  background: #1f2937;
  color: #f9fafb;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.autosave-drafts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.autosave-drafts__title {
  font-weight: 600;
}

.autosave-drafts__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.autosave-drafts__empty {
  margin: 4px 0;
  color: #d1d5db;
}

.autosave-drafts__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.autosave-drafts__item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid #374151;
}

.autosave-drafts__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autosave-drafts__time {
  color: #d1d5db;
  font-size: 12px;
}
</style>
