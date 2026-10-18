import Song from '../assets/js/songData'

/** Whether a track plays through the General MIDI percussion channel. */
export function isDrumTrack(trackId: number): boolean {
  const track = Song.tracks[trackId]
  if (track == null) return false
  if (Song.playBackInstrument[trackId]?.instrument === 'drums') return true
  if (track.channel == null) return track.primaryChannel === 9
  return track.channel.index === 9
}

/** MIDI drum notes that occur anywhere in the song's drum tracks. */
export function getUsedDrumNotes(): Set<number> {
  const used = new Set<number>()
  Song.tracks.forEach((track, trackId) => {
    if (!isDrumTrack(trackId)) return
    const capo = track.capo ?? 0
    for (const block of Song.measures[trackId] ?? []) {
      for (const voice of block ?? []) {
        for (const beat of voice ?? []) {
          for (const note of beat?.notes ?? []) {
            if (note != null && Number.isFinite(note.fret)) used.add(note.fret + capo)
          }
        }
      }
    }
  })
  return used
}

/** Linear gain <-> fader position with a dB taper (bottom = silence). */
export const FADER_MIN_DB = -48
export const FADER_MAX_DB = 12

export function gainToFaderPosition(gain: number): number {
  if (!(gain > 0)) return 0
  const db = 20 * Math.log10(gain)
  return Math.min(1, Math.max(0, (db - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB)))
}

export function faderPositionToGain(position: number): number {
  if (position <= 0.001) return 0
  const db = FADER_MIN_DB + Math.min(1, position) * (FADER_MAX_DB - FADER_MIN_DB)
  return 10 ** (db / 20)
}

export function formatGainDb(gain: number): string {
  if (!(gain > 0)) return '-∞'
  const db = 20 * Math.log10(gain)
  const rounded = Math.abs(db) < 0.05 ? 0 : db
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}
