import Song from '../../stores/song'
import type { Dots } from '../../utils/durationReplacer'
import { tupletState } from '../../stores/tupletState'
import { selectionState } from '../../stores/selectionState'
import { noteInputState } from '../../stores/noteInputState'
import { showNotification } from '../../stores/notificationState'
import type { BeatDuration } from '../../types/tab'
import Duration from '../../utils/duration'
import { isRestDuration, noteLengthOf, restOf } from '../../utils/durationUtils'
import { changeBeatDurationViaReplacer } from './durationReplacerAdapter'
import { barWidthChangesRows } from './measureLayoutEngine'
import { addNoteToBlock, tupletOnlyRests } from './noteCommands'
import { redrawTrack } from './layoutInvalidation'
import type { TabDurationHost } from './durationCommands'

/**
 * Changing note lengths and tuplets inside a bar. Plain beats go through the
 * DurationReplacer; tuplets keep their own rules here.
 */

/** Whether a beat can grow from `previousDuration` to `newDuration` ticks (shows a message when not). */
export function isNotePlaceable(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  newDuration: number,
  previousDuration: number,
) {
  const blockObj = Song.measures[trackId][blockId][voiceId]

  if (newDuration > previousDuration) {
    if (blockObj[beatId].tuplet == null) {
      const diff = newDuration - previousDuration
      let reachedSpace = 0
      for (let p = beatId + 1; p < blockObj.length; p += 1) {
        // check for rests that can be deleted
        if (blockObj[p].tuplet == null) {
          if (blockObj[p].duration.length > 1) {
            reachedSpace += Duration.getDurationOfNote(blockObj[p], false)
          }
        } else {
          const tupRe = tupletOnlyRests(p, blockObj)
          if (tupRe.onlyRests) {
            reachedSpace += Duration.getDurationOfType(
              tupletState.groups[blockObj[p].tupletId].originalDuration,
            )
          }
          p = tupRe.lastIndex
        }

        if (reachedSpace >= diff) {
          const currentDiff = reachedSpace - diff
          if (!(currentDiff < 1 || (currentDiff - Math.floor(currentDiff) === 0.25 && currentDiff < 3.25))) {
            break
          }
        }
      }
      const currentDiff = reachedSpace - diff
      if (
        reachedSpace < diff ||
        (currentDiff > 0 && currentDiff < 1) ||
        (currentDiff - Math.floor(currentDiff) === 0.25 && currentDiff < 3.25)
      ) {
        showNotification('Not enough space in the bar.', 'error')
        return false
      }
    } else {
      const startTupletId = blockObj[beatId].tupletId
      // new duration is longer than previous duration
      // check if so many rests can be deleted that note length is reached
      const diff = newDuration - previousDuration

      let reachedSpace = 0
      for (let p = beatId + 1; p < blockObj.length; p += 1) {
        // check for rests that can be deleted
        if (blockObj[p].tuplet == null || blockObj[p].tupletId !== startTupletId) {
          break
        } else if (blockObj[p].duration.length !== 1) {
          reachedSpace += Duration.getDurationOfNote(blockObj[p], true)
          if (reachedSpace >= diff) {
            const currentDiff = reachedSpace - diff
            if (!(
              currentDiff < 1 ||
              (currentDiff - Math.floor(currentDiff) === 0.25 && currentDiff < 3.25)
            )) {
              break
            }
          }
        }
      }
      const currentDiff = reachedSpace - diff
      if (
        reachedSpace < diff ||
        (currentDiff > 0 && currentDiff < 1) ||
        (currentDiff - Math.floor(currentDiff) === 0.25 && currentDiff < 3.25)
      ) {
        showNotification('Not enough space in the bar.', 'error')
        return false
      }
    }
  }
  return true
}

