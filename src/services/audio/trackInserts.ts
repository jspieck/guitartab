import Song from '../../stores/song'
import type { EqBand, Track, TrackCompressor } from '../../types/song'
import { eqBandsFlat, sanitizeEqBands } from './masterEqualizer'
import { COMPRESSOR_PRESETS, clampCompressorSettings } from './masterCompressor'

/**
 * A track's channel EQ and compressor as stored on the track (`track.eq`, `track.compressor`,
 * saved in `.gt`). Absent means off: the bus then has no filters or compressor in its chain,
 * so songs without them sound and cost the same as before. Small: part of editor-core.
 */

/** What a channel compressor starts with when it is switched on: gentle bus glue, not a limiter. */
export const DEFAULT_TRACK_COMPRESSOR: TrackCompressor = {
  enabled: true,
  ...COMPRESSOR_PRESETS[1].settings,
}

/** The track's EQ bands (valid), or null when it has none. */
export function eqOf(track: Pick<Track, 'eq'> | undefined): EqBand[] | null {
  return track?.eq == null ? null : sanitizeEqBands(track.eq)
}

/** The track's compressor (valid), or null when it has none. */
export function compressorOf(track: Pick<Track, 'compressor'> | undefined): TrackCompressor | null {
  const stored = track?.compressor
  if (stored == null || typeof stored !== 'object') return null
  return {
    ...clampCompressorSettings({ ...DEFAULT_TRACK_COMPRESSOR, ...stored }),
    enabled: stored.enabled === true,
  }
}

export function trackEq(trackId: number): EqBand[] | null {
  return eqOf(Song.tracks[trackId])
}

export function trackCompressor(trackId: number): TrackCompressor | null {
  return compressorOf(Song.tracks[trackId])
}

/** Whether the channel EQ changes the sound (the mixer's lit EQ button). */
export function trackEqActive(trackId: number): boolean {
  const bands = trackEq(trackId)
  return bands != null && !eqBandsFlat(bands)
}

export function trackCompressorActive(trackId: number): boolean {
  return trackCompressor(trackId)?.enabled === true
}
