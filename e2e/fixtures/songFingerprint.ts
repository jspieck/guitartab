/**
 * Runs in the page: a JSON-friendly summary of everything a file format should
 * preserve, per bar / beat / note, for round-trip and fixture comparisons.
 * `keys` limits which note/beat properties are compared (formats differ).
 */
export function songFingerprintSource(): string {
  return `(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] != null && obj[k] !== false).map((k) => [k, obj[k]]))
    const tracks = Song.measures.map((track, trackId) => ({
      strings: Song.tracks[trackId]?.strings,
      bars: track.map((block, blockId) => {
        const meta = Song.measureMeta[blockId]
        return {
          meta: { n: meta.numerator, d: meta.denominator, bpm: meta.bpm, repeatOpen: meta.repeatOpen || undefined,
            repeatClose: meta.repeatClose, alternative: meta.repeatAlternative, marker: meta.marker?.text },
          beats: (block[0] ?? []).map((beat) => ({
            d: beat.duration, dotted: beat.dotted || undefined, tuplet: beat.tuplet > 1 ? beat.tuplet : undefined,
            text: beat.text, chord: beat.chord?.name,
            stroke: beat.effects?.stroke, tremoloBar: beat.effects?.tremoloBar?.map((p) => p.value),
            ...pick(beat.effects, ['vibrato', 'fadeIn', 'tap', 'slap', 'pop']),
            notes: beat.notes.map((note) => note == null ? null : {
              fret: note.fret,
              ...pick(note, ['tied', 'dead', 'ghost', 'accentuated', 'heavyAccentuated', 'palmMute', 'stacatto',
                'letRing', 'vibrato', 'slide', 'pullDown', 'tremoloPicking', 'artificialStyle']),
              bend: note.bendObj?.map((p) => p.bendValue),
              grace: note.graceObj ? [note.graceObj.fret, note.graceObj.duration] : undefined,
              trill: note.trill?.fret,
            }),
          })),
        }
      }),
    }))
    return JSON.parse(JSON.stringify(tracks))
  })()`
}
