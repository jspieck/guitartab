<template>
  <BaseModal :modal-id="DIALOGS.TUNER.id">
    <template #title>Tuner</template>
    <div class="modal-stack tuner" :class="stateClass">
      <p v-if="tunerState.error" class="tuner__message" role="alert">{{ tunerState.error }}</p>
      <template v-else>
        <div class="tuner__gauge">
          <svg viewBox="0 0 320 196" aria-hidden="true">
            <!-- input level: grows from the middle outwards -->
            <path
              class="tuner__level"
              :d="LEVEL_ARC"
              pathLength="100"
              :style="{ strokeDasharray: `${levelLength} 100`, strokeDashoffset: -(100 - levelLength) / 2 }"
            />
            <path v-for="zone in ZONES" :key="zone.key" :d="zone.d" class="tuner__zone" :class="`tuner__zone--${zone.kind}`" />
            <line
              v-for="tick in TICKS"
              :key="tick.cents"
              class="tuner__tick"
              :class="{ 'tuner__tick--major': tick.major }"
              :x1="tick.x1"
              :y1="tick.y1"
              :x2="tick.x2"
              :y2="tick.y2"
            />
            <text v-for="label in LABELS" :key="label.text" class="tuner__label" :x="label.x" :y="label.y">
              {{ label.text }}
            </text>
            <g class="tuner__needle" :style="{ transform: `rotate(${needleAngle}deg)` }">
              <line :x1="CX" :y1="CY - RADIUS + 46" :x2="CX" :y2="CY - RADIUS - 8" class="tuner__needle-line" />
              <circle :cx="CX" :cy="CY - RADIUS" r="7" class="tuner__needle-dot" />
            </g>
            <text class="tuner__note" :x="CX" :y="CY - 22">
              <tspan>{{ display.letter }}</tspan>
              <tspan class="tuner__note-accidental" dy="-26">{{ display.accidental }}</tspan>
              <!-- back on the letter's baseline, under the sharp -->
              <tspan class="tuner__note-octave" :dx="display.accidental ? -16 : 2" :dy="display.accidental ? 26 : 0">{{ display.octave }}</tspan>
            </text>
            <text class="tuner__cents" :x="CX" :y="CY + 14">{{ centsText }}</text>
          </svg>
        </div>

        <div class="tuner__direction" aria-hidden="true">
          <span class="tuner__arrow tuner__arrow--flat" :class="{ 'tuner__arrow--on': direction === 'flat' }">♭</span>
          <span class="tuner__verdict">{{ verdict }}</span>
          <span class="tuner__arrow tuner__arrow--sharp" :class="{ 'tuner__arrow--on': direction === 'sharp' }">♯</span>
        </div>

        <ol class="tuner__strings" aria-label="Strings of the track's tuning">
          <li
            v-for="(pitch, index) in tuning"
            :key="index"
            class="tuner__string"
            :class="{
              'tuner__string--active': reading?.string === index,
              'tuner__string--tuned': tunedStrings.has(index),
            }"
            :aria-label="`${noteName(pitch)}${tunedStrings.has(index) ? ', in tune' : ''}`"
          >
            <span class="tuner__string-name">{{ splitNote(noteName(pitch)).letter }}{{ splitNote(noteName(pitch)).accidental }}</span>
            <span class="tuner__string-octave">{{ splitNote(noteName(pitch)).octave }}</span>
          </li>
        </ol>

        <div class="tuner__detail" aria-live="polite">{{ detail }}</div>
      </template>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { useDialogOpen } from '../composables/useDialogOpen'
import { songState } from '../stores/songState'
import { startTuner, stopTuner, tunerState } from '../services/audio/tuner'
import { noteName } from '../utils/pitchDetection'

/** Gauge geometry (viewBox units): ±50 cents sweep ±64° around the centre below the arc. */
const CX = 160
const CY = 176
const RADIUS = 130
const DEGREES_PER_CENT = 1.28
/** Within this many cents a string counts as in tune; within CLOSE_CENTS it is nearly there. */
const IN_TUNE_CENTS = 5
const CLOSE_CENTS = 20
/** Readings (80 ms apart) a string has to stay in tune before it gets its tick. */
const TUNED_STREAK = 4

function point(cents: number, radius: number): { x: number; y: number } {
  const angle = (cents * DEGREES_PER_CENT * Math.PI) / 180
  return { x: CX + radius * Math.sin(angle), y: CY - radius * Math.cos(angle) }
}

