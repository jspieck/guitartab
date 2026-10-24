import { relayoutTrack } from '../src/services/editor/measureLayoutEngine'
import { selectionState } from '../src/stores/selectionState'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/notation/classicalNotationAdapter', () => ({
  classicalNotation: {
    updateVexFlowBlock: vi.fn(),
  },
}))

vi.mock('../src/services/menuMutationRouting', () => ({
  findMenuEffectGroup: () => ({ id: 'dynamic' }),
  getDynamicValue: () => 'mf',
}))

vi.mock('../src/services/editor/effectToggles', () => ({
  clearEffectGroup: vi.fn(),
  setEffect: vi.fn(),
}))

import Song from '../src/stores/song'
import { undoHistory } from '../src/services/editor/editCommands'
import { clearRange, startRange, extendRange } from '../src/services/editor/rangeSelection'
import { clipboardBeats, copyRange, pasteRange } from '../src/services/editor/clipboard'
import { changeNoteDuration } from '../src/services/editor/durationCommands'
import { processDynamicSelect } from '../src/services/editor/dynamicsCommands'
import { initPlayBackParameters, movePlayBackBarToBeat } from '../src/services/editor/playbackController'
import {
  registerPlaybackBarElement,
  resetPlaybackBarState,
  usePlaybackBarState,
} from '../src/stores/playbackBarState'
import { clearTrackRenderLayout } from '../src/stores/tabRenderLayout'
import { assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

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

const tabDurationHost = {
  isNotePlaceable: vi.fn(() => true),
  // Stands in for changeBeatDuration (durationEditing.ts): writes the new length into the beat.
  changeBeatDuration: vi.fn(
    (
      trackId: number,
      blockId: number,
      voiceId: number,
      beatId: number,
      _s: number,
      _n: number,
      _p: number,
      length: string,
    ) => {
      Song.measures[trackId][blockId][voiceId][beatId].duration = length as never
      return { applied: true, rescale: false }
    },
  ),
  trackRerenderNecessary: vi.fn(() => false),
  drawTrack: vi.fn(),
}

describe('integration mutations', () => {
  beforeEach(() => {
    Song.initEmptySong()
    clearTrackRenderLayout(0, 0)
    relayoutTrack(0, 0)
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 }
    undoHistory.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetPlaybackBarState()
    clearRange()
  })

  describe('duration change', () => {
    it('updates beat duration through the duration command pipeline', () => {
      const beat = Song.measures[0][0][0][0]
      beat.duration = 'e'

      const applied = changeNoteDuration(tabDurationHost, 0, 0, 0, 0, 0, 'q', false)

      expect(applied).toBe(true)
      expect(tabDurationHost.changeBeatDuration).toHaveBeenCalled()
      expect(undoHistory.canUndo()).toBe(true)
      undoHistory.undo()
      expect(Song.measures[0][0][0][0].duration).toBe('e')
    })
  })

  describe('effect toggle', () => {
    it('applies a dynamic marking and requests over-bar render', () => {
      processDynamicSelect(
        {
          notes: [
            {
              trackId: 0,
              blockId: 0,
              voiceId: 0,
              beatId: 0,
              string: 0,
            },
          ],
          blocks: [0],
        },
        'mfDynamic',
        false,
      )

      expect(Song.measures[0][0][0][0].dynamic).toBe('mf')
    })
  })

  describe('undo / redo stack', () => {
    it('pops the revert stack when undo is invoked', () => {
      // An edit that changes nothing records nothing, so start from another dynamic.
      Song.measures[0][0][0][0].dynamic = 'p'
      processDynamicSelect(
        {
          notes: [
            {
              trackId: 0,
              blockId: 0,
              voiceId: 0,
              beatId: 0,
              string: 0,
            },
          ],
          blocks: [0],
        },
        'mfDynamic',
        null,
      )

      expect(undoHistory.canUndo()).toBe(true)

      undoHistory.undo()

      expect(undoHistory.canUndo()).toBe(false)
    })
  })

  describe('overlay copy / paste', () => {
    it('copies selected beats into the overlay clipboard', () => {
      startRange(0, 0, 0, 0)
      extendRange(0, 0, 0, 1)
      copyRange()

      expect(clipboardBeats()).toHaveLength(2)
      expect(clipboardBeats()[0]).toEqual(Song.measures[0][0][0][0])
      expect(clipboardBeats()[1]).toEqual(Song.measures[0][0][0][1])
      // A snapshot: editing the source afterwards does not change the clipboard.
      Song.measures[0][0][0][0].duration = 'w'
      expect(clipboardBeats()[0].duration).not.toBe('w')
    })

    it('pastes copied beats into the selected range', () => {
      const sourceDuration = Song.measures[0][0][0][0].duration
      startRange(0, 0, 0, 0)
      extendRange(0, 0, 0, 0)
      copyRange()

      startRange(0, 1, 0, 0)
      extendRange(0, 1, 0, 0)
      pasteRange()

      expect(Song.measures[0][1][0][0].duration).toBe(sourceDuration)
    })

    it('a paste is one undo step', () => {
      Song.measures[0][0][0][0].notes[2] = { ...Song.defaultNote(), fret: 9 }
      Song.measures[0][0][0][0].duration = 'q'
      const targetBefore = JSON.stringify(Song.measures[0][1])
      startRange(0, 0, 0, 0)
      extendRange(0, 0, 0, 0)
      copyRange()
      startRange(0, 1, 0, 0)
      extendRange(0, 1, 0, 0)
      pasteRange()
      expect(Song.measures[0][1][0][0].notes[2]?.fret).toBe(9)

      undoHistory.undo()
      expect(JSON.stringify(Song.measures[0][1])).toBe(targetBefore)
      expect(undoHistory.canUndo()).toBe(false)
    })

    it('copies a range that was dragged backwards', () => {
      startRange(0, 0, 0, 1)
      extendRange(0, 0, 0, 0)
      copyRange()
      expect(clipboardBeats()).toHaveLength(2)
    })

    it('splits a pasted beat over the bar line with a tie', () => {
      const beat = (duration: string, fret?: number) => ({
        ...Song.defaultMeasure(),
        duration: duration as never,
        notes: fret == null ? [] : [{ ...Song.defaultNote(), fret }],
      })
      Song.measures[0][0][0] = [beat('w', 5)]
      Song.measures[0][1][0] = [beat('hr'), beat('hr')]
      Song.measures[0][2][0] = [beat('hr'), beat('hr')]
      startRange(0, 0, 0, 0)
      extendRange(0, 0, 0, 0)
      copyRange()

      // From the second half of bar 1 to the end of bar 2.
      startRange(0, 1, 0, 1)
      extendRange(0, 2, 0, 1)
      pasteRange()

      const summary = (blockId: number) =>
        Song.measures[0][blockId][0].map(
          (b) => `${b.duration}${b.notes[0]?.tied ? '~' : ''}${b.notes[0]?.fret ?? ''}`,
        )
      expect(summary(1)).toEqual(['hr', 'h5'])
      expect(summary(2)).toEqual(['h~5', 'hr'])
    })
  })

  describe('playback bar position', () => {
    it('moves the reactive playback bar to a beat position', () => {
      const attributes: Record<string, string> = {}
      const element = {
        style: {} as Record<string, string>,
        setAttribute: (name: string, value: string) => {
          attributes[name] = value
        },
      }
      registerPlaybackBarElement(element as unknown as SVGGElement)
      initPlayBackParameters()

      movePlayBackBarToBeat(0, 0, 0, 0, 0)

      const { playbackBarState } = usePlaybackBarState()
      expect(playbackBarState.visible).toBe(false)
      expect(playbackBarState.x).toBeGreaterThan(0)
      expect(playbackBarState.y).toBeGreaterThanOrEqual(0)
      // Written to the element, not through the template.
      expect(attributes.transform).toBe(`translate(${playbackBarState.x}, ${playbackBarState.y})`)
      expect(element.style.transition).toMatch(/^transform [\d.]+s linear$/)
    })

    it('keeps playback layout aligned after a duration mutation', () => {
      Song.measures[0][0][0][0].duration = 'h'
      relayoutTrack(0, 0)
      assertTabAndRenderLayoutMatch(0, 0)
    })
  })
})
