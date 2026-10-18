import { onMounted, onBeforeUnmount, ref } from 'vue'
import { revertHandler } from '../assets/js/revertHandler'
import { typedEventBus } from '../utils/typedEventBus'

function syncUndoRedoState(canUndo: { value: boolean }, canRedo: { value: boolean }): void {
  canUndo.value = revertHandler.canUndo()
  canRedo.value = revertHandler.canRedo()
}

export function useUndoRedo() {
  const canUndo = ref(false)
  const canRedo = ref(false)

  function refreshUndoRedoState(): void {
    syncUndoRedoState(canUndo, canRedo)
  }

  function undo(): void {
    revertHandler.revertState()
    refreshUndoRedoState()
  }

  function redo(): void {
    revertHandler.restoreState()
    refreshUndoRedoState()
  }

  onMounted(() => {
    refreshUndoRedoState()
    typedEventBus.on('song-data-changed', refreshUndoRedoState)
  })

  onBeforeUnmount(() => {
    typedEventBus.off('song-data-changed', refreshUndoRedoState)
  })

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    refreshUndoRedoState,
  }
}
