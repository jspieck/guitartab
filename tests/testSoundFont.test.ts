import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs build script without types
import { buildTestSoundFont } from '../scripts/make-test-soundfont.mjs'
import { parseSoundFont, upsampleToMinimumRate } from '../src/services/audio/soundFont/parser'
import { buildBanks } from '../src/services/audio/soundFont/banks'

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

// CI plays songs with this generated SoundFont instead of the real one (not in the repo),
// so it has to parse with the app's own SF2 parser and cover every GM program.
describe('generated test SoundFont', () => {
  it('parses into melodic and drum banks with a playable sample on every key', () => {
    const banks = buildBanks(buildTestSoundFont())

    expect(banks[0]).toHaveLength(128)
    expect(banks[128]).toHaveLength(128)
    for (const preset of [banks[0][0], banks[0][25], banks[0][127], banks[128][0]]) {
      expect(preset[0].sample.length).toBe(100)
      expect(preset[127].sampleRate).toBe(44100)
    }
    expect(banks[0][25][69].basePlaybackRate).toBeCloseTo(1)
    expect(banks[0][25][81].basePlaybackRate).toBeCloseTo(2)
  })

  it('reads the headers', () => {
    const data = parseSoundFont(buildTestSoundFont())
    expect(data.presetHeaders).toHaveLength(257) // 2 × 128 presets + EOP
    expect(data.presetHeaders[130]).toMatchObject({ preset: 2, bank: 128, presetBagIndex: 130 })
    expect(data.sampleHeaders[0]).toMatchObject({
      startLoop: 0,
      endLoop: 100,
      sampleRate: 44100,
      originalPitch: 69,
    })
    expect(data.instruments.map((instrument) => instrument.instrumentName.replace(/\0+$/, ''))).toEqual([
      'Sine',
      'EOI',
    ])
  })

  it('stretches samples below 22.05 kHz', () => {
    // the old parser looped forever on such a sample (the rate it compared never changed)
    const banks = buildBanks(buildTestSoundFont({ sampleRate: 11025 }))
    const key = banks[0][0][69]
    expect(key.sampleRate).toBe(22050)
    expect(key.sample.length).toBe(200)
    expect([key.loopStart, key.loopEnd]).toEqual([0, 200])
    expect(Array.from(upsampleToMinimumRate(Int16Array.of(1, -2), 8000).sample)).toEqual([
      1, 1, 1, 1, -2, -2, -2, -2,
    ])
  })
})