function arc(from: number, to: number, radius: number): string {
  const start = point(from, radius)
  const end = point(to, radius)
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

const ZONES = [
  { key: 'flat-far', kind: 'far', d: arc(-50, -CLOSE_CENTS, RADIUS) },
  { key: 'flat-close', kind: 'close', d: arc(-CLOSE_CENTS, -IN_TUNE_CENTS, RADIUS) },
  { key: 'in-tune', kind: 'in-tune', d: arc(-IN_TUNE_CENTS, IN_TUNE_CENTS, RADIUS) },
  { key: 'sharp-close', kind: 'close', d: arc(IN_TUNE_CENTS, CLOSE_CENTS, RADIUS) },
  { key: 'sharp-far', kind: 'far', d: arc(CLOSE_CENTS, 50, RADIUS) },
]

const LEVEL_ARC = arc(-50, 50, RADIUS - 24)

const TICKS = Array.from({ length: 21 }, (_, index) => {
  const cents = index * 5 - 50
  const major = cents % 10 === 0
  const outer = point(cents, RADIUS - 9)
  const inner = point(cents, RADIUS - (major ? 19 : 14))
  return { cents, major, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y }
})

const LABELS = [-50, -25, 0, 25, 50].map((cents) => {
  const at = point(cents, RADIUS + 17)
  return { text: cents > 0 ? `+${cents}` : String(cents), x: at.x, y: at.y + 4 }
})

const isOpen = useDialogOpen(DIALOGS.TUNER.id)

const tuning = computed(() => {
  const track = songState.tracks[songState.currentTrackId]
  return (track?.strings ?? []).slice(0, track?.numStrings ?? 6).map((pitch) => Math.round(pitch))
})

const reading = computed(() => tunerState.reading)

/** "C#2" → C, ♯, 2. */
function splitNote(name: string): { letter: string; accidental: string; octave: string } {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(name)
  if (!match) return { letter: name, accidental: '', octave: '' }
  return { letter: match[1], accidental: match[2] ? '♯' : '', octave: match[3] }
}

const display = computed(() =>
  reading.value ? splitNote(reading.value.stringNote) : { letter: '–', accidental: '', octave: '' },
)

const cents = computed(() => reading.value?.stringCents ?? 0)

/** Further off than ±50 cents sticks to the end of the scale. */
const needleAngle = computed(() => Math.max(-50, Math.min(50, cents.value)) * DEGREES_PER_CENT)

const direction = computed(() => {
  if (reading.value == null || Math.abs(cents.value) <= IN_TUNE_CENTS) return null
  return cents.value < 0 ? 'flat' : 'sharp'
})

const stateClass = computed(() => {
  if (!tunerState.listening) return 'tuner--waiting'
  if (reading.value == null) return 'tuner--idle'
  const off = Math.abs(cents.value)
  if (off <= IN_TUNE_CENTS) return 'tuner--in-tune'
  return off <= CLOSE_CENTS ? 'tuner--close' : 'tuner--far'
})

const centsText = computed(() => {
  if (reading.value == null) return ''
  const value = cents.value
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value)} ¢`
})

const verdict = computed(() => {
  if (!tunerState.listening) return 'Starting'
  if (reading.value == null) return 'Listening'
  if (direction.value == null) return 'In tune'
  return direction.value === 'flat' ? 'Tune up' : 'Tune down'
})

const levelLength = computed(() => (tunerState.listening ? Math.round(tunerState.level * 100) : 0))

/** Strings that have stayed in tune for a moment since the dialog opened. */
const tunedStrings = reactive(new Set<number>())
let streak = { string: -1, count: 0 }
watch(reading, (value) => {
  if (value == null || Math.abs(value.stringCents) > IN_TUNE_CENTS) {
    streak = { string: -1, count: 0 }
    return
  }
  streak = { string: value.string, count: streak.string === value.string ? streak.count + 1 : 1 }
  if (streak.count >= TUNED_STREAK) tunedStrings.add(value.string)
})
watch(tuning, () => tunedStrings.clear())

// The microphone is on only while the dialog is open.
// immediate: the dialog mounts with its first opening, already open.
watch(isOpen, (open) => {
  if (open) {
    tunedStrings.clear()
    void startTuner()
  } else stopTuner()
}, { immediate: true })
onUnmounted(stopTuner)

const detail = computed(() => {
  if (!tunerState.listening) return 'Waiting for the microphone…'
  const value = reading.value
  if (value == null) return 'Play one string'
  const off = value.stringCents
  const text = Math.abs(off) <= IN_TUNE_CENTS ? 'in tune' : off < 0 ? `${-off} cents flat` : `${off} cents sharp`
  return `${value.note} · ${value.frequency.toFixed(1)} Hz · ${text}`
})
</script>

<style scoped>
.tuner {
  --tuner-state: var(--color-text-faint);
  min-width: 300px;
  gap: 10px;
}

.tuner--in-tune {
  --tuner-state: var(--color-success);
}

.tuner--close {
  --tuner-state: var(--color-warning);
}

.tuner--far {
  --tuner-state: var(--color-danger);
}

.tuner__message {
  margin: 0;
  color: var(--color-text-muted);
}

.tuner__gauge {
  position: relative;
  padding: 6px 4px 0;
  border-radius: 14px;
  background:
    radial-gradient(ellipse 70% 90% at 50% 100%, color-mix(in srgb, var(--tuner-state) 16%, transparent), transparent 70%),
    var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  transition: background 300ms ease;
}

.tuner__gauge svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.tuner__level {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.45;
  transition: stroke-dasharray 90ms linear, stroke-dashoffset 90ms linear;
}

.tuner__zone {
  fill: none;
  stroke-width: 10;
  opacity: 0.28;
  transition: opacity 250ms ease, filter 250ms ease;
}

.tuner__zone--far {
  stroke: var(--color-danger);
}

.tuner__zone--close {
  stroke: var(--color-warning);
}

.tuner__zone--in-tune {
  stroke: var(--color-success);
  stroke-linecap: round;
  opacity: 0.55;
}

.tuner--in-tune .tuner__zone--in-tune {
  opacity: 1;
  filter: drop-shadow(0 0 6px var(--color-success));
}

.tuner__tick {
  stroke: var(--color-text-faint);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.tuner__tick--major {
  stroke: var(--color-text-muted);
  stroke-width: 2;
}

.tuner__label {
  fill: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
}

.tuner__needle {
  transform-box: view-box;
  transform-origin: 160px 176px;
  /* a little overshoot, like a real needle */
  transition: transform 220ms cubic-bezier(0.3, 1.4, 0.5, 1);
}

.tuner__needle-line {
  stroke: var(--tuner-state);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke 200ms ease;
}

.tuner__needle-dot {
  fill: var(--color-surface);
  stroke: var(--tuner-state);
  stroke-width: 3;
  filter: drop-shadow(0 0 4px var(--tuner-state));
  transition: stroke 200ms ease;
}

.tuner--waiting .tuner__needle,
.tuner--idle .tuner__needle {
  opacity: 0.45;
}

.tuner--idle .tuner__needle {
  animation: tuner-sway 2.4s ease-in-out infinite;
}

@keyframes tuner-sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(4deg);
  }
}

.tuner__note {
  fill: var(--color-text);
  font-size: 64px;
  font-weight: 700;
  text-anchor: middle;
  letter-spacing: -1px;
  transition: fill 200ms ease;
}

.tuner--in-tune .tuner__note {
  fill: var(--color-success);
}

.tuner__note-accidental {
  font-size: 30px;
  font-weight: 600;
}

.tuner__note-octave {
  fill: var(--color-text-muted);
  font-size: 20px;
  font-weight: 600;
}

.tuner__cents {
  fill: var(--color-text-muted);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
}

.tuner__direction {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
}

.tuner__arrow {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  color: var(--color-text-faint);
  font-size: 22px;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 150ms ease;
}

.tuner__arrow--on {
  color: var(--tuner-state);
  border-color: var(--tuner-state);
  background: color-mix(in srgb, var(--tuner-state) 14%, transparent);
  transform: scale(1.08);
}

.tuner__verdict {
  justify-self: center;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
}

.tuner--in-tune .tuner__verdict,
.tuner--close .tuner__verdict,
.tuner--far .tuner__verdict {
  color: var(--color-text);
  border-color: var(--tuner-state);
  background: color-mix(in srgb, var(--tuner-state) 14%, transparent);
}

.tuner--waiting .tuner__verdict,
.tuner--idle .tuner__verdict {
  animation: tuner-breathe 1.8s ease-in-out infinite;
}

@keyframes tuner-breathe {
  50% {
    opacity: 0.55;
  }
}

.tuner__strings {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tuner__string {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: baseline;
  line-height: 38px;
  width: 42px;
  height: 42px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-weight: 600;
  transition: border-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.tuner__string-name {
  font-size: 15px;
}

.tuner__string-octave {
  font-size: 10px;
  opacity: 0.8;
}

.tuner__string--tuned {
  border-color: var(--color-success);
  color: var(--color-text);
}

.tuner__string--tuned::after {
  content: '✓';
  position: absolute;
  top: -6px;
  right: -6px;
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--color-success);
  color: var(--color-surface);
  font-size: 11px;
  font-weight: 700;
}

.tuner__string--active {
  border-color: var(--tuner-state);
  color: var(--color-text);
  transform: translateY(-3px) scale(1.1);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tuner-state) 22%, transparent);
}

.tuner__detail {
  min-height: 1.4em;
  text-align: center;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .tuner *,
  .tuner {
    animation: none !important;
    transition: none !important;
  }
}
</style>
