import { redrawTrack } from './layoutInvalidation'
import { selectionState } from '../../stores/selectionState'
import Song from '../../stores/song'
import { toggleDialog } from '../dialogs/dialogs'
import type { Beat, MeasureMeta } from '../../types/tab'
import {
  applyTimeMeterToFollowingBlocks,
  findMenuEffectGroup,
  findPreviousTimeMeterChange,
  resolveNotationModalRequest,
} from '../menuMutationRouting'
import { MENU_EFFECT_GROUPS } from '../../utils/menuUiState'
import {
  deactivateMenuEffectsInGroup,
  getMenuEffectVariable,
  setMenuEffectVariable,
} from '../menuEffectMutations'
import { requestBlockRender } from './renderCommands'
import { recordBarEdit } from './editCommands'
import { fitBarsToTimeSignature } from './timeSignatureCommands'

function toggleEffectSelect(id: string, beat: Beat, measureMeta: MeasureMeta): void {
  const effectGroup = findMenuEffectGroup(id, MENU_EFFECT_GROUPS)
  if (effectGroup == null) {
    return
  }

  // Use the bar being edited, not the cursor's bar (what effectToggles would use).
  const isVariableSet = getMenuEffectVariable(beat, null, id, measureMeta)
  deactivateMenuEffectsInGroup(beat, null, effectGroup, measureMeta)
  setMenuEffectVariable(beat, null, id, !isVariableSet, measureMeta)
}

export function processNotationSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  id: string,
  isRevert: boolean | null,
): void {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  const measureMeta = Song.measureMeta[blockId]
  const modalRequest = resolveNotationModalRequest(id, isRevert === true, {
    trackId,
    blockId,
    voiceId,
    beatId,
    beat,
    measureMeta,
  })

  if (modalRequest != null) {
    void toggleDialog(modalRequest.modal, modalRequest.params)
    return
  }

  // `isRevert` is false for toolbar clicks; this used to test `== null`, so the
  // toolbar only cleared the flag and left the bars in the old time signature.
  if (id === 'timeMeter' && isRevert !== true && blockId !== 0 && measureMeta.timeMeterPresent) {
    removeTimeSignature(trackId, blockId, voiceId)
    return
  }

  // A snapshot of the bar, so undo restores data (text, chord, repeat count…)
  // instead of only flipping a flag.
  recordBarEdit(effectLabel(id), { trackId, blockIds: [blockId] }, () =>
    toggleEffectSelect(id, beat, measureMeta),
  )
  requestBlockRender(trackId, blockId, voiceId)
}

/**
 * Bars from `blockId` on take the time signature in force before it again,
 * on every track; beats that no longer fit are cut and gaps filled with rests.
 */
function removeTimeSignature(trackId: number, blockId: number, voiceId: number): void {
  const previousChange = findPreviousTimeMeterChange(blockId, Song.measureMeta)
  let nextChange = blockId + 1
  while (nextChange < Song.measureMeta.length && !Song.measureMeta[nextChange].timeMeterPresent) {
    nextChange += 1
  }
  const blockIds = Array.from({ length: nextChange - previousChange }, (_, index) => previousChange + index)

  recordBarEdit('Remove time signature', { trackId, blockIds, allTracks: true }, () => {
    const { numerator, denominator } = Song.measureMeta[previousChange]
    Song.measureMeta[blockId].timeMeterPresent = false
    applyTimeMeterToFollowingBlocks(blockId, Song.measureMeta, numerator, denominator)
    // null: refused (a tuplet would be cut); recordBarEdit rolls the bars back.
    return fitBarsToTimeSignature(previousChange)
  })
  redrawTrack(Song.currentTrackId, Song.currentVoiceId)
  requestBlockRender(trackId, blockId, voiceId)
}

function effectLabel(id: string): string {
  return id.replace(/^add/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function notationSelect(id: string): boolean {
  processNotationSelect(
    selectionState.cursor.trackId,
    selectionState.cursor.blockId,
    selectionState.cursor.voiceId,
    selectionState.cursor.beatId,
    id,
    false,
  )
  return true
}

export function processMeasureSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  _id: string,
  _isRevert: boolean | null,
): void {
  recordBarEdit('Repeat start', { trackId, blockIds: [blockId] }, () => {
    Song.measureMeta[blockId].repeatOpen = !Song.measureMeta[blockId].repeatOpen
  })
  requestBlockRender(trackId, blockId, voiceId)
}

export function measureSelect(id: string): boolean {
  processMeasureSelect(
    selectionState.cursor.trackId,
    selectionState.cursor.blockId,
    selectionState.cursor.voiceId,
    id,
    false,
  )
  return true
}