/** Turns a beat into a tuplet of `tupletSelection`, or a tuplet beat back into a plain one. */
export function setTuplet(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatIdIn: number,
  tupletSelection: number,
) {
  let beatId = beatIdIn
  const block = Song.measures[trackId][blockId][voiceId]
  const beat = block[beatId]

  if (beat.tuplet == null || beat.tuplet === 0) {
    // Try to place the tuplet
    const currentDuration = Duration.getDurationOfNote(beat, true)

    if (beat.dotted || beat.doubleDotted || currentDuration <= 1) {
      showNotification('Tuplets of dotted notes or 128ths are not possible yet.', 'error')
      return false
    }
    // set note to new length
    beat.tuplet = tupletSelection

    // fill in the new tuplet rests after the first tuplet note
    const thisTupletId = tupletState.nextId
    const subFactor = Duration.tupletToNumOfSubstitutedNotes(tupletSelection)
    // we place a tuplet with half length
    let newDuration: BeatDuration = Duration.typeToString(currentDuration / subFactor)
    // set own note to new length
    const oldDuration = beat.duration
    if (isRestDuration(oldDuration)) {
      beat.duration = restOf(newDuration)
    } else {
      beat.duration = newDuration
    }
    beat.tupletId = thisTupletId

    tupletState.groups[thisTupletId] = { originalDuration: oldDuration }

    // check if notes must be tied
    const notes = []
    for (let k = 0; k < Song.tracks[trackId].numStrings; k += 1) {
      if (beat.notes[k] != null) {
        if (beat.notes[k]!.tieBegin) {
          notes[k] = { fret: beat.notes[k]!.fret, tied: true }
        } else if (beat.notes[k]!.tied) {
          const noteTiedTo = beat.notes[k]!.tiedTo
          const { fret } = Song.measures[trackId][noteTiedTo.blockId][voiceId][noteTiedTo.beatId].notes[
            k
          ] ?? { fret: -1 }
          notes[k] = { fret, tied: true }
        }
      }
    }

    if (notes.length === 0) {
      newDuration = restOf(newDuration)
    }

    for (let j = 1; j < tupletSelection; j += 1) {
      const notesObj = JSON.parse(JSON.stringify(notes))
      block.splice(beatId + j, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: newDuration,
          notes: notesObj,
          tuplet: tupletSelection,
          tupletId: thisTupletId,
        },
      })
    }
    tupletState.nextId += 1
  } else {
    // only keep selected note and delete rest
    const nextBeat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    const tupletIdToSearchFor = nextBeat.tupletId
    // '' marks a cleared slot; keep the beat's length rather than storing an empty one
    nextBeat.duration = tupletState.groups[nextBeat.tupletId].originalDuration || nextBeat.duration
    // dont keep dot if tuplet is eliminated
    nextBeat.dotted = false
    nextBeat.doubleDotted = false
    nextBeat.tuplet = -1
    nextBeat.tupletId = -1

    // TODO fix Mark of false position
    // delete all beats with same tupletId
    for (let i = 0; i < Song.measures[trackId][blockId][voiceId].length; i += 1) {
      const beatIn = Song.getBeat({ trackId, blockId, voiceId, beatId: i })
      if (i !== beatId && beatIn.tuplet != null && beatIn.tupletId === tupletIdToSearchFor) {
        Song.measures[trackId][blockId][voiceId].splice(i, 1)
        if (i < beatId) {
          beatId -= 1
        }
        i -= 1
      }
    }
    tupletState.groups[nextBeat.tupletId] = { originalDuration: '' }
    selectionState.cursor.beatId = beatId
  }
  // New notes take the length of the beat the cursor lands on.
  noteInputState.noteLength = noteLengthOf(Song.getBeat({ trackId, blockId, voiceId, beatId }).duration)
  return true
}

