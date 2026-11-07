import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch, type Ref, type WatchSource } from 'vue'
import { fitToolbarGroups, type FoldableGroup } from '../utils/toolbarFit'

interface ToolbarFitOptions {
  /** Foldable group ids of the bar as it is now, first to fold first. */
  foldOrder: () => readonly string[]
  /** Group id → the shared menu it folds into (its button appears once). */
  menus?: Readonly<Record<string, string>>
  /** Width of each menu's button, used before the button has been rendered. */
  menuWidths?: Readonly<Record<string, number>>
  /** When this changes (another edit tab), unfold everything and measure again. */
  remeasureOn?: WatchSource
}

/**
 * Folds toolbar groups into menus when the bar gets too narrow. The bar's sections carry
 * `data-fit-section` and keep their natural width (`flex: none`); inside them, foldable
 * groups carry `data-fold="<id>"` and the menu buttons that replace them `data-fold-menu`.
 * A group's width is measured while it is shown and remembered while it is folded.
 */
export function useToolbarFit(barRef: Ref<HTMLElement | null>, options: ToolbarFitOptions) {
  const folded = shallowRef<ReadonlySet<string>>(new Set())
  const widths = new Map<string, number>()
  let observer: ResizeObserver | null = null
  let frame = 0

  function update(): void {
    const bar = barRef.value
    if (bar == null || bar.clientWidth === 0) return
    const sections = Array.from(bar.querySelectorAll<HTMLElement>('[data-fit-section]'))
    let fixed = 0
    for (const section of sections) {
      const gap = parseFloat(getComputedStyle(section).columnGap) || 0
      let rest = section.offsetWidth
      for (const element of Array.from(section.querySelectorAll<HTMLElement>('[data-fold]'))) {
        const width = element.offsetWidth + gap
        widths.set(element.dataset.fold!, width)
        rest -= width
      }
      for (const element of Array.from(section.querySelectorAll<HTMLElement>('[data-fold-menu]'))) {
        rest -= element.offsetWidth + gap
      }
      fixed += rest
    }
    const style = getComputedStyle(bar)
    const barGaps = (parseFloat(style.columnGap) || 0) * Math.max(0, sections.length - 1)
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    // A pixel of slack against rounding, so a bar that just fits doesn't flicker.
    const available = bar.clientWidth - padding - barGaps - fixed - 1

    const order = options.foldOrder()
    const groups: FoldableGroup[] = order
      .filter((id) => widths.has(id))
      .map((id) => ({ id, width: widths.get(id)!, menu: options.menus?.[id] }))
    const next = fitToolbarGroups(groups, available, order, options.menuWidths)
    if (next.size !== folded.value.size || [...next].some((id) => !folded.value.has(id))) {
      folded.value = next
    }
  }

  function schedule(): void {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(update)
  }

  async function remeasure(): Promise<void> {
    folded.value = new Set()
    await nextTick()
    update()
  }

  if (options.remeasureOn != null) watch(options.remeasureOn, () => void remeasure())

  onMounted(() => {
    void remeasure()
    if (typeof ResizeObserver === 'undefined' || barRef.value == null) return
    observer = new ResizeObserver(schedule)
    observer.observe(barRef.value)
    // Web fonts change the measured widths once they arrive.
    void document.fonts?.ready.then(() => remeasure())
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })

  return {
    folded,
    isFolded: (id: string) => folded.value.has(id),
    /** Any of these groups folded (whether the shared menu shows). */
    anyFolded: (ids: readonly string[]) => ids.some((id) => folded.value.has(id)),
  }
}
