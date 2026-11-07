<template>
  <div
    ref="scroller"
    class="fretboard"
    :class="{ 'fretboard--input': input, 'fretboard--nut-right': nut === 'right' }"
    :style="boardStyle"
  >
    <div class="fretboard__neck">
      <div class="fretboard__inlays" aria-hidden="true">
        <span v-for="column in columns" :key="column.neckFret" class="fretboard__inlay-cell">
          <span v-for="dot in column.inlays" :key="dot" class="fretboard__inlay"></span>
        </span>
      </div>
      <div
        v-for="row in rows"
        :key="row.string"
        class="fretboard__string"
        :class="{ 'is-selected': input && row.string === selectedString, 'is-sounding': soundingStrings.has(row.string) }"
        :style="{ '--gauge': `${row.gauge}px` }"
        :data-string="row.string"
      >
        <template v-for="(column, index) in columns" :key="column.neckFret">
          <button
            v-if="input"
            type="button"
            class="fretboard__cell"
            :data-column="index"
            :data-fret="column.tabFret"
            :aria-label="`String ${row.label}, fret ${column.tabFret}`"
            @click="emit('pick', row.string, column.tabFret)"
          >
            <span v-if="markAt(row.string, index)" class="fretboard__mark" :class="{ 'is-current': markAt(row.string, index)?.current }">
              {{ column.tabFret }}
            </span>
          </button>
          <div v-else class="fretboard__cell" :data-column="index">
            <span v-if="capoColumn === index" class="fretboard__capo" aria-hidden="true"></span>
            <span v-if="markAt(row.string, index)" class="fretboard__mark guitarNoteMarker" :data-string="row.string" :data-fret="column.neckFret"></span>
          </div>
        </template>
      </div>
    </div>
    <div v-if="input" class="fretboard__numbers" aria-hidden="true">
      <span v-for="column in columns" :key="column.neckFret">{{ column.tabFret }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { stringLine } from '../utils/tabStrings'
import { columnOfNeckFret, fretboardColumns, type FretboardMark } from '../utils/fretboard'

/**
 * A guitar neck in the DOM, highest string on top like the tab. Shows marks (sounding notes,
 * the beat at the cursor); in `input` mode every position is a button that emits
 * `pick(string, tabFret)`, the columns count from the capo and the board scrolls sideways.
 */
const props = withDefaults(defineProps<{
  numStrings: number
  capo?: number
  /** Side the nut is drawn on. */
  nut?: 'left' | 'right'
  input?: boolean
  marks?: readonly FretboardMark[]
  /** Input mode: the cursor's string, highlighted. */
  selectedString?: number | null
  /** Input mode: scrolled into view when it changes. */
  focusNeckFret?: number | null
}>(), {
  capo: 0,
  nut: 'left',
  input: false,
  marks: () => [],
  selectedString: null,
  focusNeckFret: null,
})

const emit = defineEmits<{ pick: [string: number, tabFret: number] }>()

const strings = computed(() => Math.max(2, props.numStrings))
const capo = computed(() => Math.max(0, props.capo))
const columns = computed(() => fretboardColumns(capo.value, props.input))

/** Top to bottom as drawn; lower strings are thicker. */
const rows = computed(() => {
  const count = strings.value
  return Array.from({ length: count }, (_, string) => string)
    .sort((a, b) => stringLine(a, count) - stringLine(b, count))
    .map((string) => ({ string, label: count - string, gauge: 1 + ((count - 1 - string) / (count - 1)) * 2 }))
})

const marksByPosition = computed(() => {
  const map = new Map<string, FretboardMark>()
  for (const mark of props.marks) {
    const column = columnOfNeckFret(mark.neckFret, capo.value, props.input)
    if (column >= 0) map.set(`${mark.string}:${column}`, mark)
  }
  return map
})
const soundingStrings = computed(() => new Set(props.input ? [] : props.marks.map((mark) => mark.string)))

function markAt(string: number, column: number): FretboardMark | undefined {
  return marksByPosition.value.get(`${string}:${column}`)
}

/** The capo is drawn on the neck only when the board counts from the nut. */
const capoColumn = computed(() => (props.input || capo.value === 0 ? -1 : columnOfNeckFret(capo.value, capo.value, false)))

const boardStyle = computed(() => ({
  '--fretboard-columns': columns.value.length - 1,
  '--fretboard-row': props.input ? `${Math.round(Math.min(38, Math.max(28, 216 / strings.value)))}px` : '1fr',
}))

const scroller = ref<HTMLElement | null>(null)

/** Brings a position into view (only if it isn't), centred. */
function revealNeckFret(neckFret: number | null): void {
  const board = scroller.value
  if (!board || neckFret == null) return
  const column = columnOfNeckFret(neckFret, capo.value, props.input)
  const cell = board.querySelector<HTMLElement>(`.fretboard__cell[data-column="${column}"]`)
  if (!cell) return
  const view = board.getBoundingClientRect()
  const box = cell.getBoundingClientRect()
  if (box.left >= view.left && box.right <= view.right) return
  board.scrollLeft += box.left - view.left - (view.width - box.width) / 2
}

watch(() => props.focusNeckFret, (neckFret) => nextTick(() => revealNeckFret(neckFret)))
onMounted(() => revealNeckFret(props.focusNeckFret))
</script>

<style scoped>
.fretboard {
  --fretboard-open: 0.6fr;
  --fretboard-fret: minmax(0, 1fr);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--wood-900);
  user-select: none;
}

