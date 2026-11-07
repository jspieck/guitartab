import { computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { isDialogOpen } from '../stores/dialogState'

/** Whether a dialog is open, so panels can run meters only while visible. */
export function useDialogOpen(dialogId: string): Ref<boolean> {
  return computed(() => isDialogOpen(dialogId))
}

/** Runs `frame` on every animation frame while `active` is true. */
export function useAnimationLoop(active: Ref<boolean>, frame: () => void): void {
  let handle = 0

  const tick = () => {
    if (!active.value) {
      handle = 0
      return
    }
    frame()
    handle = requestAnimationFrame(tick)
  }

  const start = () => {
    if (handle === 0 && active.value) handle = requestAnimationFrame(tick)
  }

  onMounted(start)
  watch(active, start)
  onUnmounted(() => {
    if (handle !== 0) cancelAnimationFrame(handle)
    handle = 0
  })
}
