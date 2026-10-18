import type { BeatRef } from '../../src/assets/js/songData'

/** Minimal Song facade for mocks: just `measures` plus the typed accessors. */
export function createSongMock<T extends { measures: unknown[][][][] }>(data: T) {
  return {
    ...data,
    findBeat(ref: BeatRef) {
      return data.measures[ref.trackId]?.[ref.blockId]?.[ref.voiceId]?.[ref.beatId]
    },
    getBeat(ref: BeatRef) {
      const beat = data.measures[ref.trackId]?.[ref.blockId]?.[ref.voiceId]?.[ref.beatId]
      if (beat == null) throw new RangeError('No beat')
      return beat
    },
  }
}
