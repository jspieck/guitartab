import { describe, expect, it } from 'vitest'
import type { Measure, MeasureMeta, Note } from '../src/types/tab'
import { deriveMenuSelectionState, getAvailableTupletOptions } from '../src/utils/menuUiState'

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

describe('deriveMenuSelectionState', () => {
  it('collects pressed buttons from the selected note, beat, and block state', () => {
    const state = deriveMenuSelectionState(
      createBeat({
        duration: 'q',
        dotted: true,
        effects: {
          strokePresent: true,
          stroke: { strokeLength: 0, strokeType: 'down' },
          tremoloBarPresent: false,
          tremoloBar: [],
          vibrato: false,
          fadeIn: false,
          tap: false,
          slap: false,
          pop: false,
        },
        textPresent: true,
      }),
      createNote({ slide: true, tied: true }),
      createMeasureMeta({ bpmPresent: true, repeatOpen: true }),
      { canTie: true, hasOverlaySelection: false },
    )

    expect(state.pressedButtonIds).toEqual(expect.arrayContaining([
      'quarterNote',
      'dotted',
      'slide',
      'tied',
      'stroke',
      'addText',
      'bpmMeter',
      'openBar',
    ]))
    expect(state.disabledButtonIds).not.toContain('slide')
  })

  it('disables note effect buttons when no note or overlay selection exists', () => {
    const state = deriveMenuSelectionState(
      createBeat({ duration: 'z' }),
      null,
      createMeasureMeta(),
      { canTie: false, hasOverlaySelection: false },
    )

    expect(state.disabledButtonIds).toEqual(expect.arrayContaining([
      'pullDown',
      'slide',
      'bend',
      'tied',
      'tuplet',
    ]))
  })
})

describe('getAvailableTupletOptions', () => {
  it('returns the wider tuplet set for eighth notes and longer values', () => {
    expect(getAvailableTupletOptions('e')).toEqual([3, 5, 6, 7, 9, 10, 11, 12, 13])
    expect(getAvailableTupletOptions('z')).toEqual([])
  })
})