import { undoAvailability, undoHistory } from '../services/editor/editCommands'

/** Undo/Redo for buttons: reactive availability and the actions. */
export function useUndoRedo() {
  function undo(): void {
    undoHistory.undo()
  }

  function redo(): void {
    undoHistory.redo()
  }

  return {
    canUndo: undoAvailability.canUndo,
    canRedo: undoAvailability.canRedo,
    undo,
    redo,
  }
}
