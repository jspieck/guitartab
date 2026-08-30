import Song from '../../assets/js/songData'
import { tab } from '../../assets/js/tab'
import { notifySongDataChanged } from '../appEvents'
import { typedEventBus } from '../../utils/typedEventBus'
import { getNumChordDiagramRows } from './tabLayoutMetrics'
import { getTrackRenderLayout } from '../../composables/useTabRenderLayout'

let cachedNumChordDiagramRows = -1

export function refreshChordDiagrams(): boolean {
  const layout = getTrackRenderLayout(Song.currentTrackId, Song.currentVoiceId)
  const nextRowCount = getNumChordDiagramRows(Song.currentTrackId, layout?.availableWidth)

  if (cachedNumChordDiagramRows === nextRowCount) {
    notifySongDataChanged()
    return false
  }

  cachedNumChordDiagramRows = nextRowCount
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  return true
}

export function resetChordDiagramRowCache(): void {
  cachedNumChordDiagramRows = -1
}

export function requestChordDiagramRefresh(): void {
  typedEventBus.emit('render.chordDiagrams')
}
