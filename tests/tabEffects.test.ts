import { describe, expect, it } from 'vitest'
import type { TabBeat, TabNoteData } from '../src/types/tab'
import { buildTabEffects } from '../src/utils/tabEffects'

function createNote(overrides: Partial<TabNoteData> = {}): TabNoteData {
  return {
    fret: 0,
    string: 0,
    ...overrides,
  } as TabNoteData
}

function createBeat(duration: string, notes: Array<TabNoteData | null>): TabBeat {
  return {
    duration,
    notes,
  } as TabBeat
}

describe('buildTabEffects', () => {
  it('creates slide geometry using the next note direction', () => {
    const effects = buildTabEffects({
      measureData: [
        createBeat('q', [createNote({ fret: 5, slide: true }), null, null, null, null, null]),
        createBeat('q', [createNote({ fret: 8 }), null, null, null, null, null]),
      ],
      xOffset: 0,
      stringSpacing: 12,
      numStrings: 6,
    })

    expect(effects.slides).toHaveLength(1)
    expect(effects.slides[0].path).toBe('M28 61L52 67')
  })

  it('deduplicates text effects per beat', () => {
    const effects = buildTabEffects({
      measureData: [
        createBeat('q', [
          createNote({ palmMute: true, string: 0 }),
          createNote({ palmMute: true, string: 1 }),
          null,
          null,
          null,
          null,
        ]),
      ],
      xOffset: 0,
      stringSpacing: 12,
      numStrings: 6,
    })

    expect(effects.textEffects).toEqual([
      {
        text: 'P.M.',
        x: 20,
        y: -25,
        fontSize: '11px',
        beatIndex: 0,
      },
    ])
  })

  it('groups consecutive let-ring beats into one span', () => {
    const effects = buildTabEffects({
      measureData: [
        createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
        createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
        createBeat('q', [createNote(), null, null, null, null, null]),
      ],
      xOffset: 0,
      stringSpacing: 12,
      numStrings: 6,
    })

    expect(effects.letRings).toEqual([
      {
        x: 20,
        y: 87,
        lineEndX: 80,
      },
    ])
  })
})