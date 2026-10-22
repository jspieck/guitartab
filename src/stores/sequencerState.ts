import { reactive } from 'vue'

/** State of the sequencer panel (the bar overview under the tab). */
export const sequencerState = reactive({
  /** Mixer view (mute, solo, faders) instead of the pan/effect knobs. */
  editMode: false,
  /** The bar the playback indicator is on. */
  indicator: { trackId: 0, blockId: 0 },
  /** A bar range dragged in the sequencer; -1 when there is none. */
  rangeStart: -1,
  rangeEnd: -1,
})

export function setSequencerIndicator(trackId: number, blockId: number): void {
  if (sequencerState.indicator.trackId !== trackId || sequencerState.indicator.blockId !== blockId) {
    sequencerState.indicator = { trackId, blockId }
  }
}

export function setSequencerRange(start: number, end: number): void {
  sequencerState.rangeStart = start
  sequencerState.rangeEnd = end
}

export function clearSequencerRange(): void {
  setSequencerRange(-1, -1)
}

// The volume meters are canvases in the faders; the audio engine draws into them every frame.
const meterCanvases = new Map<number, CanvasRenderingContext2D>()

/** `id` 0 is the master fader, track faders are 1-based. */
export function registerMeterCanvas(id: number, context: CanvasRenderingContext2D | null): void {
  if (context) {
    meterCanvases.set(id, context)
  } else {
    meterCanvases.delete(id)
  }
}

export function getMeterCanvas(id: number): CanvasRenderingContext2D | null {
  return meterCanvases.get(id) ?? null
}
