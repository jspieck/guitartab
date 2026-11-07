import { onBeforeUnmount, reactive } from 'vue'

const SHOW_DELAY_MS = 450
const MARGIN = 8

/**
 * One tooltip for the whole toolbar: listens (delegated) for the pointer or keyboard focus on
 * an element with `data-tip` and shows its text below it, in an element teleported to <body>
 * (the bars clip their overflow, so CSS tooltips inside them would be cut off).
 */
export function useToolbarTooltip() {
  const state = reactive({ text: '', style: {} as Record<string, string> })
  let timer: ReturnType<typeof setTimeout> | undefined
  let target: HTMLElement | null = null

  function place(element: HTMLElement): void {
    const rect = element.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    // Rough width so it stays on screen; the text is short.
    const halfWidth = Math.min(160, state.text.length * 3.6 + 10)
    const left = Math.max(MARGIN + halfWidth, Math.min(center, window.innerWidth - MARGIN - halfWidth))
    state.style = { top: `${rect.bottom + 6}px`, left: `${left}px` }
  }

  function show(event: Event): void {
    const element = (event.target as Element | null)?.closest?.<HTMLElement>('[data-tip]') ?? null
    if (element == null || element === target) return
    if (event.type === 'focusin' && !element.matches(':focus-visible')) return
    hide()
    target = element
    timer = setTimeout(
      () => {
        if (target !== element || !element.isConnected) return
        state.text = element.dataset.tip ?? ''
        place(element)
      },
      event.type === 'focusin' ? 0 : SHOW_DELAY_MS,
    )
  }

  function hide(event?: Event): void {
    // Moving between children of the same button is not leaving it.
    const related = (event as PointerEvent | FocusEvent | undefined)?.relatedTarget as Node | null | undefined
    if (event?.type === 'pointerout' && target != null && related != null && target.contains(related)) return
    clearTimeout(timer)
    target = null
    state.text = ''
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { state, show, hide }
}
