import { computed, shallowReactive } from 'vue'

interface TempoState {
  bpm: number
}

const tempoState = shallowReactive<TempoState>({
  bpm: 90,
})

export function setTempoState(bpm: number): void {
  tempoState.bpm = bpm
}

export function resetTempoState(): void {
  tempoState.bpm = 90
}

export function useTempoState() {
  return {
    tempoState,
    currentTempo: computed(() => tempoState.bpm),
  }
}
