<template>
  <g class="tab-effects">
    <!-- Slides -->
    <g v-if="hasSlides" class="slides">
      <path
        v-for="(slide, index) in slides"
        :key="`slide-${index}`"
        :d="slide.path"
        stroke-width="1.5"
        fill="none"
        class="slide-path"
      />
    </g>
    
    <!-- Bends -->
    <g v-if="hasBends" class="bends">
      <g v-for="(bend, index) in bends" :key="`bend-group-${index}`">
        <path
          :d="bend.path"
          stroke-width="1"
          fill="none"
          class="bend-path"
        />
        <!-- Bend value text -->
        <text
          v-if="bend.valueText"
          :x="bend.textX"
          :y="bend.textY"
          font-family="Source Sans Pro"
          font-size="10px"
          text-anchor="middle"
          class="bend-text"
        >
          {{ bend.valueText }}
        </text>
        <!-- Bend arrow -->
        <path
          v-if="bend.arrowPath"
          :d="bend.arrowPath"
          stroke-width="1"
          class="bend-arrow"
        />
      </g>
    </g>
    
    <!-- Ties/Bows (for hammer-on, pull-off, tied notes) -->
    <g v-if="hasTies" class="ties">
      <path
        v-for="(tie, index) in ties"
        :key="`tie-${index}`"
        :d="tie.path"
        stroke-width="1"
        fill="none"
        class="tie-path"
      />
    </g>

    <!-- Pull-offs / Hammer-ons indicators -->
    <g v-if="hasPullDowns" class="pull-downs">
      <path
        v-for="(pd, index) in pullDowns"
        :key="`pd-${index}`"
        :d="pd.path"
        stroke-width="1"
        fill="none"
        class="pulldown-path"
      />
    </g>
    
    <!-- Vibrato -->
    <g v-if="hasVibrato" class="vibrato">
      <path
        v-for="(vibrato, index) in vibratos"
        :key="`vibrato-${index}`"
        :d="vibrato.path"
        stroke-width="1"
        fill="none"
        class="vibrato-path"
      />
    </g>

    <!-- Trill -->
    <g v-if="hasTrill" class="trill">
      <g v-for="(trill, index) in trills" :key="`trill-group-${index}`">
        <text
          :x="trill.textX"
          :y="trill.textY"
          font-family="Source Sans Pro"
          font-size="11px"
          font-style="italic"
          class="trill-text"
        >
          tr
        </text>
        <path
          :d="trill.path"
          stroke-width="1"
          fill="none"
          class="trill-wave"
        />
      </g>
    </g>

    <!-- Tremolo Bar -->
    <g v-if="hasTremoloBar" class="tremolo-bar">
      <path
        v-for="(tb, index) in tremoloBars"
        :key="`tb-${index}`"
        :d="tb.path"
        stroke-width="1"
        fill="none"
        class="tremolo-bar-path"
      />
    </g>
    
    <!-- Text effects (P.M., T, etc.) -->
    <g v-if="hasTextEffects" class="text-effects">
      <text
        v-for="(effect, index) in textEffects"
        :key="`text-effect-${index}`"
        :x="effect.x"
        :y="effect.y"
        font-family="Source Sans Pro"
        :font-size="effect.fontSize"
        text-anchor="middle"
        class="effect-text"
        :class="{ 'effect-text-let-ring': effect.text === 'let ring' }"
      >
        {{ effect.text }}
      </text>
    </g>

    <!-- Let Ring indicator -->
    <g v-if="hasLetRing" class="let-ring">
      <g v-for="(lr, index) in letRings" :key="`let-ring-${index}`">
        <line
          :x1="lr.x + 35"
          :y1="lr.y - 3"
          :x2="lr.lineEndX"
          :y2="lr.y - 3"
          stroke-width="1"
          stroke-dasharray="3,2"
          class="let-ring-line"
        />
      </g>
    </g>

    <!-- Tremolo Picking -->
    <g v-if="hasTremoloPicking" class="tremolo-picking">
      <g v-for="(tp, index) in tremoloPickings" :key="`tp-${index}`" :transform="`translate(${tp.x}, ${tp.y})`">
        <path d="M2 4L12 2" stroke-width="2" fill="none" class="tremolo-picking-line" />
        <path v-if="tp.lines >= 2" d="M2 8L12 6" stroke-width="2" fill="none" class="tremolo-picking-line" />
        <path v-if="tp.lines >= 3" d="M2 12L12 10" stroke-width="2" fill="none" class="tremolo-picking-line" />
      </g>
    </g>

    <!-- Grace Notes (small note before main note) -->
    <g v-if="hasGraceNotes" class="grace-notes">
      <g v-for="(gn, index) in graceNotes" :key="`grace-${index}`">
        <text
          :x="gn.x"
          :y="gn.y"
          font-family="Source Sans Pro"
          font-size="10px"
          text-anchor="middle"
          class="grace-fret-text"
        >
          {{ gn.fret }}
        </text>
        <!-- Grace note slur/arc -->
        <path
          :d="gn.slurPath"
          stroke-width="1"
          fill="none"
          class="grace-slur"
        />
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TabBeat } from '../../types/tab'
import { buildTabEffects } from '../../utils/tabEffects'

