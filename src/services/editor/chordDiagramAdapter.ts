import type { Chord } from '../../types/tab'
import { createChordDiagramSvg } from './chordDiagramSvg'
import { refreshChordDiagrams, requestChordDiagramRefresh } from './chordDiagramService'
import { requestBlockRender } from './renderCommands'

export function createChordDiagramElement(chord: Chord): SVGGElement {
  return createChordDiagramSvg(chord)
}

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
