import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'
import { buildBcfs, buildGpArchive, readShowcaseGpif } from './fixtures/gpFiles'
import { songFingerprintSource } from './fixtures/songFingerprint'

const gpif = readShowcaseGpif()

/** Imports `bytes` as `fileName` and summarizes what the showcase fixture should produce. */
async function importAndSummarize(page: Page, fileName: string, bytes: Uint8Array) {
  return page.evaluate(
    async ({ fileName, bytes }) => {
      const { importSongFile } = await import('/src/services/songImport.ts')
      const { default: Song } = await import('/src/stores/song.ts')
      await importSongFile(fileName, new Uint8Array(bytes), { quiet: true })

      const guitar = Song.measures[0]
      const drums = Song.measures[1]
      const notesOf = (beat: (typeof guitar)[number][number][number]) =>
        beat.notes
          .map((note, string) => (note == null ? null : { string, fret: note.fret }))
          .filter((note) => note != null)
      const bar1 = guitar[0][0]
      const bar2 = guitar[1][0]
      const bar3 = guitar[2][0]
      const bar4 = guitar[3][0]
      return {
        title: Song.songDescription.title,
        author: Song.songDescription.author,
        comments: Song.songDescription.comments,
        tracks: Song.tracks.map((track) => ({
          name: track.name,
          strings: track.strings,
          capo: track.capo,
          channel: track.channel.index,
          program: track.program,
        })),
        bars: Song.measureMeta.map((meta) => ({
          time: `${meta.numerator}/${meta.denominator}`,
          showTime: meta.timeMeterPresent,
          bpm: meta.bpm,
          repeatOpen: meta.repeatOpen,
          repeatClose: meta.repeatClose,
          alternative: meta.repeatAlternative,
          marker: meta.marker?.text,
        })),
        bar1: {
          durations: bar1.map((beat) => beat.duration),
          chord: bar1[0].chord ? [bar1[0].chord.name, bar1[0].chord.frets] : null,
          text: bar1[0].text,
          firstNotes: notesOf(bar1[0]),
          bend: bar1[1].notes[3]?.bendObj?.map((point) => [point.bendPosition, point.bendValue]),
          grace: bar1[2].notes[2]?.graceObj && [
            bar1[2].notes[2].graceObj.fret,
            bar1[2].notes[2].graceObj.duration,
            bar1[2].notes[2].graceObj.setOnBeat,
          ],
          dynamics: bar1.map((beat) => [beat.dynamic, beat.dynamicPresent]),
          stroke: bar1[2].effects.stroke,
        },
        drums: drums[0][0].map((beat) => [beat.duration, notesOf(beat).map((note) => note.fret)]),
        bar2: {
          durations: bar2.map((beat) => [beat.duration, beat.tuplet, beat.dotted]),
          hammer: [bar2[0].notes[4]?.pullDown, bar2[0].notes[4]?.palmMute],
          harmonic: [bar2[3].notes[5]?.artificialStyle, bar2[3].notes[5]?.vibrato],
          slide: bar2[4].notes[1]?.slide,
          dead: bar2[5].notes[0]?.dead,
          secondVoice: guitar[1][1].map((beat) => [beat.duration, beat.notes[0]?.letRing]),
        },
        bar3: {
          tremoloPicking: [bar3[0].notes[3]?.tremoloPicking, bar3[0].notes[3]?.tremoloPickingLength],
          whammy: bar3[0].effects.tremoloBar?.map((point) => [point.position, point.value]),
          tied: [
            bar3[1].notes[3]?.tied,
            bar3[1].notes[3]?.fret,
            bar3[1].notes[3]?.ghost,
            bar3[1].notes[3]?.accentuated,
          ],
        },
        bar4: {
          duration: [bar4[0].duration, bar4[0].dotted],
          trill: bar4[0].notes[2]?.trill,
          heavy: bar4[0].notes[2]?.heavyAccentuated,
        },
        // Empty drum bars are filled with rests for the whole bar.
        emptyDrumBar: drums[2][0].map((beat) => beat.duration),
      }
    },
    { fileName, bytes: Array.from(bytes) as unknown as Uint8Array },
  )
}

