import type { LegacySongSnapshot } from '../services/legacy/editorCoreAdapter'
import { editorScopeState, syncEditorScope } from './useEditorScopeState'

export type ReactiveSongData = LegacySongSnapshot

export function applySongSnapshotToState(
  reactiveSongData: ReactiveSongData,
  snapshot: LegacySongSnapshot,
): void {
  reactiveSongData.measures = snapshot.measures
  reactiveSongData.songDescription = snapshot.songDescription
  reactiveSongData.tracks = snapshot.tracks
  reactiveSongData.measureMeta = snapshot.measureMeta
  reactiveSongData.playBackInstrument = snapshot.playBackInstrument
  syncEditorScope(snapshot.currentTrackId, snapshot.currentVoiceId)
  reactiveSongData.currentTrackId = editorScopeState.currentTrackId
  reactiveSongData.currentVoiceId = editorScopeState.currentVoiceId
}

export function getMeasuresForTrackVoice(
  reactiveSongData: ReactiveSongData,
  trackId: number,
  voiceId: number,
) {
  const measures = reactiveSongData.measures?.[trackId] || []
  return measures.map((block) => block?.[voiceId] || [])
}