import AppManager from '../assets/js/appManager'
import { undoAvailability, undoHistory } from '../services/editor/editCommands'

/** Undo/Redo for buttons: reactive availability and the actions. */
export function useUndoRedo() {
  function undo(): void {
    if (!AppManager.duringTrackCreation) undoHistory.undo()
  }

  function redo(): void {
    if (!AppManager.duringTrackCreation) undoHistory.redo()
  }

  return {
    canUndo: undoAvailability.canUndo,
    canRedo: undoAvailability.canRedo,
    undo,
    redo,
  }
}
