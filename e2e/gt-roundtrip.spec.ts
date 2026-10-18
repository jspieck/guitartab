import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test.describe('.gt files', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page)
  })

  test('round-trip beat text, chords and drum mixer settings', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      const { serializeSongToGtBytes } = await import('/src/utils/gtSerialization.ts')
      const { gProReader } = await import('/src/assets/js/GProReader.ts')

      const beat = Song.measures[0][1][0][0]
      beat.text = 'Chorus'
      beat.chord = { name: 'A', capo: 0, frets: [0, 2, 2, 2, 0, -1], fingers: [], chordType: '', chordRoot: 'A', display: true }
      audioEngine.noteToDrum.get(38)![2] = 0.5

      const bytes = serializeSongToGtBytes()
      audioEngine.noteToDrum.get(38)![2] = 2
      gProReader.loadGtFromBytes(bytes)

      const loaded = Song.measures[0][1][0][0]
      return {
        text: loaded.text,
        chord: loaded.chord?.name,
        drumMapIsMap: audioEngine.noteToDrum instanceof Map,
        snareVolume: audioEngine.noteToDrum.get(38)?.[2],
      }
    })
    expect(result).toEqual({ text: 'Chorus', chord: 'A', drumMapIsMap: true, snareVolume: 0.5 })
  })

  test('loads files written with the old flag model', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      const { serializeSongContent, compressGtContent } = await import('/src/utils/gtSerialization.ts')
      const { gProReader } = await import('/src/assets/js/GProReader.ts')

      // Rebuild the current song in the legacy shape: flags on every beat and the
      // drum map saved as "{}" (what JSON.stringify did with the Map).
      const parts = serializeSongContent().split('%%%')
      const measures = JSON.parse(parts[1])
      for (const block of measures[0]) {
        for (const beat of block[0]) {
          Object.assign(beat, { textPresent: false, text: '', chordPresent: false, chord: null })
        }
      }
      Object.assign(measures[0][2][0][0], { textPresent: true, text: 'Legacy text' })
      parts[1] = JSON.stringify(measures)
      parts[5] = '{}'
      gProReader.loadGtFromBytes(compressGtContent(parts.join('%%%')))

      const beats = Song.measures[0].flatMap((block) => block[0])
      return {
        legacyText: Song.measures[0][2][0][0].text,
        flagsLeft: beats.filter((beat) => 'textPresent' in beat || 'chordPresent' in beat).length,
        nullChords: beats.filter((beat) => 'chord' in beat).length,
        drumMapIsMap: audioEngine.noteToDrum instanceof Map,
        audible: audioEngine.isDrumAudible(36),
      }
    })
    expect(result).toEqual({ legacyText: 'Legacy text', flagsLeft: 0, nullChords: 0, drumMapIsMap: true, audible: true })
    await expect(page.locator('.tab-row').first()).toBeVisible()
  })
})
