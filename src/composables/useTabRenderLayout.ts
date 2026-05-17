import { shallowReactive } from 'vue'

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
  yOffset: number
  height: number
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

function layoutKey(trackId: number, voiceId: number): string {
  return `${trackId}:${voiceId}`
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
  trackLayouts[layoutKey(trackId, voiceId)] = state
}

export function clearTrackRenderLayout(trackId: number, voiceId: number): void {
  delete trackLayouts[layoutKey(trackId, voiceId)]
}

export function getTrackRenderLayout(trackId: number, voiceId: number): RenderTrackLayoutState | null {
  return trackLayouts[layoutKey(trackId, voiceId)] ?? null
}

export function getBlockRenderLayout(
  trackId: number,
  voiceId: number,
  blockId: number,
): RenderBlockLayout | null {
  return getTrackRenderLayout(trackId, voiceId)?.blockLayouts[blockId] ?? null
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