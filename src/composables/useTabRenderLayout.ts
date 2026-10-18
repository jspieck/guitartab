import { shallowReactive, toRaw } from 'vue'

export interface RenderLayoutOptions {
  availableWidth: number
  paddingTop: number
  tabInformationHeight: number
}

export interface RenderBlockLayout {
  xOffset: number
  rowId: number
  numInRow: number
  width: number
  minOffset: number
  pageId: number
  beatPositions: number[]
}

export interface RenderRowLayout {
  /** Y of the top string. */
  yOffset: number
  /** From the top string to the bottom of the row. */
  height: number
  /** Y of the row's top edge, including the annotation lanes above the strings. */
  top?: number
}

export interface RenderTrackLayoutState {
  blockLayouts: RenderBlockLayout[]
  rowLayouts: RenderRowLayout[]
  availableWidth: number
  paddingTop: number
  tabInformationHeight: number
  numRows: number
  numPages: number
}

const trackLayouts = shallowReactive<Record<string, RenderTrackLayoutState>>({})

/**
 * Per-block view of the current layouts. Readers of a single block track only
 * that block's key, so an edit that leaves a block's geometry unchanged does not
 * re-run the block's computeds or re-render it.
 */
const blockLayoutCells = shallowReactive<Record<string, RenderBlockLayout>>({})

function layoutKey(trackId: number, voiceId: number): string {
  return `${trackId}:${voiceId}`
}

function blockKey(trackId: number, voiceId: number, blockId: number): string {
  return `${trackId}:${voiceId}:${blockId}`
}

function sameNumbers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false
    }
  }
  return true
}

function isSameBlockLayout(a: RenderBlockLayout, b: RenderBlockLayout): boolean {
  return a.xOffset === b.xOffset
    && a.rowId === b.rowId
    && a.numInRow === b.numInRow
    && a.width === b.width
    && a.minOffset === b.minOffset
    && a.pageId === b.pageId
    && sameNumbers(a.beatPositions, b.beatPositions)
}

// Layout is computed inside render-time computeds; reads made while writing must not
// subscribe that computed to the very state it is replacing.
const rawTrackLayouts = toRaw(trackLayouts)
const rawBlockLayoutCells = toRaw(blockLayoutCells)

function syncBlockLayoutCells(
  trackId: number,
  voiceId: number,
  state: RenderTrackLayoutState,
  previousBlockCount: number,
): void {
  state.blockLayouts.forEach((blockLayout, blockId) => {
    const key = blockKey(trackId, voiceId, blockId)
    const previous = rawBlockLayoutCells[key]
    if (previous && isSameBlockLayout(previous, blockLayout)) {
      // Keep identity so neither the cell nor object-identity consumers are invalidated.
      state.blockLayouts[blockId] = previous
      return
    }
    blockLayoutCells[key] = blockLayout
  })

  for (let blockId = state.blockLayouts.length; blockId < previousBlockCount; blockId += 1) {
    delete blockLayoutCells[blockKey(trackId, voiceId, blockId)]
  }
}

export function createRenderTrackLayoutState(options: RenderLayoutOptions): RenderTrackLayoutState {
  return {
    blockLayouts: [],
    rowLayouts: [],
    availableWidth: options.availableWidth,
    paddingTop: options.paddingTop,
    tabInformationHeight: options.tabInformationHeight,
    numRows: 0,
    numPages: 1,
  }
}

export function setTrackRenderLayout(trackId: number, voiceId: number, state: RenderTrackLayoutState): void {
  const key = layoutKey(trackId, voiceId)
  const previousBlockCount = rawTrackLayouts[key]?.blockLayouts.length ?? 0
  syncBlockLayoutCells(trackId, voiceId, state, previousBlockCount)
  trackLayouts[key] = state
}

export function clearTrackRenderLayout(trackId: number, voiceId: number): void {
  const key = layoutKey(trackId, voiceId)
  const previousBlockCount = rawTrackLayouts[key]?.blockLayouts.length ?? 0
  for (let blockId = 0; blockId < previousBlockCount; blockId += 1) {
    delete blockLayoutCells[blockKey(trackId, voiceId, blockId)]
  }
  delete trackLayouts[key]
}

export function getTrackRenderLayout(trackId: number, voiceId: number): RenderTrackLayoutState | null {
  return trackLayouts[layoutKey(trackId, voiceId)] ?? null
}

export function getBlockRenderLayout(
  trackId: number,
  voiceId: number,
  blockId: number,
): RenderBlockLayout | null {
  return blockLayoutCells[blockKey(trackId, voiceId, blockId)] ?? null
}

export function getBlockRenderPageId(
  trackId: number,
  voiceId: number,
  blockId: number,
): number | null {
  return getBlockRenderLayout(trackId, voiceId, blockId)?.pageId ?? null
}

export function getBeatRenderPosition(
  trackId: number,
  voiceId: number,
  blockId: number,
  beatId: number,
): number | null {
  return getBlockRenderLayout(trackId, voiceId, blockId)?.beatPositions[beatId] ?? null
}

export function getRowRenderLayout(
  trackId: number,
  voiceId: number,
  rowId: number,
): RenderRowLayout | null {
  return getTrackRenderLayout(trackId, voiceId)?.rowLayouts[rowId] ?? null
}

export function useTabRenderLayout() {
  return {
    trackLayouts,
    getTrackLayout: getTrackRenderLayout,
    getBlockLayout: getBlockRenderLayout,
    getBlockPageId: getBlockRenderPageId,
    getBeatPosition: getBeatRenderPosition,
    getRowLayout: getRowRenderLayout,
    setTrackLayout: setTrackRenderLayout,
    clearTrackLayout: clearTrackRenderLayout,
  }
}