import Song from '../../assets/js/songData'
import { recordBarEdit } from './editCommands'
import { clearEffectGroup, setEffect } from './effectToggles'
import { requestOverBarRender } from './renderCommands'
import { findMenuEffectGroup, getDynamicValue } from '../menuMutationRouting'
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
  for (const { trackId, blockId, voiceId, beatId } of arr.notes) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    if (!beat.dynamicPresent || beat.dynamic !== dynamic) {
      isVariableSet = false
    }
  }

  const apply = () => {
    for (const { trackId, blockId, voiceId, beatId, string } of arr.notes) {
      const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
      const note = beat.notes[string]
      beat.dynamic = dynamic

      if (effectGroup != null) {
        clearEffectGroup(beat, note, effectGroup)
        setEffect(beat, note, id, !isVariableSet)
      }
    }
  }

  const { trackId, voiceId } = arr.notes[0]
  if (isRevert === true) {
    apply()
  } else {
    // One undo step for the whole selection (it was one per note).
    const blockIds = [...arr.blocks, ...arr.notes.map((note) => note.blockId)]
    recordBarEdit('Dynamics', { trackId, blockIds }, apply)
  }

  for (const blockId of arr.blocks) {
    requestOverBarRender(trackId, blockId, voiceId)
  }
}
