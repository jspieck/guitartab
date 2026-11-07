import { invalidateAll, invalidateBars, invalidateChords } from '../../stores/renderVersionState'

/**
 * What commands call after changing the song: they bump the version counters the tab reads
 * (`stores/renderVersionState.ts`). The voice is part of the signature for the callers'
 * sake; a bar's version covers both voices.
 */
export function requestBlockRender(trackId: number, blockId: number, _voiceId?: number): void {
  invalidateBars(trackId, [blockId])
}

export function requestBlocksRender(trackId: number, blockIds: number[], _voiceId?: number): void {
  invalidateBars(trackId, blockIds)
}

/** Lanes above the bar (markers, tempo, chords, text): the row height may change. */
export function requestOverBarRender(trackId: number, blockId: number, _voiceId?: number): void {
  invalidateBars(trackId, [blockId])
}

export function requestDurationRender(trackId: number, blockId: number, _voiceId?: number): void {
  invalidateBars(trackId, [blockId])
}

export function requestChordDiagramsRender(): void {
  invalidateChords()
}

export function requestTrackDeleteRender(_trackId?: number): void {
  invalidateAll()
}

export function requestFullRender(): void {
  invalidateAll()
}
