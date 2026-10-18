import { nextTick, reactive } from 'vue'

/**
 * Row virtualization switch for the tab surface. Consumers that read the whole
 * tab DOM (SVG/PDF export, printing) must render every row first.
 */
export const tabVirtualizationState = reactive({
  renderAllRequests: 0,
})

export function isRenderingAllRows(): boolean {
  return tabVirtualizationState.renderAllRequests > 0
}

export function beginRenderAllRows(): void {
  tabVirtualizationState.renderAllRequests += 1
}

export function endRenderAllRows(): void {
  tabVirtualizationState.renderAllRequests = Math.max(0, tabVirtualizationState.renderAllRequests - 1)
}

/** Run `task` with every tab row mounted (after Vue has flushed the extra rows). */
export async function withAllRowsRendered<T>(task: () => T | Promise<T>): Promise<T> {
  beginRenderAllRows()
  try {
    await nextTick()
    return await task()
  } finally {
    endRenderAllRows()
  }
}
