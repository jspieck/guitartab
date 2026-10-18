import AppManager from '../../assets/js/appManager'
import Song from '../../assets/js/songData'
import { revertHandler } from '../../assets/js/revertHandler'
import { modalManager } from '../../assets/js/modals/modalManager'
import { SequencerHandler } from '../../assets/js/sequencerHandler'
import { tab } from '../../assets/js/tab'
import type { Beat, MeasureMeta } from '../../types/tab'
import {
  applyTimeMeterToFollowingBlocks,
  findMenuEffectGroup,
  findPreviousTimeMeterChange,
  resolveNotationModalRequest,
} from '../menuMutationRouting'
import { MENU_EFFECT_GROUPS } from '../../utils/menuUiState'
import {
  captureMenuEffectState, deactivateMenuEffectsInGroup, getMenuEffectVariable, setMenuEffectVariable, type MenuEffectState,
} from '../menuEffectMutations'
import { requestBlockRender } from './renderCommands'
import { typedEventBus } from '../../utils/typedEventBus'

function toggleEffectSelect(id: string, beat: Beat, measureMeta: MeasureMeta): void {
  const effectGroup = findMenuEffectGroup(id, MENU_EFFECT_GROUPS)
  if (effectGroup == null) {
    return
  }

  // Use the bar being edited, not the cursor's bar (what menuHandler would use).
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
    modalManager.toggleByModal(modalRequest.modal, modalRequest.params)
    return
  }

  // Snapshot the effect group so undo restores data (text, chord, repeat count…)
  // instead of only flipping a flag.
  const effectGroup = findMenuEffectGroup(id, MENU_EFFECT_GROUPS) ?? [id]
  const captureGroup = (): Record<string, MenuEffectState> => Object.fromEntries(
    effectGroup.map((effectId) => [effectId, captureMenuEffectState(beat, null, effectId, measureMeta)]),
  )
  const stateBefore = captureGroup()
  if (id === 'addMarker' && measureMeta.marker != null) {
    revertHandler.addMarker(trackId, blockId, { ...measureMeta.marker }, undefined)
    SequencerHandler.removeMarker(blockId)
  }
  if (id === 'timeMeter' && isRevert == null && blockId !== 0 && measureMeta.timeMeterPresent) {
    const currentDenominator = measureMeta.denominator
    const currentNumerator = measureMeta.numerator
    const foundBlock = findPreviousTimeMeterChange(blockId, Song.measureMeta)
    const notesBefore = AppManager.checkAndAdaptTimeMeter(foundBlock)
    const newDenominator = Song.measureMeta[foundBlock].denominator
    const newNumerator = Song.measureMeta[foundBlock].numerator

    applyTimeMeterToFollowingBlocks(blockId, Song.measureMeta, newNumerator, newDenominator)

    if (notesBefore != null) {
      revertHandler.addTimeMeter(
        trackId, blockId, voiceId, currentNumerator, newNumerator, currentDenominator,
        newDenominator, true, false, notesBefore,
      )
    } else {
      console.error('Notes before are null')
    }
  }

  toggleEffectSelect(id, beat, measureMeta)
  if (isRevert == null && id !== 'timeMeter' && id !== 'addMarker') {
    revertHandler.addNotationSelect(trackId, blockId, voiceId, beatId, id, stateBefore, captureGroup())
  }
  requestBlockRender(trackId, blockId, voiceId)
}

export function notationSelect(id: string): boolean {
  if (AppManager.duringTrackCreation || tab.markedNoteObj == null) {
    return false
  }

  processNotationSelect(
    tab.markedNoteObj.trackId,
    tab.markedNoteObj.blockId,
    tab.markedNoteObj.voiceId,
    tab.markedNoteObj.beatId,
    id,
    false,
  )
  return true
}

export function processMeasureSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  id: string,
  isRevert: boolean | null,
): void {
  Song.measureMeta[blockId].repeatOpen = !Song.measureMeta[blockId].repeatOpen
  if (isRevert == null) {
    revertHandler.addMeasureSelect(trackId, blockId, voiceId, id)
  }
  typedEventBus.emit('render.block', { trackId, blockId, voiceId })
}

export function measureSelect(id: string): boolean {
  if (AppManager.duringTrackCreation || tab.markedNoteObj == null) {
    return false
  }

  processMeasureSelect(
    tab.markedNoteObj.trackId,
    tab.markedNoteObj.blockId,
    tab.markedNoteObj.voiceId,
    id,
    false,
  )
  return true
}
