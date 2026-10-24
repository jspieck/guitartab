/**
 * Row layout of the tab per track and voice, written by the layout engine
 * (`services/editor/measureLayoutEngine.ts`) and read by rendering, playback
 * scrolling and navigation. Plain arrays, not reactive: Vue reads the cached
 * layout in `stores/tabRenderLayout.ts`.
 */
export const tabLayout = {
  /** Width of one width unit (a sixteenth) per [track][bar][voice]. */
  measureOffset: [] as number[][][],
  /** First and last bar of each row per [track][voice][row]. */
  blocksPerRow: [] as { start: number; end: number }[][][],
  /** Minimum width of each bar of the last laid-out track. */
  allWidths: [] as { minWidth: number; minOffset: number; num16ths: number }[],
  /** Row of each bar and its index in that row per [track][voice][bar]. */
  blockToRow: [] as { rowId: number; numInRow: number }[][][],
  /** Final drawn width per [track][voice][bar]. */
  finalBlockWidths: [] as number[][][],
}
