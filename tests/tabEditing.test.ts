import { changeNoteDuration } from '../src/services/editor/durationCommands'
import { fillMeasure, fillAvailableSpaceWithRests } from '../src/services/editor/barFilling'
import {
  isNotePlaceable,
  setTuplet,
  changeBeatDuration,
  tabDurationHost,
} from '../src/services/editor/durationEditing'
import { deleteNote } from '../src/services/editor/noteCommands'
import { setFret } from '../src/services/editor/noteCommands'
import { tupletState } from '../src/stores/tupletState'
import { describe, expect, it, vi } from 'vitest'
import Song, { type Beat } from '../src/stores/song'
import { undoHistory } from '../src/services/editor/editCommands'

// Pins what the tab editing code does (note lengths, tuplets, bar filling, note entry)
// so it can be moved without changing behaviour: every step's bar, result and message
// go into one snapshot.

const messages: string[] = []
vi.mock('../src/stores/notificationState', () => ({
  showNotification: (text: string) => messages.push(text),
  notificationState: {},
}))
vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

const api = async () => {
  return {
    changeNoteDuration: (b: number, beat: number, string: number, length: string) =>
      changeNoteDuration(tabDurationHost, 0, b, 0, beat, string, length as never),
    isNotePlaceable: (b: number, beat: number, next: number, previous: number) =>
      isNotePlaceable(0, b, 0, beat, 0, next, previous),
    setTuplet: (b: number, beat: number, size: number) => setTuplet(0, b, 0, beat, size),
    changeBeatDuration: (b: number, beat: number, next: number, previous: number, length: string) =>
      changeBeatDuration(0, b, 0, beat, 0, next, previous, length as never),
    fillMeasure: (b: number) => fillMeasure(0, b, 0),
    fillWithRests: (b: number, ticks: number) => fillAvailableSpaceWithRests(0, b, 0, 0, ticks),
    drawNote: (b: number, beat: number, string: number, fret: number) => setFret(0, b, 0, beat, string, fret),
    deleteNote: (b: number, beat: number, string: number) => deleteNote(0, b, 0, beat, string),
    tuplets: () => tupletState.groups,
  }
}

const beat = (duration: string, frets: Record<number, number> = {}, extra: Partial<Beat> = {}): Beat => {
  const notes: Beat['notes'] = []
  for (const [string, fret] of Object.entries(frets)) notes[Number(string)] = { ...Song.defaultNote(), fret }
  return { ...Song.defaultMeasure(), duration: duration as never, notes, ...extra }
}

const bar = (b: number) =>
  Song.measures[0][b][0].map((x) =>
    [
      x.duration,
      x.dotted ? '.' : '',
      x.doubleDotted ? '..' : '',
      x.tuplet ? `/${x.tuplet}#${x.tupletId}` : '',
      Array.from(x.notes, (n, s) => (n ? ` ${s}:${n.fret}${n.tied ? '~' : ''}` : '')).join(''),
    ].join(''),
  )

describe('tab editing', () => {
  it('keeps its behaviour', async () => {
    const t = await api()
    const log: Record<string, unknown>[] = []
    const step = (name: string, run: () => unknown, bars = [0]) => {
      messages.length = 0
      const result = run()
      log.push({ name, result, messages: [...messages], bars: bars.map(bar) })
    }
    const setBar = (b: number, beats: Beat[]) => {
      Song.measures[0][b][0] = beats
    }

    Song.initEmptySong()
    undoHistory.clear()

    // Note lengths (non-tuplet path through DurationReplacer)
    setBar(0, [beat('q', { 2: 5 }), beat('qr'), beat('hr')])
    step('quarter → eighth', () => t.changeNoteDuration(0, 0, 2, 'e'))
    step('eighth → half (eats rests)', () => t.changeNoteDuration(0, 0, 2, 'h'))
    step('half → whole (no room after a note)', () => {
      t.drawNote(0, 1, 3, 7)
      return t.changeNoteDuration(0, 0, 2, 'w')
    })
    step('undo, undo', () => [undoHistory.undo(), undoHistory.undo()])
    setBar(0, [beat('e', { 0: 3 }), beat('e', { 0: 5 }), beat('qr'), beat('hr')])
    step('placeable: quarter where an eighth note follows', () => t.isNotePlaceable(0, 0, 16, 8))
    step('placeable: quarter on the second eighth (quarter rest follows)', () =>
      t.isNotePlaceable(0, 1, 16, 8),
    )
    step('placeable: shorter is always fine', () => t.isNotePlaceable(0, 0, 4, 8))

    // Tuplets
    setBar(1, [beat('q', { 1: 2 }), beat('q', { 1: 4 }), beat('hr')])
    step('triplet on a quarter note', () => t.setTuplet(1, 0, 3), [1])
    step('quintuplet on the next quarter', () => t.setTuplet(1, 3, 5), [1])
    step('remove the triplet', () => t.setTuplet(1, 1, 3), [1])
    setBar(2, [beat('q', { 0: 1 }, { dotted: true }), beat('e'), beat('hr')])
    step('no tuplet on a dotted note', () => t.setTuplet(2, 0, 3), [2])
    setBar(2, [beat('q', { 0: 1 }), beat('qr'), beat('hr')])
    step(
      'triplet on a quarter, then shorten its first note',
      () => {
        t.setTuplet(2, 0, 3)
        return t.changeBeatDuration(2, 0, 4, 8, 's')
      },
      [2],
    )
    step('lengthen it again (uses the rests in the tuplet)', () => t.changeBeatDuration(2, 0, 8, 4, 'e'), [2])
    step('lengthen beyond the tuplet', () => t.changeBeatDuration(2, 0, 32, 8, 'h'), [2])

    // Bar filling
    setBar(3, [
      beat('e', { 0: 1 }, { tuplet: 3 }),
      beat('e', { 0: 2 }, { tuplet: 3 }),
      beat('e', { 0: 3 }, { tuplet: 3 }),
      beat('q'),
      beat('hr'),
    ])
    step(
      'fillMeasure numbers tuplets',
      () => {
        t.fillMeasure(3)
        return Song.measures[0][3][0].map((x) => x.tupletId)
      },
      [3],
    )
    step(
      'fill 3/4 with rests',
      () => {
        Song.measures[0][4][0] = []
        t.fillWithRests(4, 48)
      },
      [4],
    )
    step(
      'fill a dotted remainder',
      () => {
        Song.measures[0][5][0] = []
        t.fillWithRests(5, 28)
      },
      [5],
    )

    // Note entry
    setBar(6, [beat('qr'), beat('qr'), beat('hr')])
    step('draw a note on a rest', () => t.drawNote(6, 1, 4, 12), [6])
    step('delete it again', () => t.deleteNote(6, 1, 4), [6])
    log.push({ name: 'tuplet bookkeeping', tuplets: JSON.parse(JSON.stringify(t.tuplets())) })

    await expect(`${JSON.stringify(log, null, 1)}\n`).toMatchFileSnapshot('__snapshots__/tabEditing.json')
  })
})
