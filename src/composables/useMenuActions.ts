import type { Ref } from 'vue'
import { modalManager } from '../assets/js/modals/modalManager'
import Song from '../assets/js/songData'
import Settings from '../stores/settingsState'
import AppManager from '../assets/js/appManager'
import { classicalNotation } from '../services/editor/classicalNotationAdapter'
import { notesInRange } from '../services/editor/rangeSelection'
import { isEffectSet, toggleNoteEffect } from '../services/editor/effectToggles'
import { applyNoteLengthSelection } from '../services/menuActionCommands'
import type { NoteLengthCode } from '../types/tab'
import { resolveNoteEffectModalRequest, type NoteEffectSelection } from '../services/menuMutationRouting'
import { requestBlockRender } from '../services/editor/renderCommands'
import { recordBarEdit } from '../services/editor/editCommands'
import { processDynamicSelect } from '../services/editor/dynamicsCommands'
import {
  measureSelect as runMeasureSelect,
  notationSelect as runNotationSelect,
} from '../services/editor/notationCommands'
import { noteLengthSpecialSelect as runNoteLengthSpecialSelect } from '../services/editor/durationModifierCommands'
import { usePlaybackEngine } from './usePlaybackEngine'

interface UseMenuActionsOptions {
  currentTrackId: Ref<number>
  currentVoiceId: Ref<number>
  selectedTuplet: Ref<string>
  noteTiedTo: Readonly<Ref<{ blockId: number; beatId: number } | null>>
}

export function useMenuActions(options: UseMenuActionsOptions) {
  const { currentTrackId, currentVoiceId, selectedTuplet, noteTiedTo } = options

  const playbackEngine = usePlaybackEngine()

  function playBackJump(isBackwards: boolean) {
    if (!Settings.songPlaying) {
      return
    }
    if (isBackwards) {
      void playbackEngine.stepBackward()
    } else {
      void playbackEngine.stepForward()
    }
  }

  function selectNoteLength(noteLength: NoteLengthCode) {
    applyNoteLengthSelection(noteLength)
  }

  function dynamicSelect(id: string) {
    if (AppManager.duringTrackCreation) {
      return
    }
    const arr = notesInRange()
    processDynamicSelect(arr!, id, false)
  }

  function notationSelect(id: string) {
    runNotationSelect(id)
  }

  function processEffectSelect(arr: NoteEffectSelection, id: string) {
    let isVariableSet = true
    for (const no of arr.notes) {
      const beat = Song.getBeat({
        trackId: no.trackId,
        blockId: no.blockId,
        voiceId: no.voiceId,
        beatId: no.beatId,
      })
      const note = beat.notes[no.string]
      isVariableSet = isEffectSet(beat, note, id)
    }

    const modalRequest = resolveNoteEffectModalRequest(id, isVariableSet, false, arr)
    if (modalRequest != null) {
      modalManager.toggleByModal(modalRequest.modal, modalRequest.params)
      return
    }

    const trackId = arr.notes[0]?.trackId ?? currentTrackId.value
    const blockIds = [...arr.blocks, ...arr.notes.map((note) => note.blockId)]
    recordBarEdit(effectLabel(id), { trackId, blockIds }, () => {
      toggleNoteEffect(arr.notes, id, isVariableSet)
    })
    if (id === 'grace') {
      classicalNotation.computeVexFlowDataStructures(currentTrackId.value, currentVoiceId.value)
    }
    for (const blockId of arr.blocks) {
      requestBlockRender(currentTrackId.value, blockId, currentVoiceId.value)
    }
  }

  function noteEffectSelect(id: string): void {
    if (AppManager.duringTrackCreation) {
      return
    }
    const arr = notesInRange()
    processEffectSelect(arr!, id)
  }

  function noteLengthSpecialSelect(id: string) {
    const tupleSel = parseInt(selectedTuplet.value, 10)
    runNoteLengthSpecialSelect(id, tupleSel, noteTiedTo.value)
  }

  function measureSelect(id: string) {
    runMeasureSelect(id)
  }

  return {
    playBackJump,
    selectNoteLength,
    dynamicSelect,
    notationSelect,
    noteEffectSelect,
    noteLengthSpecialSelect,
    measureSelect,
  }
}

/** "palmMute" -> "Palm mute", for the undo label. */
function effectLabel(id: string): string {
  const words = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
