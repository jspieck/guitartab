import { redrawTrack } from './layoutInvalidation'
import Song from '../../stores/song'
import { notifySongDataChanged } from '../appEvents'
import { typedEventBus } from '../../utils/typedEventBus'
import { getNumChordDiagramRows } from './tabLayoutMetrics'
import { getTrackRenderLayout } from '../../stores/tabRenderLayout'

let cachedNumChordDiagramRows = -1

export function refreshChordDiagrams(): boolean {
  const layout = getTrackRenderLayout(Song.currentTrackId, Song.currentVoiceId)
  const nextRowCount = getNumChordDiagramRows(Song.currentTrackId, layout?.availableWidth)

  if (cachedNumChordDiagramRows === nextRowCount) {
    notifySongDataChanged()
    return false
  }

  cachedNumChordDiagramRows = nextRowCount
  redrawTrack(Song.currentTrackId, Song.currentVoiceId)
  return true
}

export function resetChordDiagramRowCache(): void {
  cachedNumChordDiagramRows = -1
}

export function requestChordDiagramRefresh(): void {
  typedEventBus.emit('render.chordDiagrams')
}
