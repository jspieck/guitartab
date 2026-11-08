<template>
  <BaseModal :modal-id="DIALOGS.AUDIO_EXPORT.id">
    <template #title>Export audio</template>
    <div class="modal-stack audio-export">
      <fieldset class="audio-export__group" :disabled="running">
        <legend class="audio-export__legend">What</legend>
        <div class="modal-checkbox-row">
          <input id="audioExportSong" v-model="state.range" type="radio" value="song" name="audioExportRange" />
          <label for="audioExportSong">Whole song</label>
        </div>
        <div class="modal-checkbox-row">
          <input
            id="audioExportLoop"
            v-model="state.range"
            type="radio"
            value="loop"
            name="audioExportRange"
            :disabled="loopLabel == null"
          />
          <label for="audioExportLoop">{{ loopLabel ?? 'The loop (none set)' }}</label>
        </div>
        <div class="modal-checkbox-row">
          <input id="audioExportRepeats" v-model="state.unrollRepeats" type="checkbox" />
          <label for="audioExportRepeats">Play repeats and jumps</label>
        </div>
        <div class="modal-checkbox-row">
          <input id="audioExportMetronome" v-model="state.metronome" type="checkbox" />
          <label for="audioExportMetronome">Metronome clicks</label>
        </div>
        <div class="modal-checkbox-row">
          <input id="audioExportCountIn" v-model="state.countIn" type="checkbox" />
          <label for="audioExportCountIn">Count-in bar</label>
        </div>
        <div v-if="practiceRate !== 1" class="modal-checkbox-row">
          <input id="audioExportSpeed" v-model="state.practiceSpeed" type="checkbox" />
          <label for="audioExportSpeed">At practice speed ({{ Math.round(practiceRate * 100) }} %)</label>
        </div>
      </fieldset>

      <div class="modal-field modal-field-compact">
        <label for="audioExportFormat">Format</label>
        <select id="audioExportFormat" v-model="state.format" :disabled="running">
          <option value="wav">WAV (uncompressed, 16-bit)</option>
          <option value="opus" :disabled="!opusAvailable">
            {{ opusAvailable ? 'Opus (.ogg, about 1.2 MB a minute)' : 'Opus (not in this browser)' }}
          </option>
        </select>
      </div>

      <p class="audio-export__hint">
        Sounds as it plays here: mute, solo, volumes, amps, EQ and limiter as set in the mixer.
        <template v-if="lengthLabel">Length about {{ lengthLabel }}.</template>
      </p>

      <div v-if="running" class="audio-export__progress" aria-live="polite">
        <progress
          id="audioExportProgress"
          :value="Math.round(state.progress * 100)"
          max="100"
          :aria-label="phaseLabel"
        ></progress>
        <span class="audio-export__status">{{ phaseLabel }}</span>
      </div>
      <p
        v-else-if="state.message"
        id="audioExportMessage"
        class="audio-export__status"
        :class="{ 'audio-export__status--error': state.phase === 'failed' }"
        role="status"
      >
        {{ state.message }}
      </p>

      <div class="modal-submit-row">
        <SubmitButton
          v-if="running"
          button-id="audioExportCancel"
          label="Cancel"
          variant="secondary"
          @submitInfo="cancel"
        />
        <SubmitButton v-else button-id="audioExportStart" label="Export" @submitInfo="start" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { audioExportRunning, audioExportState as state } from '../stores/audioExportState'
import { practiceState } from '../stores/practiceState'
import { selectionState } from '../stores/selectionState'
import { songState } from '../stores/songState'
import Song from '../stores/song'
import { currentLoopInterval } from '../services/editor/rangeSelection'

type ExportModule = typeof import('../services/audioExport/audioExport')
type PlanModule = typeof import('../services/audioExport/renderPlan')

const exportModule = () => import('../services/audioExport/audioExport')
const opusAvailable = ref(false)
const planModule = ref<PlanModule | null>(null)

const running = computed(() => audioExportRunning())
const practiceRate = computed(() => practiceState.playbackRate)

/** The loop, read again whenever the range selection changes. */
const loop = computed(() => {
  void selectionState.rangeStart
  void selectionState.rangeEnd
  return currentLoopInterval()
})
const loopLabel = computed(() => {
  const interval = loop.value
  if (interval == null) return null
  const first = interval.startBlock + 1
  const last = interval.endBlock + 1
  return first === last ? `The loop (bar ${first})` : `The loop (bars ${first}–${last})`
})

// No loop any more: fall back to the whole song.
watch(loopLabel, (label) => {
  if (label == null && state.range === 'loop' && !running.value) state.range = 'song'
}, { immediate: true })

const lengthLabel = computed(() => {
  const plan = planModule.value
  if (plan == null) return ''
  void songState.measureMeta
  const result = plan.buildRenderPlan(Song.measureMeta, {
    range: state.range,
    loop: loop.value,
    unrollRepeats: state.unrollRepeats,
    countIn: state.countIn,
    playbackRate: state.practiceSpeed ? practiceRate.value : 1,
    songBpm: Song.bpm,
  })
  return result.bars.length > 0 ? plan.formatDuration(result.duration) : ''
})

const phaseLabel = computed(() => {
  const percent = `${Math.round(state.progress * 100)} %`
  if (state.phase === 'waiting') return state.message
  if (state.phase === 'encoding') return `Encoding… ${percent}`
  return `Rendering… ${percent}`
})

onMounted(async () => {
  const [{ opusSupported }, plan] = await Promise.all([
    import('../services/audioExport/opusEncoder'),
    import('../services/audioExport/renderPlan'),
  ])
  planModule.value = plan
  opusAvailable.value = await opusSupported()
  if (!opusAvailable.value && state.format === 'opus') state.format = 'wav'
})

async function start(): Promise<void> {
  const module: ExportModule = await exportModule()
  void module.startAudioExport()
}

async function cancel(): Promise<void> {
  ;(await exportModule()).cancelAudioExport()
}
</script>

<style scoped>
.audio-export {
  width: min(340px, calc(100vw - 66px));
}

.audio-export__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.audio-export__legend {
  margin-bottom: 4px;
  padding: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.audio-export select {
  width: 100%;
  min-width: 0;
}

.audio-export__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.audio-export__progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-export__progress progress {
  width: 100%;
  height: 8px;
  accent-color: var(--color-accent);
}

.audio-export__status {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.audio-export__status--error {
  color: var(--color-danger);
}
</style>