/** Takes `diff` ticks from the rests after a tuplet beat, filling any remainder with short rests. */
function deleteRestForTuplet(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  diff: number,
) {
  const blockObj = Song.measures[trackId][blockId][voiceId]
  const startTupletId = blockObj[beatId].tupletId
  const startTuplet = blockObj[beatId].tuplet
  // Delete all found rest notes and move notes after the deleted rests to new position
  let reachedSpace = 0
  let currentDiff: number
  let p: number
  for (p = beatId + 1; p < blockObj.length; p += 1) {
    // MOVE NOTES RIGHT
    if (blockObj[p].duration.length !== 1) {
      reachedSpace += Duration.getDurationOfNote(blockObj[p], true)
      blockObj.splice(p, 1)
      p -= 1

      if (reachedSpace >= diff) {
        currentDiff = reachedSpace - diff
        if (!(
          (currentDiff > 0 && currentDiff < 1) ||
          (currentDiff - Math.floor(currentDiff) === 0.25 && currentDiff < 3.25)
        )) {
          p += 1
          break
        }
      }
    }
  }

  currentDiff = reachedSpace - diff
  // insert new rest that not too much gets deleted
  // (e.g. quarter rest deleted, but only eighth needed)
  let insertPosition = p
  if (currentDiff - Math.floor(currentDiff) === 0.25) {
    // add a dotted 64th and double dotted 64th
    blockObj.splice(insertPosition, 0, {
      ...Song.defaultMeasure(),
      ...{
        duration: 'zr',
        dotted: true,
        notes: [],
        tuplet: startTuplet,
        tupletId: startTupletId,
      },
    })
    p += 1
    insertPosition += 1
    blockObj.splice(insertPosition, 0, {
      ...Song.defaultMeasure(),
      ...{
        duration: 'zr',
        doubleDotted: true,
        notes: [],
        tuplet: startTuplet,
        tupletId: startTupletId,
      },
    })
    p += 1
    currentDiff -= 3.25
  } else if (currentDiff - Math.floor(currentDiff) === 0.5) {
    // add a dotted 64th and double dotted 64th
    blockObj.splice(insertPosition, 0, {
      ...Song.defaultMeasure(),
      ...{
        duration: 'zr',
        dotted: true,
        notes: [],
        tuplet: startTuplet,
        tupletId: startTupletId,
      },
    })
    p += 1
    currentDiff -= 1.5
  } else if (currentDiff - Math.floor(currentDiff) === 0.75) {
    // add a double dotted 64th
    blockObj.splice(insertPosition, 0, {
      ...Song.defaultMeasure(),
      ...{
        duration: 'zr',
        doubleDotted: true,
        notes: [],
        tuplet: startTuplet,
        tupletId: startTupletId,
      },
    })
    p += 1
    currentDiff -= 1.75
  }

  for (let l = 0, n = currentDiff; l < n; l += 1) {
    if (currentDiff <= 0) break
    // fill with greatest 2potence and fill the rest with eighths
    const nearest2Potence = Duration.greatestNoteValueIn(currentDiff)
    // if note smaller 16th the block gets bigger and we have to rescale
    currentDiff -= nearest2Potence

    blockObj.splice(p + l, 0, {
      ...Song.defaultMeasure(),
      ...{
        duration: restOf(Duration.typeToString(nearest2Potence)),
        notes: [],
        tuplet: startTuplet,
        tupletId: startTupletId,
      },
    })
  }
}

/**
 * Changes a beat's length and refits the bar. `applied: false` (not enough room) means
 * nothing changed; `rescale` says whether the bar's width may have changed.
 */
