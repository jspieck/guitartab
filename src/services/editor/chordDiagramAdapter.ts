import { refreshChordDiagrams, requestChordDiagramRefresh } from './chordDiagramService'
import { requestBlockRender } from './renderCommands'

export function refreshChordDiagramsWithBlockFallback(
  trackId: number,
  blockId: number,
  voiceId: number,
): void {
  const trackRerendered = refreshChordDiagrams()
  if (!trackRerendered) {
    requestBlockRender(trackId, blockId, voiceId)
  }
}

export { refreshChordDiagrams, requestChordDiagramRefresh }
