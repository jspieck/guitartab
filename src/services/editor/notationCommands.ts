import AppManager from '../../assets/js/appManager'
import Song from '../../assets/js/songData'
import { revertHandler } from '../../assets/js/revertHandler'
import { modalManager } from '../../assets/js/modals/modalManager'
import { menuHandler } from '../../assets/js/menuHandler'
import { SequencerHandler } from '../../assets/js/sequencerHandler'
import { tab } from '../../assets/js/tab'
import type { Measure } from '../../types/tab'
import {
  applyTimeMeterToFollowingBlocks,
  findMenuEffectGroup,
  findPreviousTimeMeterChange,
  resolveNotationModalRequest,
} from '../menuMutationRouting'
import { MENU_EFFECT_GROUPS } from '../../utils/menuUiState'
import { requestBlockRender } from './renderCommands'
import { typedEventBus } from '../../utils/typedEventBus'

function toggleEffectSelect(id: string, beat: Measure): void {
  const effectGroup = findMenuEffectGroup(id, MENU_EFFECT_GROUPS)
  if (effectGroup == null) {
    return
  }

  const isVariableSet = menuHandler.getEffectVariable(beat, null, id)
  menuHandler.deactivateEffects(beat, null, effectGroup)

  if (isVariableSet == null || isVariableSet === false) {
    menuHandler.setEffectVariable(beat, null, id, true)
  } else {
    menuHandler.setEffectVariable(beat, null, id, false)
  }
}

export function processNotationSelect(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  id: string,
  isRevert: boolean | null,
): void {
  const beat = Song.measures[trackId][blockId][voiceId][beatId]
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

  if (isRevert == null && id !== 'timeMeter' && id !== 'addMarker') {
    revertHandler.addNotationSelect(trackId, blockId, voiceId, beatId, id)
  }
  if (id === 'addMarker' && measureMeta.markerPresent) {
    revertHandler.addMarker(
      trackId, blockId, measureMeta.marker,
      measureMeta.marker, true, false,
    )
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

  toggleEffectSelect(id, beat)
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
