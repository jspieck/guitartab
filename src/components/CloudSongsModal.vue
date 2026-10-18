<template>
  <BaseModal modal-id="cloudSongsModal">
    <template #title>Cloud songs</template>
    <div class="modal-stack cloud-songs-modal">
      <div class="modal-section">
        <label class="modal-field-label" for="cloudApiKey">Write API key (optional)</label>
        <input
          id="cloudApiKey"
          v-model="apiKey"
          type="password"
          class="cloud-api-key-input"
          placeholder="Required for save/update when server enforces X-API-Key"
          @change="persistApiKey"
        />
      </div>

      <div class="modal-section cloud-songs-actions">
        <button type="button" class="modal-secondary-button" :disabled="loading" @click="refreshSongs">
          Refresh list
        </button>
        <button type="button" class="modal-secondary-button" :disabled="loading" @click="saveCurrentToCloud">
          Save current tab to cloud
        </button>
      </div>

      <p v-if="statusMessage" class="cloud-status-message">{{ statusMessage }}</p>

      <div v-if="shareUrl" class="modal-section cloud-share-section">
        <label class="modal-field-label">Share link</label>
        <div class="cloud-share-row">
          <input :value="shareUrl" readonly class="cloud-share-input" />
          <button type="button" class="modal-secondary-button" @click="copyShareUrl">Copy</button>
        </div>
      </div>

      <div class="modal-section cloud-song-list">
        <label class="modal-field-label">Saved songs</label>
        <p v-if="loading" class="cloud-list-empty">Loading…</p>
        <p v-else-if="loadFailed" class="cloud-list-empty">
          Couldn't load your cloud songs.
          <button type="button" class="modal-secondary-button" @click="refreshSongs">Try again</button>
        </p>
        <p v-else-if="songs.length === 0" class="cloud-list-empty">No cloud songs yet. “Save current tab to cloud” adds this song here.</p>
        <ul v-else class="cloud-songs-ul">
          <li v-for="song in songs" :key="song.id" class="cloud-song-item">
            <div class="cloud-song-meta">
              <strong>{{ song.title || 'Untitled' }}</strong>
              <span v-if="song.author"> — {{ song.author }}</span>
              <span class="cloud-song-updated">Updated {{ formatDate(song.updatedAt) }}</span>
            </div>
            <div class="cloud-song-buttons">
              <button type="button" class="modal-secondary-button" @click="openSong(song.id, song.title || 'Untitled')">Open</button>
              <button type="button" class="modal-secondary-button" @click="setShareUrl(song.id)">Share</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import Song from '../assets/js/songData'
import AppManager from '../assets/js/appManager'
import { modalManager } from '../assets/js/modals/modalManager'
import { serializeSongToGtBytes } from '../utils/gtSerialization'
import { loadCloudSongById } from '../services/cloudSongLoader'
import { confirmReplaceUnsavedSong } from '../services/songAutosave'
import {
  getCloudShareUrl,
  getStoredCloudApiKey,
  listCloudSongs,
  setStoredCloudApiKey,
  uploadCloudSong,
  type CloudSongSummary,
} from '../services/cloudSongApi'

const songs = ref<CloudSongSummary[]>([])
const loading = ref(false)
const loadFailed = ref(false)
const statusMessage = ref('')
const shareUrl = ref('')
const apiKey = ref(getStoredCloudApiKey())

function persistApiKey() {
  setStoredCloudApiKey(apiKey.value)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function setShareUrl(songId: string) {
  shareUrl.value = getCloudShareUrl(songId)
}

async function refreshSongs() {
  loading.value = true
  loadFailed.value = false
  statusMessage.value = ''
  try {
    songs.value = await listCloudSongs()
  } catch (error) {
    loadFailed.value = true
    statusMessage.value = error instanceof Error ? error.message : 'Failed to load cloud songs'
    songs.value = []
  } finally {
    loading.value = false
  }
}

async function saveCurrentToCloud() {
  loading.value = true
  statusMessage.value = ''
  try {
    const bytes = serializeSongToGtBytes()
    const title = Song.songDescription.title || 'Untitled'
    const author = Song.songDescription.author || Song.songDescription.artist || ''
    const saved = await uploadCloudSong(bytes, {
      title,
      author,
      apiKey: apiKey.value || undefined,
    })
    setShareUrl(saved.id)
    statusMessage.value = `Saved "${saved.title}" to cloud.`
    AppManager.showNotification('Saved to cloud!')
    await refreshSongs()
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Failed to save to cloud'
  } finally {
    loading.value = false
  }
}

async function openSong(songId: string, title: string) {
  if (!confirmReplaceUnsavedSong(title)) return
  loading.value = true
  statusMessage.value = ''
  try {
    await loadCloudSongById(songId)
    setShareUrl(songId)
    statusMessage.value = 'Song loaded from cloud.'
    modalManager.closeModal('cloudSongsModal')
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Failed to open cloud song'
  } finally {
    loading.value = false
  }
}

async function copyShareUrl() {
  if (!shareUrl.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    AppManager.showNotification('Share link copied!')
  } catch {
    statusMessage.value = 'Could not copy link — select and copy manually.'
  }
}

onMounted(() => {
  void refreshSongs()
})

defineExpose({
  refreshSongs,
})
</script>

<style scoped>
.cloud-songs-modal {
  min-width: 420px;
  max-width: 560px;
}

.cloud-api-key-input,
.cloud-share-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  padding: 6px 8px;
}

.cloud-songs-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cloud-status-message {
  margin: 8px 0 0;
  color: var(--modal-text-muted);
  font-size: 13px;
}

.cloud-share-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cloud-share-input {
  flex: 1;
}

.cloud-songs-ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}

.cloud-song-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--modal-divider);
}

.cloud-song-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cloud-song-updated {
  font-size: 12px;
  color: #666;
}

.cloud-song-buttons {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.cloud-list-empty {
  margin: 8px 0 0;
  color: #666;
}
</style>
