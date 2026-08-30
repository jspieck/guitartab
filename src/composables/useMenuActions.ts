import type { Ref } from 'vue'
import { revertHandler } from '../assets/js/revertHandler'
import { modalManager } from '../assets/js/modals/modalManager'
import Song from '../assets/js/songData'
import Settings from '../assets/js/settingManager'
import AppManager from '../assets/js/appManager'
import { classicalNotation } from '../services/editor/classicalNotationAdapter'
import { overlayHandler } from '../assets/js/overlayHandler'
import { menuHandler } from '../assets/js/menuHandler'
import { applyNoteLengthSelection } from '../services/menuActionCommands'
import type { NoteLengthCode } from '../types/tab'
import {
  resolveNoteEffectModalRequest,
  type NoteEffectSelection,
} from '../services/menuMutationRouting'
import { requestBlockRender } from '../services/editor/renderCommands'
import { processDynamicSelect } from '../services/editor/dynamicsCommands'
import {
  measureSelect as runMeasureSelect,
  notationSelect as runNotationSelect,
} from '../services/editor/notationCommands'
import {
  noteLengthSpecialSelect as runNoteLengthSpecialSelect,
} from '../services/editor/durationModifierCommands'
import { usePlaybackEngine } from './usePlaybackEngine'

interface UseMenuActionsOptions {
  currentTrackId: Ref<number>
  currentVoiceId: Ref<number>
  selectedTuplet: Ref<string>
  noteTiedTo: Ref<{ blockId: number; beatId: number } | null>
  syncMenuState: () => void
}

export function useMenuActions(options: UseMenuActionsOptions) {
  const {
    currentTrackId,
    currentVoiceId,
    selectedTuplet,
    noteTiedTo,
    syncMenuState,
  } = options

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
    syncMenuState()
  }

  function dynamicSelect(id: string) {
    if (AppManager.duringTrackCreation) {
      return
    }
    const arr = overlayHandler.getNotesInInterval(null)
    processDynamicSelect(arr!, id, false)
    syncMenuState()
  }

  function notationSelect(id: string) {
    if (runNotationSelect(id)) {
      syncMenuState()
    }
  }

  function processEffectSelect(
    arr: NoteEffectSelection,
    id: string,
    isRevert: boolean,
  ) {
    let isVariableSet = true
    for (const no of arr.notes) {
      const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId]
      const note = beat.notes[no.string]
      isVariableSet = menuHandler.getEffectVariable(beat, note, id)
    }

    const modalRequest = resolveNoteEffectModalRequest(id, isVariableSet, isRevert, arr)
    if (modalRequest != null) {
      modalManager.toggleByModal(modalRequest.modal, modalRequest.params)
      return
    }

    const changes = menuHandler.handleEffectGroupCollision(arr.notes, id, isVariableSet)
    if (isRevert === false) {
      revertHandler.addNoteEffectSelect(arr, id, changes)
    }
    if (id === 'grace') {
      classicalNotation.computeVexFlowDataStructures(
        currentTrackId.value,
        currentVoiceId.value,
      )
    }
    for (const blockId of arr.blocks) {
      requestBlockRender(currentTrackId.value, blockId, currentVoiceId.value)
    }

    syncMenuState()
  }

  function noteEffectSelect(id: string): void {
    if (AppManager.duringTrackCreation) {
      return
    }
    const arr = overlayHandler.getNotesInInterval(null)
    processEffectSelect(arr!, id, false)
  }

  function noteLengthSpecialSelect(id: string) {
    const tupleSel = parseInt(selectedTuplet.value, 10)
    if (runNoteLengthSpecialSelect(id, tupleSel, noteTiedTo.value)) {
      syncMenuState()
    }
  }

  function measureSelect(id: string) {
    if (runMeasureSelect(id)) {
      syncMenuState()
    }
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
