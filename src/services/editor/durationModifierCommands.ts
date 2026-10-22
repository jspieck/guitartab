import { selectionState } from '../../stores/selectionState'
import fastdom from 'fastdom'
import Duration from '../../utils/duration'
import AppManager from '../../assets/js/appManager'
import Song from '../../assets/js/songData'
import { recordBarEdit } from './editCommands'
import { tab, Tab } from '../../assets/js/tab'
import { classicalNotation } from './classicalNotationAdapter'
import type { Beat } from '../../types/tab'
import { requestDurationRender } from './renderCommands'
import { typedEventBus } from '../../utils/typedEventBus'
import { noteLengthOf } from '../../utils/durationUtils'

export function toggleBeatDotModifier(
  beat: Beat,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  previousDuration: number,
  id: 'dotted' | 'doubleDotted',
): boolean {
  if (id === 'dotted') {
    if (beat.dotted) {
      beat.dotted = false
    } else if (
      tab.isNotePlaceable(trackId, blockId, voiceId, beatId, string, previousDuration * 1.5, previousDuration)
    ) {
      beat.dotted = true
    } else {
      return false
    }

    if (beat.doubleDotted) {
      beat.doubleDotted = false
    }

    return true
  }

  if (beat.doubleDotted) {
    beat.doubleDotted = false
  } else if (
    tab.isNotePlaceable(trackId, blockId, voiceId, beatId, string, previousDuration * 1.75, previousDuration)
  ) {
    beat.doubleDotted = true
  } else {
    return false
  }

  if (beat.dotted) {
    beat.dotted = false
  }

  return true
}

export function handleTupletSpecialSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  tupleSel: number,
): boolean {
  // setTuplet returns false when refused and nothing on success.
  if (tab.setTuplet(trackId, blockId, voiceId, beatId, tupleSel) === false) {
    return false
  }
  requestDurationRender(trackId, blockId, voiceId)
  tab.drawTrack(trackId, voiceId, true, null)
  return true
}

export function finalizeSpecialDurationChange(
  beat: Beat,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  previousDuration: number,
): void {
  const newDuration = Duration.getDurationOfNote(beat, true)
  if (previousDuration !== newDuration) {
    const rescaleNecessary = tab.changeBeatDuration(
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      newDuration,
      previousDuration,
      beat.duration,
    )
    requestDurationRender(trackId, blockId, voiceId)
    classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)

    if (rescaleNecessary) {
      tab.drawTrack(trackId, voiceId, true, null)
    }
  }
}

export function setNotesTied(
  trackId: number,
  voiceId: number,
  blockIdBegin: number,
  blockIdEnd: number,
  beatIdStart: number,
  beatIdEnd: number,
  string: number,
  fret: number,
  shouldBeTied: boolean,
  noteTiedTo: { blockId: number; beatId: number },
): void {
  for (let blockId = blockIdBegin; blockId <= blockIdEnd; blockId += 1) {
    const firstBeatId = blockId === blockIdBegin ? beatIdStart : 0
    const lastBeatId =
      blockId === blockIdEnd ? beatIdEnd : Song.measures[trackId][blockId][voiceId].length - 1
    for (let beatId = firstBeatId; beatId <= lastBeatId; beatId += 1) {
      const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
      const selectedNote = beat.notes[string]
      const noteTiedToCopy = { ...noteTiedTo }
      if (selectedNote == null) {
        beat.notes[string] = {
          ...Song.defaultNote(),
          fret,
          tied: true,
          tiedTo: noteTiedToCopy,
        }
        beat.duration = noteLengthOf(beat.duration)
      } else {
        selectedNote.tied = shouldBeTied
        selectedNote.tiedTo = noteTiedToCopy
        if (shouldBeTied === false) {
          Tab.deleteNote(trackId, blockId, voiceId, beatId, string)
          return
        }
        selectedNote.fret = fret
      }
    }
  }
}

export function processTiedButtonPress(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  tiedTarget: { blockId: number; beatId: number },
  noteTiedTo: { blockId: number; beatId: number },
): void {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  let shouldBeTied = false
  if (beat.notes[string] == null || beat.notes[string]!.tied == null || beat.notes[string]!.tied === false) {
    shouldBeTied = true
  }
  const tiedToNote = Song.getBeat({
    trackId,
    blockId: tiedTarget.blockId,
    voiceId,
    beatId: tiedTarget.beatId,
  }).notes[string]
  if (tiedToNote != null) {
    tiedToNote.tieBegin = shouldBeTied
    const { fret } = tiedToNote
    setNotesTied(
      trackId,
      voiceId,
      tiedTarget.blockId,
      blockId,
      tiedTarget.beatId + 1,
      beatId,
      string,
      fret,
      shouldBeTied,
      noteTiedTo,
    )
  }

  const blocks = []
  for (let bId = tiedTarget.blockId; bId <= blockId; bId += 1) {
    blocks.push(bId)
  }
  typedEventBus.emit('render.blocks', { trackId, blockIds: blocks, voiceId })
}

export function processSpecialSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  tupleSel: number,
  id: string,
  noteTiedTo: { blockId: number; beatId: number } | null,
): void {
  fastdom.mutate(() => {
    const beat = Song.findBeat({ trackId, blockId, voiceId, beatId })
    if (beat == null) {
      return
    }
    const blockIds = [blockId]
    for (let tiedBlock = noteTiedTo?.blockId ?? blockId; tiedBlock < blockId; tiedBlock += 1) {
      blockIds.push(tiedBlock)
    }
    recordBarEdit(SPECIAL_LABELS[id] ?? 'Note length', { trackId, blockIds }, () => {
      const previousDuration = Duration.getDurationOfNote(beat, true)
      if (id === 'tuplet') {
        return handleTupletSpecialSelect(trackId, blockId, voiceId, beatId, tupleSel)
      }

      if (id === 'tied' && noteTiedTo != null) {
        processTiedButtonPress(trackId, blockId, voiceId, beatId, string, noteTiedTo, noteTiedTo)
        return true
      }

      if (id !== 'dotted' && id !== 'doubleDotted') {
        return false
      }

      if (!toggleBeatDotModifier(beat, trackId, blockId, voiceId, beatId, string, previousDuration, id)) {
        return false
      }
      finalizeSpecialDurationChange(beat, trackId, blockId, voiceId, beatId, string, previousDuration)
      return true
    })
  })
}

const SPECIAL_LABELS: Record<string, string> = {
  tuplet: 'Tuplet',
  tied: 'Tie',
  dotted: 'Dot',
  doubleDotted: 'Double dot',
}

export function noteLengthSpecialSelect(
  id: string,
  selectedTuplet: number,
  noteTiedTo: { blockId: number; beatId: number } | null,
): boolean {
  if (AppManager.duringTrackCreation) {
    return false
  }
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  processSpecialSelect(trackId, blockId, voiceId, beatId, string, selectedTuplet, id, noteTiedTo)
  return true
}
