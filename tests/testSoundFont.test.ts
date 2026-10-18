import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs build script without types
import { buildTestSoundFont } from '../scripts/make-test-soundfont.mjs'
import sf2Parser from '../src/assets/js/sf2parser'

vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)

// CI plays songs with this generated SoundFont instead of the real one (not in the repo),
// so it has to parse with the app's own SF2 parser and cover every GM program.
describe('generated test SoundFont', () => {
  it('parses into melodic and drum banks with a playable sample on every key', () => {
    const synth = sf2Parser.getSynth()
    const banks = synth.createAllInstruments(buildTestSoundFont())

    expect(banks[0]).toHaveLength(128)
    expect(banks[128]).toHaveLength(128)
    for (const preset of [banks[0][0], banks[0][25], banks[0][127], banks[128][0]]) {
      expect(preset[0].sample.length).toBe(100)
      expect(preset[127].sampleRate).toBe(44100)
    }
    expect(banks[0][25][69].basePlaybackRate).toBeCloseTo(1)
    expect(banks[0][25][81].basePlaybackRate).toBeCloseTo(2)
  })
})