const expected = {
  title: 'GPIF Showcase',
  author: 'Fixture author',
  comments: ['Line one', 'Line two'],
  tracks: [
    { name: 'Lead Guitar', strings: [40, 45, 50, 55, 59, 64], capo: 2, channel: 0, program: 29 },
    { name: 'Drums', strings: [0, 0, 0, 0, 0, 0], capo: 0, channel: 9, program: 0 },
  ],
  bars: [
    {
      time: '4/4',
      showTime: true,
      bpm: 100,
      repeatOpen: true,
      repeatClose: undefined,
      alternative: undefined,
      marker: 'Intro',
    },
    {
      time: '4/4',
      showTime: false,
      bpm: undefined,
      repeatOpen: false,
      repeatClose: 2,
      alternative: 3,
      marker: undefined,
    },
    // 90 per dotted quarter = 135 per quarter
    {
      time: '3/4',
      showTime: true,
      bpm: 135,
      repeatOpen: false,
      repeatClose: undefined,
      alternative: undefined,
      marker: undefined,
    },
    {
      time: '3/4',
      showTime: false,
      bpm: undefined,
      repeatOpen: false,
      repeatClose: undefined,
      alternative: undefined,
      marker: undefined,
    },
  ],
  bar1: {
    // The grace beat is folded into the beat it leads into.
    durations: ['q', 'q', 'q', 'qr'],
    chord: ['Am', [0, 1, 2, 2, 0, -1]],
    text: 'Let it ring',
    firstNotes: [{ string: 0, fret: 3 }],
    bend: [
      [0, 0],
      [30, 100],
      [60, 100],
    ],
    grace: [4, 's', 'before'],
    dynamics: [
      ['p', true],
      ['p', false],
      ['f', true],
      ['f', false],
    ],
    stroke: { strokeType: 'down', strokeLength: 16 },
  },
  drums: [
    ['q', [36, 42]],
    ['q', [38]],
    ['hr', []],
  ],
  bar2: {
    durations: [
      ['e', 3, false],
      ['e', 3, false],
      ['e', 3, false],
      ['q', null, true],
      ['e', null, false],
      ['q', null, false],
    ],
    hammer: [true, true],
    harmonic: ['N.H.', true],
    slide: true,
    dead: true,
    secondVoice: [['w', true]],
  },
  bar3: {
    tremoloPicking: [true, 's'],
    whammy: [
      [0, 0],
      [60, -100],
    ],
    tied: [true, 7, true, true],
  },
  bar4: {
    duration: ['h', true],
    // Trill partner pitch 59 on the G string (50) with capo 2 → fret 7.
    trill: { fret: 7, period: 1 },
    heavy: true,
  },
  emptyDrumBar: expect.arrayContaining([expect.stringMatching(/r$/)]),
}

test.describe('Guitar Pro 6/7/8 import', () => {
  test('a GP7 .gp archive imports every effect of the showcase', async ({ page }) => {
    await waitForEditorShell(page)
    expect(await importAndSummarize(page, 'showcase.gp', buildGpArchive(gpif))).toEqual(expected)
    await expect(page.locator('#tabArea, #mainContent').first()).toBeVisible()
  })

  test('the same score in a GP6 .gpx container imports identically', async ({ page }) => {
    await waitForEditorShell(page)
    const gpx = buildBcfs({
      misc: new TextEncoder().encode('x'),
      'score.gpif': new TextEncoder().encode(gpif),
    })
    expect(await importAndSummarize(page, 'showcase.gpx', gpx)).toEqual(expected)
  })

  test('an imported GP7 song survives GP5 export and re-import', async ({ page }) => {
    await waitForEditorShell(page)
    await importAndSummarize(page, 'showcase.gp', buildGpArchive(gpif))
    // GP5 stores notes only up to the highest used string; trailing empty strings don't matter.
    const fingerprint = async () =>
      JSON.parse(
        JSON.stringify(await page.evaluate(songFingerprintSource()), (key, value) => {
          if (key !== 'notes' || !Array.isArray(value)) return value
          const notes = [...value]
          while (notes.length > 0 && notes[notes.length - 1] == null) notes.pop()
          return notes
        }),
      )
    const before = await fingerprint()
    await page.evaluate(async () => {
      const { importSongFile } = await import('/src/services/songImport.ts')
      const { currentSongAsGp5 } = await import('/src/services/gp5Export.ts')
      await importSongFile('roundtrip.gp5', currentSongAsGp5(), { quiet: true })
    })
    expect(await fingerprint()).toEqual(before)
  })

  test('a broken .gp file is rejected and the current song stays', async ({ page }) => {
    await waitForEditorShell(page)
    const result = await page.evaluate(
      async (bytes) => {
        const { importSongFile } = await import('/src/services/songImport.ts')
        const { serializeSongContent } = await import('/src/utils/gtSerialization.ts')
        const before = serializeSongContent()
        let error = ''
        try {
          await importSongFile('broken.gp', new Uint8Array(bytes), { quiet: true })
        } catch (caught) {
          error = (caught as Error).name
        }
        return { error, unchanged: serializeSongContent() === before }
      },
      Array.from(buildGpArchive('<GPIF><Tracks></Tracks></GPIF>')),
    )
    expect(result).toEqual({ error: 'ImportError', unchanged: true })
  })
})