// Props
interface Props {
  measureData: TabBeat[]
  trackId: number
  voiceId: number
  blockId: number
  stringSpacing: number
  numStrings: number
  measureWidth: number
}

const props = defineProps<Props>()
const effectCollections = computed(() => buildTabEffects({
  measureData: props.measureData,
  trackId: props.trackId,
  voiceId: props.voiceId,
  blockId: props.blockId,
  stringSpacing: props.stringSpacing,
  numStrings: props.numStrings,
}))

const slides = computed(() => effectCollections.value.slides)
const bends = computed(() => effectCollections.value.bends)
const ties = computed(() => effectCollections.value.ties)
const pullDowns = computed(() => effectCollections.value.pullDowns)
const vibratos = computed(() => effectCollections.value.vibratos)
const trills = computed(() => effectCollections.value.trills)
const tremoloBars = computed(() => effectCollections.value.tremoloBars)
const textEffects = computed(() => effectCollections.value.textEffects)
const letRings = computed(() => effectCollections.value.letRings)
const tremoloPickings = computed(() => effectCollections.value.tremoloPickings)
const graceNotes = computed(() => effectCollections.value.graceNotes)

const hasSlides = computed(() => slides.value.length > 0)
const hasBends = computed(() => bends.value.length > 0)
const hasTies = computed(() => ties.value.length > 0)
const hasPullDowns = computed(() => pullDowns.value.length > 0)
const hasVibrato = computed(() => vibratos.value.length > 0)
const hasTrill = computed(() => trills.value.length > 0)
const hasTremoloBar = computed(() => tremoloBars.value.length > 0)
const hasTextEffects = computed(() => textEffects.value.length > 0)
const hasLetRing = computed(() => letRings.value.length > 0)
const hasTremoloPicking = computed(() => tremoloPickings.value.length > 0)
const hasGraceNotes = computed(() => graceNotes.value.length > 0)
</script>

<style scoped>
.tab-effects {
  pointer-events: none;
}

.slide-path {
  stroke: var(--tab-slide);
  stroke-linecap: round;
}

.bend-path {
  stroke: var(--tab-tertiary);
  stroke-linecap: round;
}

.bend-text {
  fill: var(--tab-tertiary);
}

.bend-arrow {
  stroke: var(--tab-tertiary);
  fill: var(--tab-tertiary);
}

.tie-path {
  stroke: var(--tab-tertiary);
  stroke-linecap: round;
}

.pulldown-path {
  stroke: var(--tab-tertiary);
  stroke-linecap: round;
}

.vibrato-path {
  stroke: var(--tab-tertiary);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trill-text {
  fill: var(--tab-tertiary);
}

.trill-wave {
  stroke: var(--tab-tertiary);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tremolo-bar-path {
  stroke: var(--tab-tertiary);
}

.effect-text {
  fill: var(--tab-primary);
  user-select: none;
}

.effect-text-let-ring {
  font-style: italic;
  fill: var(--tab-subtle);
}

.let-ring-line {
  stroke: var(--tab-subtle);
}

.tremolo-picking-line {
  stroke: var(--tab-tertiary);
}

.grace-fret-text {
  fill: var(--tab-secondary);
}

.grace-slur {
  stroke: var(--tab-secondary);
}
</style> 