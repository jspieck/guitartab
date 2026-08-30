import type { SongStateData } from '../stores/songState'

export type ReactiveSongData = SongStateData

export function getMeasuresForTrackVoice(
  reactiveSongData: ReactiveSongData,
  trackId: number,
  voiceId: number,
) {
  const measures = reactiveSongData.measures?.[trackId] || []
  return measures.map((block) => block?.[voiceId] || [])
}
