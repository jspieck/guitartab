import { typedEventBus } from '../../utils/typedEventBus'

export function requestBlockRender(trackId: number, blockId: number, voiceId: number): void {
  typedEventBus.emit('render.block', { trackId, blockId, voiceId })
}

export function requestBlocksRender(trackId: number, blockIds: number[], voiceId: number): void {
  typedEventBus.emit('render.blocks', { trackId, blockIds, voiceId })
}

export function requestOverBarRender(
  trackId: number,
  blockId: number,
  voiceId: number,
  rerender = false,
): void {
  typedEventBus.emit('render.overBar', { trackId, blockId, voiceId, rerender })
}

export function requestDurationRender(trackId: number, blockId: number, voiceId: number): void {
  typedEventBus.emit('render.durations', { trackId, blockId, voiceId })
}

export function requestChordDiagramsRender(): void {
  typedEventBus.emit('render.chordDiagrams')
}

export function requestTrackDeleteRender(trackId: number): void {
  typedEventBus.emit('render.deleteTrack', { trackId })
}