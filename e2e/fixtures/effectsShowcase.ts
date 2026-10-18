import type { Page } from '@playwright/test'

/**
 * Loads a song into the running app that uses every effect the editor can set,
 * packed densely (stacked on one beat, on neighbouring beats, on the top and
 * bottom string, across row breaks) to expose layout collisions.
 *
 * Runs inside the page through the app's own modules (Vite dev server).
 */
export async function loadEffectsShowcase(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { default: editorCore } = await import('/src/services/editor/editorCore.ts')
    const { tab } = await import('/src/assets/js/tab.ts')
    const { notifySongDataChanged } = await import('/src/services/appEvents.ts')
    const { default: typedEventBus } = await import('/src/utils/typedEventBus.ts')

    type AnyRecord = Record<string, any>
    const TRACK = 0
    const VOICE = 0

    const beat = (blockId: number, beatId: number): AnyRecord => Song.measures[TRACK][blockId][VOICE][beatId]
    const note = (blockId: number, beatId: number, string: number, fret: number, effects: AnyRecord = {}) => {
      editorCore.setNoteAtPosition(TRACK, blockId, VOICE, beatId, string, fret)
      Object.assign(beat(blockId, beatId).notes[string], effects)
    }
    const meta = (blockId: number, values: AnyRecord) => Object.assign(Song.measureMeta[blockId], values)
    const bend = (value: number) => ({
      bendObj: [
        { bendPosition: 0, bendValue: 0, vibrato: 0 },
        { bendPosition: 30, bendValue: value, vibrato: 0 },
        { bendPosition: 60, bendValue: value, vibrato: 0 },
      ],
    })
    const chord = (name: string, frets: number[]) => ({
      chord: { name, capo: 0, frets, fingers: frets.map(() => 0), chordType: '', chordRoot: '', display: true },
    })

    Song.songDescription.title = 'Effects Showcase'
    Song.songDescription.author = 'Layout fixture'

    // Measure 0: measure-level annotations + chord / text / dynamics + palm mute run.
    meta(0, {
      timeMeterPresent: true, bpm: 140,
      marker: { text: 'Intro', color: { red: 200, green: 30, blue: 30 } },
      repeatOpen: true,
    })
    for (let b = 0; b < 4; b += 1) note(0, b, 5, 0, { palmMute: true })
    for (let b = 4; b < 8; b += 1) note(0, b, 4, 2, { letRing: true })
    Object.assign(beat(0, 0), chord('Em', [0, 0, 0, 2, 2, 0]))
    Object.assign(beat(0, 1), { text: 'Verse text annotation' })
    Object.assign(beat(0, 2), { dynamicPresent: true, dynamic: 'f' })
    Object.assign(beat(0, 3), { dynamicPresent: true, dynamic: 'pp' })

    // Measure 1: bends (top + bottom string), vibrato, trill, slide, hammer-on.
    meta(1, { marker: { text: 'Riff', color: { red: 30, green: 90, blue: 200 } } })
    note(1, 0, 0, 12, bend(100))
    note(1, 1, 0, 14, { vibrato: true })
    note(1, 2, 0, 12, bend(50))
    note(1, 3, 2, 9, { trill: { fret: 11, period: 16 } })
    note(1, 4, 5, 3, bend(100))
    note(1, 5, 1, 5, { slide: true })
    note(1, 6, 1, 8)
    note(1, 6, 3, 7, { pullDown: true })
    note(1, 7, 3, 9)
    Object.assign(beat(1, 0), chord('A7', [0, 2, 0, 2, 0, -1]))
    Object.assign(beat(1, 4), chord('Dsus4', [3, 3, 2, 0, -1, -1]))

    // Measure 2: every articulation token stacked on one beat, then dense neighbours.
    meta(2, { bpm: 96 })
    note(2, 0, 0, 3, { palmMute: true, accentuated: true })
    note(2, 0, 1, 3, { tap: true, heavyAccentuated: true })
    note(2, 0, 2, 3, { pop: true, stacatto: true })
    note(2, 0, 3, 3, { slap: true, fadeIn: true, artificialStyle: 'N.H.' })
    note(2, 1, 0, 5, { tap: true, accentuated: true, letRing: true })
    note(2, 2, 0, 7, { stacatto: true, heavyAccentuated: true, vibrato: true })
    note(2, 3, 2, 4, { tremoloPicking: true, tremoloPickingLength: 'e' })
    note(2, 4, 2, 4, { tremoloPicking: true, tremoloPickingLength: 's' })
    note(2, 5, 2, 4, { tremoloPicking: true, tremoloPickingLength: 't' })
    note(2, 6, 3, 5, { graceObj: { duration: 's', setOnBeat: 'before', dynamic: 'f', transition: 'slide', fret: 3, string: 3, height: 0, dead: false } })
    note(2, 7, 4, 0, { dead: true })
    note(2, 7, 5, 5, { ghost: true })
    Object.assign(beat(2, 4).effects, {
      tremoloBar: [{ position: 0, value: 0, vibrato: 0 }, { position: 30, value: -100, vibrato: 0 }, { position: 60, value: 0, vibrato: 0 }],
    })
    Object.assign(beat(2, 1), { text: 'Text' })
    Object.assign(beat(2, 2), { text: 'Neighbour text' })
    Object.assign(beat(2, 5), { dynamicPresent: true, dynamic: 'mf' })

    // Measure 3: repeat close + alternative ending, strokes, tuplet, 16ths, ties.
    meta(3, {
      repeatClose: 3,
      repeatAlternative: 1,
      marker: { text: 'Chorus', color: { red: 20, green: 140, blue: 60 } },
    })
    for (let string = 0; string < 6; string += 1) note(3, 0, string, [0, 1, 0, 2, 3, 0][string])
    beat(3, 0).effects.stroke = { strokeLength: 8, strokeType: 'down' }
    for (let string = 0; string < 4; string += 1) note(3, 1, string, [3, 3, 0, 0][string])
    beat(3, 1).effects.stroke = { strokeLength: 8, strokeType: 'up' }
    const tupletId = 9000
    tab.tupletManager[tupletId] = { originalDuration: 'e' }
    for (let b = 2; b < 5; b += 1) {
      note(3, b, 1, b)
      Object.assign(beat(3, b), { tuplet: 3, tupletId })
    }
    note(3, 5, 2, 2)
    note(3, 6, 2, 2, { tied: true })
    note(3, 7, 2, 2, { tied: true })
    Object.assign(beat(3, 5), chord('G', [3, 0, 0, 0, 2, 3]))
    Object.assign(beat(3, 6), { dynamicPresent: true, dynamic: 'ff' })

    // Measure 4/5: a second alternative ending, back-to-back markers and tempo, more text.
    meta(4, {
      repeatAlternative: 2,
      marker: { text: 'Bridge part', color: { red: 120, green: 40, blue: 160 } },
      bpm: 180,
    })
    meta(5, { marker: { text: 'Solo', color: { red: 200, green: 120, blue: 0 } }, timeMeterPresent: true })
    for (let b = 0; b < 8; b += 1) note(4, b, b % 6, 10 + b, b % 2 === 0 ? bend(25 * ((b % 4) + 1)) : { vibrato: true })
    for (let b = 0; b < 8; b += 1) note(5, b, 0, 15, { letRing: b < 4, palmMute: b >= 4, accentuated: b % 3 === 0 })
    Object.assign(beat(5, 0), { text: 'A long text that runs into the next beats' })
    Object.assign(beat(5, 0), chord('C', [0, 1, 0, 2, 3, -1]))
    Object.assign(beat(5, 7), { dynamicPresent: true, dynamic: 'ppp' })

    notifySongDataChanged()
    typedEventBus.emit('render.all')
  })
}