export function changeBeatDuration(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  newDuration: number,
  previousDuration: number,
  noteLength: BeatDuration,
  previousDots?: Dots,
): { applied: boolean; rescale: boolean } {
  const blockObj = Song.measures[trackId][blockId][voiceId]
  const isTuplet = blockObj[beatId].tuplet != null

  if (!isTuplet) {
    // Delegate to DurationReplacer for clean, tested logic
    const numStrings = Song.tracks[trackId].numStrings
    const result = changeBeatDurationViaReplacer(
      trackId,
      blockId,
      voiceId,
      beatId,
      numStrings,
      noteLength,
      previousDots,
    )
    if (!result.success) {
      showNotification('Not enough space in the bar.', 'error')
      return { applied: false, rescale: false }
    }
    return { applied: true, rescale: result.rescaleNeeded }
  }

  // Tuplet path — kept as-is for now (complex tuplet-specific rules)
  let rescaleNecessary = false
  if (newDuration < previousDuration) {
    let diff = previousDuration - newDuration
    blockObj[beatId].duration = noteLength
    let preNotes = 1

    const tupletIdToSearchFor = blockObj[beatId].tupletId
    let startSearchIndex = 0
    let endSearchIndex = blockObj.length
    let isFirst = true
    for (let w = 0; w < blockObj.length; w += 1) {
      if (blockObj[w].tuplet != null && blockObj[w].tupletId === tupletIdToSearchFor) {
        if (isFirst) {
          startSearchIndex = w
          isFirst = false
        }
      } else if (!isFirst) {
        endSearchIndex = w
        break
      }
    }

    // Handle fractional tick remainders
    const EPS = 1e-9
    const frac = diff - Math.floor(diff + EPS)

    if (Math.abs(frac - 0.5) < EPS) {
      let noteFound = false
      for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
        if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.5) < EPS) {
          blockObj[w].doubleDotted = false
          blockObj[w].dotted = false
          noteFound = true
          break
        }
      }
      if (noteFound) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false)
        diff = Math.floor(diff + EPS)
        preNotes += 1
      } else if (previousDuration >= newDuration + 1.5 - EPS) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], true, false)
        diff = previousDuration - (newDuration + 1.5)
        preNotes += 1
      } else {
        return { applied: false, rescale: false }
      }
    } else if (Math.abs(frac - 0.75) < EPS) {
      let noteFound = false
      for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
        if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.75) < EPS) {
          blockObj[w].doubleDotted = false
          blockObj[w].dotted = true
          noteFound = true
          break
        }
      }
      if (noteFound) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false)
        diff = Math.floor(diff + EPS)
        preNotes += 1
      } else if (previousDuration >= newDuration + 1.75 - EPS) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, true)
        diff = previousDuration - (newDuration + 1.75)
        preNotes += 1
      } else {
        return { applied: false, rescale: false }
      }
    } else if (Math.abs(frac - 0.25) < EPS) {
      let noteFound = false
      for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
        if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.75) < EPS) {
          blockObj[w].doubleDotted = false
          blockObj[w].dotted = false
          noteFound = true
          break
        }
      }
      if (noteFound) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false)
        diff = Math.floor(diff + EPS)
        preNotes += 1
      } else if (previousDuration >= newDuration + 3.25 - EPS) {
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], true, false)
        addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, true)
        diff = previousDuration - (newDuration + 3.25)
        preNotes += 2
      } else {
        return { applied: false, rescale: false }
      }
    }

    for (let l = 0, n = diff; l < n; l += 1) {
      if (diff <= 0) break
      const nearest2Potence = Duration.greatestNoteValueIn(diff)
      if (nearest2Potence <= Duration.getDurationOfType('s')) {
        rescaleNecessary = true
      }
      diff -= nearest2Potence

      addNoteToBlock(
        trackId,
        blockId,
        voiceId,
        beatId + preNotes + l,
        restOf(Duration.typeToString(nearest2Potence)),
        true,
        blockObj[beatId],
        false,
        false,
      )
    }
  } else if (newDuration === previousDuration) {
    blockObj[beatId].duration = noteLength
  } else {
    const startTupletId = blockObj[beatId].tupletId
    const diff = newDuration - previousDuration
    let reachedSpace = 0
    for (let p = beatId + 1; p < blockObj.length; p += 1) {
      if (reachedSpace >= diff) break
      if (blockObj[p].tuplet == null || blockObj[p].tupletId !== startTupletId) {
        break
      } else if (blockObj[p].duration.length !== 1) {
        reachedSpace += Duration.getDurationOfNote(blockObj[p], true)
      }
    }
    if (reachedSpace >= diff) {
      blockObj[beatId].duration = noteInputState.noteLength
      deleteRestForTuplet(trackId, blockId, voiceId, beatId, diff)
      rescaleNecessary = true
    } else {
      showNotification('Not enough space in the bar.', 'error')
      return { applied: false, rescale: false }
    }
  }
  // set to rest if no note is set
  let isRest = true
  for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
    if (blockObj[beatId].notes[i] != null) {
      isRest = false
      break
    }
  }
  if (isRest && blockObj[beatId].duration.length < 2) {
    blockObj[beatId].duration += 'r'
  }
  return { applied: true, rescale: rescaleNecessary }
}

/** What `changeNoteDuration` (durationCommands.ts) works with. */
export const tabDurationHost: TabDurationHost = {
  isNotePlaceable,
  changeBeatDuration,
  trackRerenderNecessary: barWidthChangesRows,
  drawTrack: (trackId, voiceId, _forceScale, callback) => redrawTrack(trackId, voiceId, callback),
}
