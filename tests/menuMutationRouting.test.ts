import { describe, expect, it, vi } from 'vitest'
import { MODALS } from '../src/assets/js/modals/modalTypes'
import {
  applyTimeMeterToFollowingBlocks,
  findMenuEffectGroup,
  findPreviousTimeMeterChange,
  getDynamicValue,
  resolveNotationModalRequest,
  resolveNoteEffectModalRequest,
  type NoteEffectSelection,
} from '../src/services/menuMutationRouting'
import type { Beat, MeasureMeta, Note } from '../src/types/tab'

vi.mock('../src/assets/js/modals/modalTypes', () => ({
  MODALS: {
    TEXT: { id: 'TEXT' },
    ADD_CHORD: { id: 'ADD_CHORD' },
    MARKER: { id: 'MARKER' },
    REPEAT_ALTERNATIVE: { id: 'REPEAT_ALTERNATIVE' },
    REPETITION: { id: 'REPETITION' },
    TIME_METER: { id: 'TIME_METER' },
    TEMPO: { id: 'TEMPO' },
    BEND: { id: 'BEND' },
    ARTIFICIAL: { id: 'ARTIFICIAL' },
    TREMOLO_BAR: { id: 'TREMOLO_BAR' },
    TREMOLO_PICKING: { id: 'TREMOLO_PICKING' },
    GRACE: { id: 'GRACE' },
    STROKE: { id: 'STROKE' },
  },
}))

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

function createSelection(): NoteEffectSelection {
  return {
    notes: [
      {
        trackId: 0,
        blockId: 1,
        voiceId: 0,
        beatId: 2,
        string: 3,
        note: createNote(),
      },
    ],
    blocks: [1],
    beats: [
      {
        trackId: 0,
        blockId: 1,
        voiceId: 0,
        beatId: 2,
        beat: createBeat(),
      },
    ],
  }
}

describe('menuMutationRouting', () => {
  it('maps dynamic button ids to their dynamic values', () => {
    expect(getDynamicValue('mfDynamic')).toBe('mf')
    expect(getDynamicValue('missingDynamic')).toBe('')
  })

  it('finds and clones the matching effect group', () => {
    const effectGroups = [
      ['slide', 'bend'],
      ['trill', 'grace'],
    ] as const

    const group = findMenuEffectGroup('bend', effectGroups)

    expect(group).toEqual(['slide', 'bend'])
    expect(group).not.toBe(effectGroups[0])
    expect(findMenuEffectGroup('dead', effectGroups)).toBeNull()
  })

  it('opens notation modals only when the target state is absent', () => {
    const context = {
      trackId: 0,
      blockId: 2,
      voiceId: 0,
      beatId: 1,
      beat: createBeat(),
      measureMeta: createMeasureMeta(),
    }

    const markerRequest = resolveNotationModalRequest('addMarker', false, context)
    const textRequest = resolveNotationModalRequest('addText', false, {
      ...context,
      beat: createBeat({ text: 'Intro' }),
    })
    const revertRequest = resolveNotationModalRequest('addMarker', true, context)

    expect(markerRequest?.modal.id).toBe(MODALS.MARKER.id)
    expect(markerRequest?.params).toMatchObject({ trackId: 0, blockId: 2, voiceId: 0 })
    expect(textRequest).toBeNull()
    expect(revertRequest).toBeNull()
  })

  it('opens note-effect modals only when the variable is not already set', () => {
    const selection = createSelection()

    const bendRequest = resolveNoteEffectModalRequest('bend', false, false, selection)
    const skippedRequest = resolveNoteEffectModalRequest('bend', true, false, selection)
    const revertRequest = resolveNoteEffectModalRequest('bend', false, true, selection)

    expect(bendRequest?.modal.id).toBe(MODALS.BEND.id)
    expect(bendRequest?.params).toMatchObject({
      blocks: [1],
      isVariableSet: false,
    })
    expect(skippedRequest).toBeNull()
    expect(revertRequest).toBeNull()
  })

  it('finds the previous time-meter change boundary', () => {
    const measureMeta = [
      createMeasureMeta({ numerator: 4, denominator: 4 }),
      createMeasureMeta({ numerator: 4, denominator: 4 }),
      createMeasureMeta({ numerator: 3, denominator: 4 }),
      createMeasureMeta({ numerator: 3, denominator: 4 }),
    ]

    expect(findPreviousTimeMeterChange(3, measureMeta)).toBe(1)
    expect(findPreviousTimeMeterChange(1, measureMeta)).toBe(0)
  })

  it('applies a time meter forward until another explicit change is reached', () => {
    const measureMeta = [
      createMeasureMeta({ numerator: 4, denominator: 4, timeMeterPresent: true }),
      createMeasureMeta({ numerator: 4, denominator: 4 }),
      createMeasureMeta({ numerator: 4, denominator: 4 }),
      createMeasureMeta({ numerator: 7, denominator: 8, timeMeterPresent: true }),
    ]

    applyTimeMeterToFollowingBlocks(1, measureMeta, 3, 8)

    expect(measureMeta[1]).toMatchObject({ numerator: 3, denominator: 8 })
    expect(measureMeta[2]).toMatchObject({ numerator: 3, denominator: 8 })
    expect(measureMeta[3]).toMatchObject({ numerator: 7, denominator: 8 })
  })

  it('routes note-effect ids through dedicated toolbar groups', () => {
    const effectGroups = [['slide', 'bend'], ['grace']] as const

    expect(findMenuEffectGroup('bend', effectGroups)).toEqual(['slide', 'bend'])
    expect(findMenuEffectGroup('grace', effectGroups)).toEqual(['grace'])
    expect(findMenuEffectGroup('dotted', effectGroups)).toBeNull()
  })
})
