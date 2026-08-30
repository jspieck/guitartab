import { reactive } from 'vue'

export interface ClassicalNotationLayoutState {
  version: number
  staveBeginByBlock: Record<number, number>
  marginTopByRow: Record<number, number>
  beatWidthByBlock: Record<number, number>
}

export const classicalNotationLayoutState = reactive<ClassicalNotationLayoutState>({
  version: 0,
  staveBeginByBlock: {},
  marginTopByRow: {},
  beatWidthByBlock: {},
})

export function publishClassicalLayoutMetrics(
  metrics: {
  staveBeginByBlock?: Record<number, number>
  marginTopByRow?: Record<number, number>
  beatWidthByBlock?: Record<number, number>
  },
  options?: { bumpVersion?: boolean },
): void {
  if (metrics.staveBeginByBlock) {
    Object.assign(classicalNotationLayoutState.staveBeginByBlock, metrics.staveBeginByBlock)
  }
  if (metrics.marginTopByRow) {
    Object.assign(classicalNotationLayoutState.marginTopByRow, metrics.marginTopByRow)
  }
  if (metrics.beatWidthByBlock) {
    Object.assign(classicalNotationLayoutState.beatWidthByBlock, metrics.beatWidthByBlock)
  }
  if (options?.bumpVersion !== false) {
    classicalNotationLayoutState.version += 1
  }
}

export function setClassicalBeatWidth(blockId: number, width: number): void {
  if (!Number.isFinite(width) || width <= 0) {
    return
  }
  classicalNotationLayoutState.beatWidthByBlock[blockId] = width
}

export function publishClassicalBeatWidth(blockId: number, width: number): void {
  setClassicalBeatWidth(blockId, width)
  classicalNotationLayoutState.version += 1
}

export function clearClassicalLayoutMetrics(): void {
  classicalNotationLayoutState.staveBeginByBlock = {}
  classicalNotationLayoutState.marginTopByRow = {}
  classicalNotationLayoutState.beatWidthByBlock = {}
  classicalNotationLayoutState.version += 1
}

export function getClassicalStaveBeginY(blockId: number): number {
  return classicalNotationLayoutState.staveBeginByBlock[blockId] ?? 0
}

export function getClassicalRowMarginTop(rowId: number): number {
  const margin = classicalNotationLayoutState.marginTopByRow[rowId] ?? 0
  return margin
}

export function getClassicalBeatWidth(blockId: number): number {
  return classicalNotationLayoutState.beatWidthByBlock[blockId] ?? 0
}
