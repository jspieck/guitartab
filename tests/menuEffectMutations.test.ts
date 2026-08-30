import { describe, expect, it } from 'vitest'
import {
  applyMenuEffectCollision,
  getMenuEffectVariable,
  handleMenuEffectGroupCollision,
  setMenuEffectVariable,
} from '../src/services/menuEffectMutations'
import type { Measure, MeasureMeta, Note } from '../src/types/tab'

function createBeat(overrides: Partial<Measure> = {}): Measure {
  return {
    duration: 'e',
    notes: [null],
    effects: {
      strokePresent: false,
      stroke: { strokeLength: 0, strokeType: 'down' },
      tremoloBarPresent: false,
      tremoloBar: [],
      vibrato: false,
      fadeIn: false,
      tap: false,
      slap: false,
      pop: false,
    },
    dynamic: '',
    dynamicPresent: false,
    otherNotes: [],
    tuplet: null,
    tupletId: 0,
    dotted: false,
    doubleDotted: false,
    textPresent: false,
    text: '',
    chordPresent: false,
    chord: null,
    empty: false,
    keySignature: '',
    noteIds: [],
    rhythmId: 0,
    gracePresent: false,
    graceObj: '',
    ...overrides,
  } as Measure
}

function createMeasureMeta(overrides: Partial<MeasureMeta> = {}): MeasureMeta {
  return {
    denominator: 4,
    numerator: 4,
    timeMeterPresent: false,
    bpmPresent: false,
    bpm: 90,
    repeatOpen: false,
    repeatClosePresent: false,
    repeatClose: 0,
    repeatAlternativePresent: false,
    repeatAlternative: 0,
    markerPresent: false,
    marker: { text: '', color: { red: 255, green: 0, blue: 0 } },
    keySignature: 0,
    automations: [],
    ...overrides,
  } as MeasureMeta
}

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    fret: 5,
    slide: false,
    tied: false,
    tap: false,
    slap: false,
    pop: false,
    pullDown: false,
    stacatto: false,
    accentuated: false,
    heavyAccentuated: false,
    palmMute: false,
    vibrato: false,
    artificialPresent: false,
    trillPresent: false,
    dead: false,
    tremoloPicking: false,
    fadeIn: false,
    gracePresent: false,
    letRing: false,
    ghost: false,
    ...overrides,
  } as Note
}

describe('menuEffectMutations', () => {
  it('reads and writes note-level effect flags', () => {
    const beat = createBeat()
    const note = createNote({ slide: true })
    const measureMeta = createMeasureMeta()

    expect(getMenuEffectVariable(beat, note, 'slide', measureMeta)).toBe(true)

    setMenuEffectVariable(beat, note, 'slide', false, measureMeta)

    expect(note.slide).toBe(false)
  })

  it('toggles an effect within its group and captures previous values', () => {
    const beat = createBeat()
    const note = createNote({ slide: true, bendPresent: false })
    const measureMeta = createMeasureMeta()
    const slideGroupIndex = 0

    const previousValues = applyMenuEffectCollision(
      beat,
      note,
      slideGroupIndex,
      'bend',
      false,
      measureMeta,
    )

    expect(previousValues.slide).toBe(true)
    expect(note.slide).toBe(false)
    expect(note.bendPresent).toBe(true)
  })

  it('applies group collisions across multiple selected notes', () => {
    const beat = createBeat({ notes: [createNote({ slide: true })] })
    const measureMeta = createMeasureMeta()

    const changes = handleMenuEffectGroupCollision(
      [{
        trackId: 0,
        blockId: 1,
        voiceId: 0,
        beatId: 2,
        string: 0,
      }],
      'bend',
      false,
      () => beat,
      () => measureMeta,
    )

    expect(Object.keys(changes)).toHaveLength(1)
    expect(beat.notes[0]?.bendPresent).toBe(true)
    expect(beat.notes[0]?.slide).toBe(false)
  })

  it('allows dead notes and tremolo picking on the same note', () => {
    const beat = createBeat()
    const note = createNote({ tremoloPicking: true, dead: false })
    const measureMeta = createMeasureMeta()

    applyMenuEffectCollision(
      beat,
      note,
      4,
      'dead',
      false,
      measureMeta,
    )

    expect(note.dead).toBe(true)
    expect(note.tremoloPicking).toBe(true)
  })
})
