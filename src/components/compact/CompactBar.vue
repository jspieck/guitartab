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
        ref="moreButtonRef"
        type="button"
        class="compact-bar__button"
        aria-label="More"
        aria-haspopup="menu"
        :aria-expanded="moreOpen"
        @click="toggleMore"
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
        :class="{ 'is-loading': soundFontLoading != null, 'is-waiting': soundFontState.playWhenReady }"
        :style="soundFontLoading != null ? { '--load-progress': soundFontProgress() ?? 0 } : undefined"
        :aria-label="playbackTransportState.isPlaying ? 'Pause' : soundFontLoading ?? 'Play'"
        :aria-pressed="soundFontState.playWhenReady || undefined"
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

    <!-- Teleported so it isn't clipped and stacks above the tab and the note pad. -->
    <Teleport to="body">
      <div v-if="moreOpen" id="compactMoreMenu" ref="menuRef" class="compact-menu" role="menu" aria-label="More" @keydown="onMenuKeydown">
        <button type="button" role="menuitem" @click="run(openFile)">Open file…</button>
        <button type="button" role="menuitem" @click="run(() => toolbarAction('exampleSongs').run())">Example songs…</button>
        <div class="compact-menu__tempo" role="group" aria-label="Song tempo">
          <span class="compact-menu__label">Tempo</span>
          <button type="button" role="menuitem" aria-label="Slower" @click="nudgeTempo(-5)">−</button>
          <span id="compactTempo" class="compact-menu__value">♩ {{ currentTempo }}</span>
          <button type="button" role="menuitem" aria-label="Faster" @click="nudgeTempo(5)">+</button>
        </div>
        <div class="compact-menu__heading" role="presentation">Track</div>
        <button type="button" role="menuitem" @click="run(() => openTrackSettings(currentTrackId))">Track settings and tuning…</button>
        <button type="button" role="menuitem" @click="run(() => openChangeInstrument(currentTrackId))">Change instrument…</button>
        <button type="button" role="menuitem" @click="run(openAddTrack)">Add track…</button>
        <button type="button" role="menuitem" class="compact-menu__danger" @click="run(() => requestDeleteTrack(currentTrackId))">Delete track…</button>
        <div class="compact-menu__heading" role="presentation">View</div>
        <button type="button" role="menuitem" @click="zoomBy(0.15)">Larger tab</button>
        <button type="button" role="menuitem" @click="zoomBy(-0.15)">Smaller tab</button>
        <button type="button" role="menuitem" @click="run(useDesktopLayout)">Desktop layout</button>
      </div>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import { selectionState } from '../../stores/selectionState'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Song from '../../stores/song'
import { useTempoState } from '../../stores/tempoState'
import { setSongTempo } from '../../services/editor/songSettingsCommands'
import { toolbarAction } from '../../services/editor/toolbarActions'
import {
  openAddTrack,
  openChangeInstrument,
  openTrackSettings,
  requestDeleteTrack,
} from '../../services/editor/trackActions'
import { focusMenuItem } from '../toolbar/menuKeyboard'
import playback from '../../services/playback'
import Settings from '../../stores/settingsState'
import { playbackTransportState } from '../../stores/playbackTransportState'
import { soundFontLoadingLabel, soundFontProgress, soundFontState } from '../../stores/soundFontState'
import { usePlaybackEngine } from '../../composables/usePlaybackEngine'
import { useSongData } from '../../composables/useSongData'
import { changeTrackWithLoading, focusEditorPosition } from '../../services/editorNavigation'
import { readCompactZoom, setCompactZoom } from '../../services/compactLayout'
import { layoutModeState, setCompactEditing, setCompactLayout } from '../../stores/layoutModeState'
import { practiceState, setPlaybackRate } from '../../stores/practiceState'

const SPEEDS = [0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5]

const { reactiveSongData } = useSongData()
const { togglePlay, stepBackward, stepForward, preload } = usePlaybackEngine()
const soundFontLoading = computed(() => soundFontLoadingLabel())
const moreOpen = ref(false)
const moreButtonRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const { currentTempo } = useTempoState()

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

async function toggleMore(): Promise<void> {
  moreOpen.value = !moreOpen.value
  if (!moreOpen.value) return
  await nextTick()
  focusMenuItem(menuRef.value, 'first')
}

function closeMore({ focusButton = false } = {}): void {
  moreOpen.value = false
  if (focusButton) moreButtonRef.value?.focus()
}

/** Menu entries that open something close the menu first. */
function run(action: () => void): void {
  closeMore()
  action()
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMore({ focusButton: true })
  } else if (focusMenuItem(menuRef.value, event.key)) {
    event.preventDefault()
  }
}

/** A tap outside closes it (the More button toggles it itself). */
function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (moreOpen.value && !menuRef.value?.contains(target) && !moreButtonRef.value?.contains(target)) closeMore()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))

function nudgeTempo(step: number): void {
  // One undo step per tap; setSongTempo clamps to the allowed range.
  setSongTempo(Song.bpm + step)
}

function openFile(): void {
  // The desktop toolbar owns the file input; it stays mounted (hidden) in the compact layout.
  toolbarAction('openFile').run()
}

function zoomBy(step: number): void {
  const container = document.getElementById('mainContent')
  if (container) setCompactZoom(container, readCompactZoom() + step)
}

function useDesktopLayout(): void {
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

/* SoundFont still downloading: a progress bar along the bottom (see toolbar.css for the desktop ring) */
.compact-bar__play.is-loading {
  position: relative;
  overflow: hidden;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.compact-bar__play.is-loading::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: calc(var(--load-progress, 0) * 100%);
  height: 4px;
  background: var(--color-accent);
  content: '';
}

.compact-bar__play.is-waiting {
  animation: play-waiting 1.2s ease-in-out infinite;
}

@keyframes play-waiting {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-bar__play.is-waiting {
    animation: none;
  }
}

.compact-menu {
  position: fixed;
  z-index: 1000;
  top: 52px;
  right: 10px;
  display: flex;
  flex-direction: column;
  min-width: 240px;
  max-height: calc(100vh - 64px);
  padding: 6px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: 15px;
  box-shadow: var(--shadow-popover);
}

.compact-menu button {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.compact-menu button:active,
.compact-menu button:focus-visible {
  background: var(--color-accent-soft);
  outline: none;
}

.compact-menu__heading {
  padding: 10px 12px 2px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.compact-menu__tempo {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 12px;
}

.compact-menu__label {
  flex: 1;
}

.compact-menu .compact-menu__tempo button {
  width: 44px;
  padding: 0;
  font-size: 20px;
  text-align: center;
}

.compact-menu__value {
  min-width: 56px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.compact-menu .compact-menu__danger {
  color: var(--color-danger);
}
</style>
