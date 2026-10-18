import { reactive } from 'vue'

/** Vertical reach of the notation beyond the five staff lines, in px. */
export interface ClassicalStaffExtents {
  /** Above the top staff line (high notes, ledger lines, up-stems). */
  above: number
  /** Below the bottom staff line (low notes, ledger lines, down-stems). */
  below: number
}

export interface ClassicalNotationLayoutState {
  /** Reactive mirror of `Settings.vexFlowIsActive` for layout consumers. */
  active: boolean
  version: number
  beatWidthByBlock: Record<number, number>
  /** Note reach per block; a row's staff area is sized from its blocks. */
  staffExtentsByBlock: Record<number, ClassicalStaffExtents>
}

export interface ClassicalAreaGeometry {
  /** Total height of the classical area below a tab row. */
  height: number
  /** Y of the top staff line inside the area. */
  staffTop: number
}

/** Distance between the top and bottom staff line (4 spaces of 10 px). */
export const CLASSICAL_STAFF_LINES_HEIGHT = 40
/** Minimum room above/below the lines, enough for the clef glyph. */
const MIN_STAFF_PADDING = 30
const EXTENT_SAFETY = 8

export const classicalNotationLayoutState = reactive<ClassicalNotationLayoutState>({
  active: false,
  version: 0,
  beatWidthByBlock: {},
  staffExtentsByBlock: {},
})

function sameRecord(a: Record<number, number>, b: Record<number, number>): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) {
    return false
  }
  return aKeys.every((key) => a[Number(key)] === b[Number(key)])
}

function sameExtents(
  a: Record<number, ClassicalStaffExtents>,
  b: Record<number, ClassicalStaffExtents>,
): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) {
    return false
  }
  return aKeys.every((key) => {
    const left = a[Number(key)]
    const right = b[Number(key)]
    return right != null && left.above === right.above && left.below === right.below
  })
}

export function setClassicalNotationActive(active: boolean): void {
  classicalNotationLayoutState.active = active
}

/**
 * Publish metrics computed from the notation data (never from drawn output, so
 * drawing cannot feed back into layout). Beat widths replace the previous set.
 * The version is bumped only when something layout-relevant changed, unless
 * `bumpVersion` is false.
 */
export function publishClassicalLayoutMetrics(
  metrics: {
    beatWidthByBlock?: Record<number, number>
    staffExtentsByBlock?: Record<number, ClassicalStaffExtents>
  },
  options?: { bumpVersion?: boolean },
): boolean {
  let changed = false

  if (
    metrics.beatWidthByBlock &&
    !sameRecord(classicalNotationLayoutState.beatWidthByBlock, metrics.beatWidthByBlock)
  ) {
    classicalNotationLayoutState.beatWidthByBlock = { ...metrics.beatWidthByBlock }
    changed = true
  }

  const extents = metrics.staffExtentsByBlock
  if (extents && !sameExtents(classicalNotationLayoutState.staffExtentsByBlock, extents)) {
    classicalNotationLayoutState.staffExtentsByBlock = { ...extents }
    changed = true
  }

  if (changed && options?.bumpVersion !== false) {
    classicalNotationLayoutState.version += 1
  }
  return changed
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
  classicalNotationLayoutState.beatWidthByBlock = {}
  classicalNotationLayoutState.staffExtentsByBlock = {}
  classicalNotationLayoutState.version += 1
}

export function getClassicalBeatWidth(blockId: number): number {
  return classicalNotationLayoutState.beatWidthByBlock[blockId] ?? 0
}

/** Pure geometry of the classical area for the given note extents. */
export function computeClassicalAreaGeometry(extents: ClassicalStaffExtents): ClassicalAreaGeometry {
  const topPadding = Math.max(MIN_STAFF_PADDING, Math.ceil(extents.above) + EXTENT_SAFETY)
  const bottomPadding = Math.max(MIN_STAFF_PADDING, Math.ceil(extents.below) + EXTENT_SAFETY)
  return {
    height: topPadding + CLASSICAL_STAFF_LINES_HEIGHT + bottomPadding,
    staffTop: topPadding,
  }
}

/** Note reach of the blocks `[startBlockId, endBlockIdExclusive)`. */
export function getRowStaffExtents(startBlockId: number, endBlockIdExclusive: number): ClassicalStaffExtents {
  let above = 0
  let below = 0
  for (let blockId = startBlockId; blockId < endBlockIdExclusive; blockId += 1) {
    const extents = classicalNotationLayoutState.staffExtentsByBlock[blockId]
    if (extents) {
      above = Math.max(above, extents.above)
      below = Math.max(below, extents.below)
    }
  }
  return { above, below }
}

/** Classical area of one row, sized from that row's notes only. */
export function getClassicalRowGeometry(
  startBlockId: number,
  endBlockIdExclusive: number,
): ClassicalAreaGeometry {
  return computeClassicalAreaGeometry(getRowStaffExtents(startBlockId, endBlockIdExclusive))
}
