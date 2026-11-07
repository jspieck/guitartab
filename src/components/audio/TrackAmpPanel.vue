<template>
    <!-- Rendered at the end of <body>: the sequencer clips its overflow. -->
    <Teleport to="body">
        <div ref="panelRef" class="amp-panel" role="dialog" :aria-label="`Amp of ${trackName}`" :style="position"
            @keydown.esc.stop="emit('close')">
            <div class="amp-panel__head">
                <span class="amp-panel__title">Amp · {{ trackName }}</span>
                <label class="amp-panel__switch">
                    <input id="trackAmpEnabled" v-model="amp.enabled" type="checkbox" @change="preview" />
                    On
                </label>
            </div>
            <div class="amp-panel__knobs">
                <RotaryKnob v-model="amp.drive" label="Drive" :min="0" :max="1" :default-value="defaults.drive"
                    :format="percent" :disabled="!amp.enabled" @update:model-value="preview" />
                <RotaryKnob v-model="amp.tone" label="Tone" :min="0" :max="1" :default-value="defaults.tone"
                    :format="toneText" :disabled="!amp.enabled" @update:model-value="preview" />
                <label class="amp-panel__cabinet">
                    <span>Cabinet</span>
                    <select id="trackAmpCabinet" v-model="amp.cabinet" aria-label="Cabinet" :disabled="!amp.enabled" @change="preview">
                        <option v-for="option in CABINETS" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                </label>
            </div>
            <p class="amp-panel__hint">{{ hint }}</p>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import RotaryKnob from './RotaryKnob.vue'
import Song from '../../stores/song'
import { defaultAmp, sampleProgram, soundingProgram, trackAmp } from '../../services/audio/ampModel'
import { previewTrackAmp, setTrackAmp } from '../../services/editor/songSettingsCommands'
import type { AmpCabinet, TrackAmp } from '../../types/song'

/**
 * Amp and cabinet of one track, opened from the sequencer's Amp column. Knobs change the
 * sound live; closing the panel records one undo step.
 */
const props = defineProps<{ trackId: number; trackName: string; anchor: DOMRect }>()
const emit = defineEmits<{ close: [] }>()

const CABINETS: { value: AmpCabinet; label: string }[] = [
    { value: 'large', label: '4×12 closed' },
    { value: 'medium', label: '2×12' },
    { value: 'small', label: '1×12 open' },
    { value: 'none', label: 'None (direct)' },
]

const before: TrackAmp | null = Song.tracks[props.trackId]?.amp ? { ...Song.tracks[props.trackId].amp! } : null
const program = soundingProgram(props.trackId)
const defaults = defaultAmp(program)
const amp = reactive<TrackAmp>({ ...trackAmp(props.trackId) })
const panelRef = ref<HTMLElement | null>(null)

const PANEL_WIDTH = 240
const position = computed(() => ({
    left: `${Math.max(8, Math.min(props.anchor.left, window.innerWidth - PANEL_WIDTH - 8))}px`,
    // above the button: the sequencer sits at the bottom of the window
    bottom: `${Math.max(8, window.innerHeight - props.anchor.top + 6)}px`,
}))

const hint = computed(() => {
    if (!amp.enabled) return 'Off: the track plays its instrument as it is.'
    return sampleProgram(program, amp) !== program
        ? 'The clean guitar plays through the amp instead of the distorted samples.'
        : 'The instrument plays through the amp.'
})

function percent(value: number): string {
    return `${Math.round(value * 100)}%`
}

function toneText(value: number): string {
    if (value < 0.35) return `Dark ${percent(value)}`
    if (value > 0.65) return `Bright ${percent(value)}`
    return percent(value)
}

function preview(): void {
    previewTrackAmp(props.trackId, { ...amp })
}

function onPointerDown(event: PointerEvent): void {
    const target = event.target as Element
    // the Amp buttons open, switch and close the panel themselves
    if (!panelRef.value?.contains(target) && !target.closest?.('[data-amp-opener]')) emit('close')
}

onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown)
    panelRef.value?.querySelector<HTMLElement>('input')?.focus()
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown)
    // untouched settings stay as they were (a track without its own keeps the program default)
    const start = before ?? defaults
    const changed = (['enabled', 'drive', 'tone', 'cabinet'] as const).some((key) => amp[key] !== start[key])
    if (changed) setTrackAmp(props.trackId, { ...amp }, before)
    else previewTrackAmp(props.trackId, before)
})
</script>

<style scoped>
.amp-panel {
    position: fixed;
    z-index: 1000;
    width: 240px;
    box-sizing: border-box;
    padding: 8px 10px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    box-shadow: var(--shadow-popover);
    --ap-knob-track: var(--color-border-strong);
    --ap-knob-body: var(--color-surface-raised);
    --ap-knob-edge: var(--color-text-faint);
    --ap-knob-pointer: var(--color-text-secondary);
    --ap-accent: var(--color-accent);
    --ap-muted: var(--color-text-muted);
    --ap-text: var(--color-text);
}
.amp-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.amp-panel__title {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.amp-panel__switch {
    display: flex;
    align-items: center;
    gap: 4px;
}
.amp-panel__knobs {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
}
.amp-panel__cabinet {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.amp-panel__cabinet select {
    max-width: 104px;
    font-size: var(--text-sm);
    letter-spacing: normal;
    text-transform: none;
}
.amp-panel__hint {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: 1.35;
}
</style>
