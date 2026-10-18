import Song from '../../assets/js/songData'
import { revertHandler } from '../../assets/js/revertHandler'
import { menuHandler } from '../../assets/js/menuHandler'
import { requestOverBarRender } from './renderCommands'
import {
  findMenuEffectGroup,
  getDynamicValue,
} from '../menuMutationRouting'
import { MENU_EFFECT_GROUPS } from '../../utils/menuUiState'

export interface DynamicSelectionTarget {
  notes: {
    trackId: number
    blockId: number
    voiceId: number
    beatId: number
    string: number
  }[]
  blocks: number[]
}

export function processDynamicSelect(
  arr: DynamicSelectionTarget,
  id: string,
  isRevert: boolean | null,
): void {
  const dynamic = getDynamicValue(id)
  const effectGroup = findMenuEffectGroup(id, MENU_EFFECT_GROUPS)

  let isVariableSet = true
  for (const {
    trackId, blockId, voiceId, beatId,
  } of arr.notes) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    if (!beat.dynamicPresent || beat.dynamic !== dynamic) {
      isVariableSet = false
    }
  }

  for (const {
    trackId, blockId, voiceId, beatId, string,
  } of arr.notes) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    const note = beat.notes[string]
    beat.dynamic = dynamic

    if (effectGroup != null) {
      menuHandler.deactivateEffects(beat, note, effectGroup)

      if (isVariableSet == null || isVariableSet === false) {
        menuHandler.setEffectVariable(beat, note, id, true)
      } else {
        menuHandler.setEffectVariable(beat, note, id, false)
      }
    }

    if (isRevert == null) {
      revertHandler.addDynamic(trackId, blockId, voiceId, beatId, string, id)
    }
  }

  const { trackId, voiceId } = arr.notes[0]
  for (const blockId of arr.blocks) {
    requestOverBarRender(trackId, blockId, voiceId)
  }
}
