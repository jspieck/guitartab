import type { MeasureMetaInfo } from '../types/song'

/** A rehearsal section: a marker's bar up to the bar before the next marker. */
export interface MarkerSection {
  text: string
  /** first bar and the bar after the last, as `[startBlock, endBlock)` */
  startBlock: number
  endBlock: number
}

/** The song's sections in order, from its markers. */
export function markerSections(measureMeta: readonly MeasureMetaInfo[]): MarkerSection[] {
  const starts = measureMeta.flatMap((meta, blockId) => (meta?.marker != null ? [blockId] : []))
  return starts.map((startBlock, i) => ({
    text: measureMeta[startBlock].marker?.text ?? '',
    startBlock,
    endBlock: starts[i + 1] ?? measureMeta.length,
  }))
}

/** The section starting at `blockId`, if a marker is there. */
export function sectionAt(measureMeta: readonly MeasureMetaInfo[], blockId: number): MarkerSection | null {
  return markerSections(measureMeta).find((section) => section.startBlock === blockId) ?? null
}
