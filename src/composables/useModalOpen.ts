import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

/**
 * Tracks whether a legacy modal (shown by modalManager via the `active` class)
 * is currently open, so panels can run meters only while visible.
 */
export function useModalOpen(modalId: string): Ref<boolean> {
  const open = ref(false)
  let observer: MutationObserver | null = null

  onMounted(() => {
    const modal = document.getElementById(modalId)
    if (modal == null) return
    open.value = modal.classList.contains('active')
    observer = new MutationObserver(() => {
      open.value = modal.classList.contains('active')
    })
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return open
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
