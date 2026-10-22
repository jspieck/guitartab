import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Settings from '../stores/settingsState'
import { classicalNotation } from '../services/editor/classicalNotationAdapter'
import { typedEventBus } from '../utils/typedEventBus'

export function useClassicalNotation(trackId: number, voiceId: number) {
  const isActive = computed(() => Settings.vexFlowIsActive)
  let redrawQueued = false
  let redrawInProgress = false

  async function toggleClassicalNotation(): Promise<void> {
    await classicalNotation.toggleClassicalVisibility()
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
    void scheduleRedrawRows()
  }

  watch(isActive, (active) => {
    if (active) {
      void scheduleRedrawRows()
    }
  })

  onMounted(() => {
    typedEventBus.on('classical-notation-changed', handleClassicalNotationChanged)
    if (Settings.vexFlowIsActive) {
      void classicalNotation.ensurePrepared(trackId, voiceId).then(() => scheduleRedrawRows())
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