.fretboard--input {
  --fretboard-open: 40px;
  --fretboard-fret: 52px;
  height: auto;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 10px;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  touch-action: pan-x;
}

.fretboard__neck,
.fretboard__numbers {
  /* The nut side is chosen by writing direction; borders use logical sides so they follow. */
  direction: ltr;
}

.fretboard--nut-right .fretboard__neck,
.fretboard--nut-right .fretboard__numbers {
  direction: rtl;
}

.fretboard__neck {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  width: max-content;
  min-width: 100%;
  height: 100%;
  padding: 4px 0;
  box-sizing: border-box;
  box-shadow: inset 0 0 11px 0 color-mix(in srgb, var(--gray-1000) 75%, transparent);
}

.fretboard--input .fretboard__neck {
  height: auto;
}

.fretboard__string,
.fretboard__inlays,
.fretboard__numbers {
  display: grid;
  grid-template-columns: var(--fretboard-open) repeat(var(--fretboard-columns), var(--fretboard-fret));
}

.fretboard__string {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
}

.fretboard--input .fretboard__string {
  flex: 0 0 var(--fretboard-row);
}

.fretboard__string.is-selected {
  background: color-mix(in srgb, var(--color-accent) 22%, transparent);
}

/* The string itself, across the whole row. */
.fretboard__string::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: calc(50% - var(--gauge) / 2);
  height: var(--gauge);
  background: var(--string-400);
  box-shadow: 0 1px 0 var(--string-800);
  pointer-events: none;
  z-index: 1;
}

.fretboard__string.is-sounding::before {
  background: var(--string-300);
}

.fretboard__inlays {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fretboard__inlay-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  padding: 18% 0;
}

.fretboard__inlay-cell:not(:has(.fretboard__inlay:nth-child(2))) {
  justify-content: center;
}

.fretboard__inlay {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--gray-350);
  opacity: 0.85;
}

.fretboard__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

/* The fret wire (a pseudo-element, so global button borders can't hide it). */
.fretboard__cell::after {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: 3px;
  background: var(--gray-350);
  pointer-events: none;
}

/* The nut. */
.fretboard__cell:first-child {
  background: color-mix(in srgb, var(--wood-800) 70%, transparent);
}

.fretboard__cell:first-child::after {
  width: 6px;
  background: var(--gray-250);
}

button.fretboard__cell {
  cursor: pointer;
  touch-action: pan-x;
  -webkit-tap-highlight-color: transparent;
}

button.fretboard__cell:active {
  background: color-mix(in srgb, var(--color-accent) 35%, transparent);
}

button.fretboard__cell:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.fretboard__mark {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--red-300);
  pointer-events: none;
}

.fretboard--input .fretboard__mark {
  width: 26px;
  height: 26px;
  background: var(--gray-250);
  color: var(--gray-1000);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fretboard--input .fretboard__mark.is-current {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.fretboard__capo {
  position: absolute;
  inset-block: -4px;
  inset-inline-end: 4px;
  width: 8px;
  border-radius: 3px;
  background: var(--gray-800);
  z-index: 2;
}

.fretboard__numbers {
  width: max-content;
  min-width: 100%;
  padding: 2px 0 4px;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
