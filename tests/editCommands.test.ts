import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import Song from '../src/stores/song'
import { typedEventBus } from '../src/utils/typedEventBus'
import {
  editTransaction,
  executeCommand,
  recordBarEdit,
  undoHistory,
  type EditCommand,
} from '../src/services/editor/editCommands'
import {
  deleteLibraryChord,
  setSongTempo,
  setTrackVolume,
  toggleLibraryChordDisplay,
} from '../src/services/editor/songSettingsCommands'
import { processMeasureSelect, processNotationSelect } from '../src/services/editor/notationCommands'
import { processDynamicSelect } from '../src/services/editor/dynamicsCommands'
import type { Chord } from '../src/types/tab'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
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

function beat(blockId = 1, beatId = 0, trackId = 0) {
  return Song.measures[trackId][blockId][0][beatId]
}

function undo() {
  undoHistory.undo()
}

function redo() {
  undoHistory.redo()
}

describe('edit commands', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
  })

  describe('recordBarEdit', () => {
    it('records one undo step that undoes and redoes the change', () => {
      recordBarEdit('Text', { trackId: 0, blockIds: [1] }, () => {
        beat().text = 'Verse'
      })

      expect(undoHistory.canUndo()).toBe(true)
      undo()
      expect(beat().text).toBeUndefined()
      expect(undoHistory.canUndo()).toBe(false)
      redo()
      expect(beat().text).toBe('Verse')
    })

    it('records nothing when the bars did not change', () => {
      const command = recordBarEdit('Nothing', { trackId: 0, blockIds: [1] }, () => {})
      expect(command).toBeNull()
      expect(undoHistory.canUndo()).toBe(false)
    })

    it('restores in place, so held beat and note references stay live', () => {
      const heldBeat = beat()
      heldBeat.notes[2] = { fret: 5 } as never
      const heldNote = heldBeat.notes[2]!
      recordBarEdit('Edit', { trackId: 0, blockIds: [1] }, () => {
        heldNote.fret = 7
        heldBeat.text = 'x'
      })

      undo()
      expect(beat()).toBe(heldBeat)
      expect(beat().notes[2]).toBe(heldNote)
      expect(heldNote.fret).toBe(5)
      expect(heldBeat.text).toBeUndefined()
    })

    it('keeps the holes of sparse note arrays', () => {
      beat().notes = []
      beat().notes[4] = { fret: 3 } as never
      recordBarEdit('Edit', { trackId: 0, blockIds: [1] }, () => {
        beat().notes[1] = { fret: 1 } as never
      })

      undo()
      expect(1 in beat().notes).toBe(false)
      expect(beat().notes[4]?.fret).toBe(3)
      redo()
      expect(beat().notes[1]?.fret).toBe(1)
    })

    it('copes with reactive objects that legacy code stored inside raw song data', () => {
      // e.g. a beat taken from the reactive tree and pushed into a raw array
      toRaw(Song.measures[0][1][0]).push(Song.measures[0][1][0][0])
      recordBarEdit('Text', { trackId: 0, blockIds: [1] }, () => {
        beat().text = 'ok'
      })
      undo()
      expect(beat().text).toBeUndefined()
    })

    it('covers bar settings and several bars in one step', () => {
      recordBarEdit('Repeat', { trackId: 0, blockIds: [1, 2, 2] }, () => {
        Song.measureMeta[1].repeatClose = 3
        beat(2).text = 'b'
      })

      undo()
      expect(Song.measureMeta[1].repeatClose).toBeUndefined()
      expect(beat(2).text).toBeUndefined()
      expect(undoHistory.canUndo()).toBe(false)
    })

    it('a redo after undo does not reuse mutated snapshot objects', () => {
      recordBarEdit('Stroke', { trackId: 0, blockIds: [1] }, () => {
        beat().effects.stroke = { strokeType: 'up', strokeLength: 8 }
      })
      undo()
      redo()
      beat().effects.stroke!.strokeLength = 16 // a later live edit, not recorded
      undo()
      redo()
      expect(beat().effects.stroke?.strokeLength).toBe(8)
    })

    it('marks the song as changed on apply, undo and redo', () => {
      const changed = vi.fn()
      typedEventBus.on('song-data-changed', changed)
      try {
        recordBarEdit('Text', { trackId: 0, blockIds: [1] }, () => {
          beat().text = 'a'
        })
        undo()
        redo()
        expect(changed).toHaveBeenCalledTimes(3)
      } finally {
        typedEventBus.off('song-data-changed', changed)
      }
    })

    it('follows track renumbering when an earlier track is deleted', () => {
      // A second track with its own bars.
      Song.measures[1] = JSON.parse(JSON.stringify(Song.measures[0]))
      recordBarEdit('Text', { trackId: 1, blockIds: [1] }, () => {
        beat(1, 0, 1).text = 'track 2'
      })

      // Delete track 0 the way deleteTrackModalHandler does.
      Song.measures.splice(0, 1)
      undoHistory.adaptToTrackRemove(0)

      undo()
      expect(beat(1, 0, 0).text).toBeUndefined()
      redo()
      expect(beat(1, 0, 0).text).toBe('track 2')
    })

    it('a refused edit (mutate returns false) is rolled back and not recorded', () => {
      const command = recordBarEdit('Refused', { trackId: 0, blockIds: [1] }, () => {
        beat().text = 'half done'
        return false
      })
      expect(command).toBeNull()
      expect(beat().text).toBeUndefined()
      expect(undoHistory.canUndo()).toBe(false)
    })

    it('allTracks snapshots every track and survives deleting one of them', () => {
      Song.measures[1] = JSON.parse(JSON.stringify(Song.measures[0]))
      Song.measures[2] = JSON.parse(JSON.stringify(Song.measures[0]))
      recordBarEdit('Time signature', { trackId: 0, blockIds: [1], allTracks: true }, () => {
        Song.measureMeta[1].numerator = 3
        for (const trackId of [0, 1, 2]) beat(1, 0, trackId).text = `t${trackId}`
      })

      Song.measures.splice(1, 1)
      undoHistory.adaptToTrackRemove(1)

      undo()
      expect(Song.measureMeta[1].numerator).toBe(4)
      expect([beat(1, 0, 0).text, beat(1, 0, 1).text]).toEqual([undefined, undefined])
      redo()
      expect([beat(1, 0, 0).text, beat(1, 0, 1).text]).toEqual(['t0', 't2'])
    })

    it('drops the command when its own track is deleted', () => {
      Song.measures[1] = JSON.parse(JSON.stringify(Song.measures[0]))
      recordBarEdit('Text', { trackId: 1, blockIds: [1] }, () => {
        beat(1, 0, 1).text = 'gone'
      })
      Song.measures.splice(1, 1)
      undoHistory.adaptToTrackRemove(1)
      expect(undoHistory.canUndo()).toBe(false)
    })
  })

  it('executeCommand applies, undoes and redoes', () => {
    const log: string[] = []
    const command: EditCommand = {
      label: 'Test',
      apply: () => log.push('apply'),
      invert: () => log.push('invert'),
    }
    executeCommand(command)
    undo()
    redo()
    expect(log).toEqual(['apply', 'invert', 'apply'])
    expect(undoHistory.peek()).toBe(command)
  })

  describe('transactions', () => {
    it('nested edits become one undo step covering all their bars', () => {
      recordBarEdit('Outer', { trackId: 0, blockIds: [1] }, () => {
        beat(1).text = 'a'
        recordBarEdit('Inner', { trackId: 0, blockIds: [3] }, () => {
          beat(3).text = 'b'
        })
      })
      expect(undoHistory.peek()?.label).toBe('Outer')
      undo()
      expect([beat(1).text, beat(3).text]).toEqual([undefined, undefined])
      expect(undoHistory.canUndo()).toBe(false)
    })

    it('commands executed inside a transaction join its undo step', () => {
      Song.bpm = 100
      editTransaction('Both', () => {
        recordBarEdit('Text', { trackId: 0, blockIds: [1] }, () => {
          beat(1).text = 'x'
        })
        setSongTempo(150)
      })
      undo()
      expect(Song.bpm).toBe(100)
      expect(beat(1).text).toBeUndefined()
      expect(undoHistory.canUndo()).toBe(false)
      redo()
      expect(Song.bpm).toBe(150)
      expect(beat(1).text).toBe('x')
    })

    it('a refused inner edit rolls back only itself', () => {
      recordBarEdit('Outer', { trackId: 0, blockIds: [1] }, () => {
        beat(1).text = 'outer'
        recordBarEdit('Inner', { trackId: 0, blockIds: [2] }, () => {
          beat(2).text = 'inner'
          return false
        })
      })
      expect(beat(1).text).toBe('outer')
      expect(beat(2).text).toBeUndefined()
      undo()
      expect(beat(1).text).toBeUndefined()
    })

    it('an exception rolls the edit back, records nothing and leaves no transaction open', () => {
      expect(() =>
        recordBarEdit('Throws', { trackId: 0, blockIds: [1] }, () => {
          beat(1).text = 'half'
          throw new Error('boom')
        }),
      ).toThrow('boom')
      expect(beat(1).text).toBeUndefined()
      expect(undoHistory.canUndo()).toBe(false)
      recordBarEdit('Next', { trackId: 0, blockIds: [1] }, () => {
        beat(1).text = 'ok'
      })
      expect(undoHistory.peek()?.label).toBe('Next')
    })
  })

  describe('song and track settings', () => {
    it('song tempo: one undoable step, nothing recorded without a change', () => {
      Song.bpm = 120
      expect(setSongTempo(120)).toBeNull()

      setSongTempo(140)
      expect(Song.bpm).toBe(140)
      undo()
      expect(Song.bpm).toBe(120)
      redo()
      expect(Song.bpm).toBe(140)
    })

    it('song tempo after a live drag records the value from before the drag', () => {
      Song.bpm = 100
      Song.bpm = 130 // what the toolbar drag does on mouse move
      setSongTempo(130, 100)
      undo()
      expect(Song.bpm).toBe(100)
    })

    it('track volume', () => {
      Song.playBackInstrument[0].volume = 80
      setTrackVolume(0, 40)
      expect(Song.playBackInstrument[0].volume).toBe(40)
      undo()
      expect(Song.playBackInstrument[0].volume).toBe(80)
    })

    it('chord library: delete and diagram visibility are undoable', () => {
      const chord = { name: 'Am', display: true, frets: [0, 1, 2, 2, 0, -1] } as unknown as Chord
      Song.chordsMap[0] = new Map([['Am', chord]])

      toggleLibraryChordDisplay(0, 'Am')
      expect(Song.chordsMap[0].get('Am')?.display).toBe(false)
      deleteLibraryChord(0, 'Am')
      expect(Song.chordsMap[0].has('Am')).toBe(false)

      undo()
      expect(Song.chordsMap[0].get('Am')?.display).toBe(false)
      undo()
      expect(Song.chordsMap[0].get('Am')?.display).toBe(true)
      expect(deleteLibraryChord(0, 'Missing')).toBeNull()
    })
  })

  describe('toolbar toggles (were not undoable from the toolbar)', () => {
    it('removing beat text from the toolbar can be undone', () => {
      beat().text = 'Keep me'
      processNotationSelect(0, 1, 0, 0, 'addText', false) // what Menu.vue passes
      expect(beat().text).toBeUndefined()
      undo()
      expect(beat().text).toBe('Keep me')
    })

    it('the repeat-start toggle can be undone', () => {
      processMeasureSelect(0, 1, 0, 'openBar', false)
      expect(Song.measureMeta[1].repeatOpen).toBe(true)
      undo()
      expect(Song.measureMeta[1].repeatOpen).toBeFalsy()
    })

    it('a dynamic on several notes is one undo step', () => {
      const notes = [0, 1].map((beatId) => ({ trackId: 0, blockId: 1, voiceId: 0, beatId, string: 0 }))
      processDynamicSelect({ notes, blocks: [1] }, 'ffDynamic', false)
      expect(beat(1, 0).dynamicPresent).toBe(true)
      expect(beat(1, 1).dynamicPresent).toBe(true)

      undo()
      expect(beat(1, 0).dynamicPresent).toBeFalsy()
      expect(beat(1, 1).dynamicPresent).toBeFalsy()
      expect(undoHistory.canUndo()).toBe(false)
    })
  })
})
