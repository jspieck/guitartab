<template>
  <BaseModal :modal-id="DIALOGS.EXAMPLE_SONGS.id">
    <template #title>Example songs</template>
    <div class="modal-stack example-songs-modal">
      <p class="modal-body-text example-songs-intro">
        Listen to a piece, slow it down, loop a bar or change it. Opening one replaces the current song.
      </p>
      <div class="example-songs-list">
        <section v-for="group in groups" :key="group.kind" class="example-songs-group"
          :aria-labelledby="`exampleSongs-${group.kind}`">
          <h3 :id="`exampleSongs-${group.kind}`" class="example-songs-group__title">{{ group.label }}</h3>
          <ul class="example-songs-group__list">
            <li v-for="song in group.songs" :key="song.id" class="example-song">
              <div class="example-song__meta">
                <strong class="example-song__title">{{ song.title }}</strong>
                <span class="example-song__composer">{{ song.composer }}</span>
                <span class="example-song__description">{{ song.description }}</span>
                <span v-if="song.credit" class="example-song__credit">
                  Typeset by {{ song.credit.by }} ·
                  <a :href="song.credit.sourceUrl" target="_blank" rel="noopener noreferrer">Mutopia Project</a> ·
                  <a :href="song.credit.licenseUrl" target="_blank" rel="noopener noreferrer">{{ song.credit.license }}</a>
                </span>
                <span v-else class="example-song__credit">Written for GuitarTab</span>
              </div>
              <div class="example-song__buttons">
                <button type="button" class="modal-primary-button" :disabled="busy != null"
                  :aria-label="`Play ${song.title}`" @click="open(song, true)">
                  {{ busy === song.id ? 'Loading…' : 'Play' }}
                </button>
                <button type="button" class="modal-secondary-button" :disabled="busy != null"
                  :aria-label="`Open ${song.title}`" @click="open(song, false)">Open</button>
              </div>
            </li>
          </ul>
        </section>
      </div>
      <p v-if="error" class="example-songs-error" role="alert">{{ error }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { DIALOGS } from '../services/dialogs/dialogs'
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { EXAMPLE_KINDS, EXAMPLE_SONGS, type ExampleSong } from '../data/exampleSongs'
import { closeDialog } from '../services/dialogs/dialogs'
import { confirmReplaceUnsavedSong } from '../services/songAutosave'
import playback from '../services/playback'

const groups = EXAMPLE_KINDS.map((group) => ({
  ...group,
  songs: EXAMPLE_SONGS.filter((song) => song.kind === group.kind),
}))
const busy = ref<string | null>(null)
const error = ref('')

async function open(song: ExampleSong, play: boolean): Promise<void> {
  if (!confirmReplaceUnsavedSong(song.title)) return
  busy.value = song.id
  error.value = ''
  try {
    const { openExampleSong } = await import('../services/exampleSongs')
    await openExampleSong(song.id)
    closeDialog(DIALOGS.EXAMPLE_SONGS)
    // Play waits for the SoundFont if it is still loading.
    if (play) playback.start()
  } catch (failure) {
    console.error('Could not open the example song', failure)
    error.value = `Couldn't open "${song.title}". Check the connection and try again.`
  } finally {
    busy.value = null
  }
}
</script>

<style scoped>
.example-songs-modal {
  /* The shared dialog maximum (420 px) less the body padding. */
  width: min(386px, calc(100vw - 66px));
}

.example-songs-intro {
  margin: 0;
  line-height: 1.4;
}

.example-songs-list {
  max-height: min(60vh, 520px);
  overflow-y: auto;
}

.example-songs-group + .example-songs-group {
  margin-top: 14px;
}

.example-songs-group__title {
  margin: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.example-songs-group__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.example-song {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-divider);
}

.example-song__meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  line-height: 1.35;
}

.example-song__title {
  font-size: 14px;
}

.example-song__composer {
  font-size: 13px;
  color: var(--color-text);
}

.example-song__description,
.example-song__credit {
  font-size: 12px;
  color: var(--color-text-muted);
}

.example-song__credit a {
  color: inherit;
  text-decoration: underline;
}

.example-song__buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.example-songs-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}

/* Phones and narrow windows (the compact layout): a bottom sheet, full width. */
@media (max-width: 899px) {
  .example-songs-modal {
    width: auto;
  }
}

@media (max-width: 520px) {
  .example-song {
    flex-direction: column;
    align-items: stretch;
  }

  .example-song__buttons {
    flex-direction: row;
  }
}
</style>
