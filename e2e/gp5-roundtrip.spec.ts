import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test('GP5 export reads back identically, including tempo, strokes, text and chords', async ({ page }) => {
  await waitForEditorShell(page)
  const result = await page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { gp5Writer } = await import('/src/assets/js/GP5Writ.ts')
    const { gProReader } = await import('/src/assets/js/GProReader.ts')

    const strummed = Song.measures[0][0][0][0]
    strummed.effects.stroke = { strokeType: 'down', strokeLength: 16 }
    strummed.effects.vibrato = true // forces the beat-effects block for this beat
    strummed.text = 'Strum'
    strummed.chord = {
      name: 'E',
      capo: 0,
      frets: [0, 0, 1, 2, 2, 0],
      fingers: [],
      chordType: '',
      chordRoot: 'E',
      display: true,
    }

    // Note effects on the first notes of bar 1
    const notes = Song.measures[0][0][0].flatMap((beat) => beat.notes).filter((note) => note != null)
    notes[0]!.bendObj = [
      { bendPosition: 0, bendValue: 0, vibrato: 0 },
      { bendPosition: 60, bendValue: 100, vibrato: 0 },
    ]
    notes[1]!.trill = { fret: notes[1]!.fret + 2, period: 1 }
    notes[2]!.graceObj = {
      duration: 't',
      setOnBeat: 'before',
      dynamic: 'mf',
      transition: 'none',
      fret: 5,
      string: 0,
      height: 0,
      dead: false,
    }
    notes[3]!.artificialStyle = 'N.H.'
    const effectsOf = () => {
      const all = Song.measures[0][0][0].flatMap((beat) => beat.notes).filter((note) => note != null)
      return {
        bend: all[0]!.bendObj?.map((point) => point.bendValue),
        trillFret: all[1]!.trill?.fret,
        expectedTrillFret: all[1]!.fret + 2,
        grace: all[2]!.graceObj ? [all[2]!.graceObj.fret, all[2]!.graceObj.duration] : null,
        harmonic: all[3]!.artificialStyle,
      }
    }

    // Bar-level data
    Object.assign(Song.measureMeta[1], { repeatOpen: true })
    Object.assign(Song.measureMeta[2], {
      repeatClose: 2,
      marker: { text: 'Solo', color: { red: 10, green: 20, blue: 30 } },
      bpm: 120,
    })
    Object.assign(Song.measureMeta[3], { repeatAlternative: 1 })
    const barsOf = () =>
      Song.measureMeta.map((meta) => ({
        bpm: meta.bpm,
        repeatClose: meta.repeatClose,
        repeatAlternative: meta.repeatAlternative,
        marker: meta.marker?.text,
      }))
    const barsBefore = JSON.stringify(barsOf())

    const fingerprint = () =>
      Song.measures[0].map((block) =>
        block[0].map((beat) => [
          beat.duration,
          beat.dotted,
          beat.notes.map((note) => (note == null ? null : [note.fret, note.tied, note.slide])),
        ]),
      )
    const before = JSON.stringify(fingerprint())
    gProReader.processFile('roundtrip.gp5', gp5Writer.buildSongBytes())
    const after = JSON.stringify(fingerprint())

    const effects = effectsOf()
    const sameBars = JSON.stringify(barsOf()) === barsBefore
    const beats = Song.measures[0].flatMap((block) => block[0])
    const first = Song.measures[0][0][0][0]
    return {
      sameNotes: before === after,
      sameBars,
      effects,
      bpm: Song.measureMeta[0].bpm,
      stroke: first.effects.stroke,
      text: first.text,
      chord: first.chord?.name,
      tremoloBars: beats.filter((beat) => beat.effects.tremoloBar != null).length,
    }
  })
  expect(result).toEqual({
    sameNotes: true,
    sameBars: true,
    effects: {
      bend: [0, 100],
      trillFret: expect.any(Number),
      expectedTrillFret: expect.any(Number),
      grace: [5, 't'],
      harmonic: 'N.H.',
    },
    bpm: 90,
    stroke: { strokeType: 'down', strokeLength: 16 },
    text: 'Strum',
    chord: 'E',
    tremoloBars: 0,
  })
  expect(result.effects.trillFret).toBe(result.effects.expectedTrillFret)
})
