import type { Channel, Track } from '../types/song'

/**
 * The General MIDI program a track plays. GPIF and MIDI tracks carry their own; Guitar Pro
 * 3–5 tracks have -1 and play their channel's instrument (`Song.allChannels`).
 */
export function trackProgram(
  track: Pick<Track, 'program' | 'channel'>,
  channels: readonly (Channel | undefined)[],
): number {
  if (track.program != null && track.program >= 0) return track.program
  return channels[track.channel?.index ?? -1]?.cInstrument ?? 0
}
