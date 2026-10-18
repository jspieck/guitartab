import { handleEditorShortcutKey } from './tabEditorCommandHelpers'
import type { Ref } from 'vue'
import type { TabSelection } from './useTabSelection'

interface UseTabEditorCommandsOptions {
  currentSelection: Ref<TabSelection | null>
  clearSelection: () => void
}

export function useTabEditorCommands(options: UseTabEditorCommandsOptions) {
  function handleKeyDown(event: KeyboardEvent): void {
    if (!options.currentSelection.value) {
      return
    }

    const handled = handleEditorShortcutKey(event, {
      onClearSelection: () => options.clearSelection(),
    })

    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return {
    handleKeyDown,
  }
}
