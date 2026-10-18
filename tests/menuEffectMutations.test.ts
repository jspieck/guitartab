import { MENU_EFFECT_GROUPS } from '../src/utils/menuUiState'
import { describe, expect, it } from 'vitest'
import {
  applyMenuEffectCollision,
  getMenuEffectVariable,
  handleMenuEffectGroupCollision,
  setMenuEffectVariable,
} from '../src/services/menuEffectMutations'
import type { Beat, MeasureMeta, Note } from '../src/types/tab'

function createBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    duration: 'e',
    notes: [null],
    effects: {
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
    empty: false,
    keySignature: '',
    noteIds: [],
    rhythmId: 0,
    graceObj: '',
    ...overrides,
  } as Beat
}

function createMeasureMeta(overrides: Partial<MeasureMeta> = {}): MeasureMeta {
  return {
    denominator: 4,
    numerator: 4,
    timeMeterPresent: false,
    bpm: 90,
    repeatOpen: false,
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
    dead: false,
    tremoloPicking: false,
    fadeIn: false,
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
    const note = createNote({ slide: true })
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
    expect(note.bendObj).toHaveLength(2)
    expect(previousValues.bend).toBeUndefined()
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
    expect(beat.notes[0]?.bendObj).toBeDefined()
    expect(beat.notes[0]?.slide).toBe(false)
  })

  it('records effect data so undo can restore it after switching the effect off', () => {
    const curve = [{ bendPosition: 0, bendValue: 0, vibrato: 0 }, { bendPosition: 30, bendValue: 150, vibrato: 0 }]
    const note = createNote({ bendObj: curve })
    const beat = createBeat({ notes: [note], effects: { ...createBeat().effects, stroke: { strokeLength: 16, strokeType: 'up' } } })
    const measureMeta = createMeasureMeta()

    const previousBend = applyMenuEffectCollision(beat, note, 0, 'bend', true, measureMeta)
    expect(note.bendObj).toBeUndefined()
    setMenuEffectVariable(beat, note, 'bend', previousBend.bend, measureMeta)
    expect(note.bendObj).toEqual(curve)
    expect(note.bendObj).not.toBe(previousBend.bend) // restored as a copy

    const strokeGroup = MENU_EFFECT_GROUPS.findIndex((group) => (group as readonly string[]).includes('stroke'))
    const previousStroke = applyMenuEffectCollision(beat, null, strokeGroup, 'stroke', true, measureMeta)
    expect(beat.effects.stroke).toBeUndefined()
    setMenuEffectVariable(beat, null, 'stroke', previousStroke.stroke, measureMeta)
    expect(beat.effects.stroke).toEqual({ strokeLength: 16, strokeType: 'up' })
  })

  it('creates default data when a data effect is switched on without its modal', () => {
    const note = createNote({ fret: 7 })
    const beat = createBeat({ notes: [note] })
    setMenuEffectVariable(beat, note, 'trill', true, createMeasureMeta())
    expect(note.trill).toEqual({ fret: 8, period: 4 })
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
