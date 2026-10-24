<template>
  <header id="compactBar" class="compact-bar">
    <div class="compact-bar__row">
      <div class="compact-bar__song">
        <span class="compact-bar__title">{{ title }}</span>
        <select
          id="compactTrackSelect"
          class="compact-bar__track"
          aria-label="Track"
          :value="currentTrackId"
          @change="selectTrack(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="(track, index) in tracks" :key="index" :value="index">{{ track.name || `Track ${index + 1}` }}</option>
        </select>
      </div>
      <button
        id="compactEditToggle"
        type="button"
        class="compact-bar__button"
        :class="{ 'is-on': layoutModeState.editing }"
        :aria-pressed="layoutModeState.editing"
        aria-label="Edit notes"
        @click="setCompactEditing(!layoutModeState.editing)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
      </button>
      <button
        id="compactMoreButton"
        type="button"
        class="compact-bar__button"
        aria-label="More"
        :aria-expanded="moreOpen"
        @click="moreOpen = !moreOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </button>
    </div>

    <div class="compact-bar__row compact-bar__transport">
      <button id="compactBarBack" type="button" class="compact-bar__button" aria-label="Previous bar" @click="stepBar(-1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14" /><path d="M18 6l-9 6 9 6z" /></svg>
      </button>
      <button
        id="compactPlay"
        type="button"
        class="compact-bar__button compact-bar__play"
        :aria-label="playbackTransportState.isPlaying ? 'Pause' : 'Play'"
        @pointerenter="preload()"
        @click="togglePlay()"
      >
        <svg v-if="playbackTransportState.isPlaying" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>
      </button>
      <button id="compactBarForward" type="button" class="compact-bar__button" aria-label="Next bar" @click="stepBar(1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14" /><path d="M6 6l9 6-9 6z" /></svg>
      </button>
      <label class="compact-bar__speed">
        <span class="visually-hidden">Speed</span>
        <select id="compactSpeed" :value="speedValue" @change="setSpeed(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="rate in SPEEDS" :key="rate" :value="rate">{{ Math.round(rate * 100) }}%</option>
          <option v-if="!SPEEDS.includes(speedValue)" :value="speedValue">{{ Math.round(speedValue * 100) }}%</option>
        </select>
      </label>
      <button
        id="compactMetronome"
        type="button"
        class="compact-bar__button"
        :class="{ 'is-on': practiceState.metronome }"
        :aria-pressed="practiceState.metronome"
        aria-label="Metronome"
        @click="practiceState.metronome = !practiceState.metronome"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l3 18H6z" /><path d="M12 17l5-9" /></svg>
      </button>
    </div>

    <div v-if="moreOpen" class="compact-bar__menu" role="menu" @keydown.esc="moreOpen = false">
      <button type="button" role="menuitem" @click="openFile">Open file…</button>
      <button type="button" role="menuitem" @click="zoomBy(0.15)">Larger tab</button>
      <button type="button" role="menuitem" @click="zoomBy(-0.15)">Smaller tab</button>
      <button type="button" role="menuitem" @click="useDesktopLayout">Desktop layout</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { selectionState } from '../../stores/selectionState'
import { computed, ref } from 'vue'
import playback from '../../services/playback'
import Settings from '../../stores/settingsState'
import { playbackTransportState } from '../../stores/playbackTransportState'
import { usePlaybackEngine } from '../../composables/usePlaybackEngine'
import { useSongData } from '../../composables/useSongData'
import { changeTrackWithLoading, focusEditorPosition } from '../../services/editorNavigation'
import { readCompactZoom, setCompactZoom } from '../../services/compactLayout'
import { layoutModeState, setCompactEditing, setCompactLayout } from '../../stores/layoutModeState'
import { practiceState, setPlaybackRate } from '../../stores/practiceState'

const SPEEDS = [0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5]

const { reactiveSongData } = useSongData()
const { togglePlay, stepBackward, stepForward, preload } = usePlaybackEngine()
const moreOpen = ref(false)

const title = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
const tracks = computed(() => reactiveSongData.tracks ?? [])
const currentTrackId = computed(() => reactiveSongData.currentTrackId ?? 0)
const speedValue = computed(() => Math.round(practiceState.playbackRate * 100) / 100)

function selectTrack(trackId: number): void {
  if (trackId === currentTrackId.value) return
  changeTrackWithLoading(trackId, 0, (complete) => complete())
}

function stepBar(direction: -1 | 1): void {
  if (Settings.songPlaying) {
    void (direction < 0 ? stepBackward() : stepForward())
    return
  }
  const { trackId, voiceId, blockId, string } = selectionState.cursor
  const bars = reactiveSongData.measures?.[trackId]?.length ?? 0
  const target = Math.min(Math.max(0, blockId + direction), Math.max(0, bars - 1))
  focusEditorPosition({ trackId, voiceId, blockId: target, beatId: 0, string }, { updatePlaybackPosition: false })
  playback.setPlayPosition(trackId, target, voiceId, 0)
}

function setSpeed(rate: number): void {
  setPlaybackRate(rate)
}

function openFile(): void {
  moreOpen.value = false
  // The desktop toolbar owns the file input; it stays mounted (hidden) in the compact layout.
  document.getElementById('openFile')?.click()
}

function zoomBy(step: number): void {
  const container = document.getElementById('mainContent')
  if (container) setCompactZoom(container, readCompactZoom() + step)
}

function useDesktopLayout(): void {
  moreOpen.value = false
  setCompactLayout(false)
}
</script>

<style scoped>
.compact-bar {
  position: relative;
  z-index: 300;
  flex: 0 0 auto;
  padding: 6px 10px 4px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.compact-bar__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-bar__transport {
  justify-content: space-between;
  margin-top: 4px;
}

.compact-bar__song {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.compact-bar__title {
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-bar__track,
.compact-bar__speed select {
  max-width: 100%;
  min-height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 2px 6px;
  background: var(--color-surface-raised);
  color: inherit;
  font: inherit;
  font-size: 14px;
}

.compact-bar__track {
  align-self: flex-start;
  margin-top: 2px;
  border-color: transparent;
  background: transparent;
  color: var(--color-text-muted);
}

.compact-bar__button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.compact-bar__button svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.compact-bar__button circle {
  fill: currentColor;
  stroke: none;
}

.compact-bar__button.is-on {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.compact-bar__play {
  width: 56px;
  border-radius: 28px;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.compact-bar__play svg path {
  fill: currentColor;
}

.compact-bar__menu {
  position: absolute;
  top: 52px;
  right: 10px;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-raised);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--color-shadow) 18%, transparent);
}

.compact-bar__menu button {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.compact-bar__menu button:active {
  background: var(--color-accent-soft);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
