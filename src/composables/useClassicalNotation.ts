import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Settings from '../assets/js/settingManager'
import { classicalNotation } from '../services/editor/classicalNotationAdapter'
import { classicalNotationLayoutState } from '../stores/classicalNotationLayoutState'
import { typedEventBus } from '../utils/typedEventBus'

export function useClassicalNotation(trackId: number, voiceId: number) {
  const isActive = ref(Settings.vexFlowIsActive)
  let redrawQueued = false
  let redrawInProgress = false

  function syncActiveState(): void {
    isActive.value = Settings.vexFlowIsActive
  }

  async function toggleClassicalNotation(): Promise<void> {
    await classicalNotation.toggleClassicalVisibility()
    syncActiveState()
  }

  function redrawRows(): void {
    if (!Settings.vexFlowIsActive || redrawInProgress) {
      return
    }

    redrawInProgress = true
    try {
      classicalNotation.drawAllRows(trackId, voiceId)
    } finally {
      redrawInProgress = false
      if (redrawQueued) {
        redrawQueued = false
        void scheduleRedrawRows()
      }
    }
  }

  async function scheduleRedrawRows(): Promise<void> {
    if (!Settings.vexFlowIsActive) {
      return
    }

    if (redrawInProgress) {
      redrawQueued = true
      return
    }

    await nextTick()
    if (!isActive.value) {
      return
    }

    await nextTick()

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        redrawRows()
      })
      return
    }

    redrawRows()
  }

  function handleClassicalNotationChanged(): void {
    syncActiveState()
    void scheduleRedrawRows()
  }

  watch(isActive, (active) => {
    if (active) {
      void scheduleRedrawRows()
    }
  })

  onMounted(() => {
    syncActiveState()
    typedEventBus.on('classical-notation-changed', handleClassicalNotationChanged)
    if (Settings.vexFlowIsActive) {
      void classicalNotation.preload().then(() => {
        classicalNotation.computeVexFlowDataStructures(trackId, voiceId)
        classicalNotationLayoutState.version += 1
        return scheduleRedrawRows()
      })
    }
  })

  onUnmounted(() => {
    typedEventBus.off('classical-notation-changed', handleClassicalNotationChanged)
  })

  return {
    isActive,
    toggleClassicalNotation,
    redrawRows,
    scheduleRedrawRows,
  }
}
