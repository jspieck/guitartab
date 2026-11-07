import Settings from '../../stores/settingsState'
import { notifySongDataChanged } from '../appEvents'
import Song from '../../stores/song'
import { typedEventBus } from '../../utils/typedEventBus'
import { songDataVersion } from '../../stores/songState'
import { getClassicalBeatWidth } from '../../stores/classicalNotationLayoutState'
import {
  getClassicalRowSurface,
  getRegisteredClassicalRowIds,
} from '../../stores/classicalNotationSurfaceState'
import {
  activateClassicalNotation,
  deactivateClassicalNotation,
  ensureClassicalPreparedWhenActive,
  prepareClassicalLayoutMetrics,
} from './classicalNotationLifecycle'
import { requestFullRender } from '../editor/renderCommands'

interface LoadedClassicalNotation {
  toggleClassicalVisibility(): void
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void
  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void
  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number
  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement): void
  syncLayoutMetrics(): boolean
}

interface ClassicalNotationAdapter {
  preload(): Promise<void>
  toggleClassicalVisibility(): Promise<void>
  ensurePrepared(trackId: number, voiceId: number): Promise<void>
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void
  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void
  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number
  requestRowDraw(trackId: number, voiceId: number, rowId: number): void
  drawAllRows(trackId: number, voiceId: number): void
  flushPendingRowDraws(): Promise<void>
}

let loadedClassicalNotation: LoadedClassicalNotation | null = null
let classicalNotationPromise: Promise<LoadedClassicalNotation> | null = null

async function loadClassicalNotation(): Promise<LoadedClassicalNotation> {
  if (loadedClassicalNotation) {
    return loadedClassicalNotation
  }

  if (!classicalNotationPromise) {
    classicalNotationPromise = import('./classicalNotation').then((module) => {
      loadedClassicalNotation = (module.classicalNotation ?? module.default) as LoadedClassicalNotation
      return loadedClassicalNotation
    })
  }

  return classicalNotationPromise
}

function withLoadedNotation(run: (notation: LoadedClassicalNotation) => void) {
  if (loadedClassicalNotation) {
    run(loadedClassicalNotation)
    return
  }

  void loadClassicalNotation().then(run)
}

function getLoadedNotation(): LoadedClassicalNotation | null {
  if (loadedClassicalNotation) {
    return loadedClassicalNotation
  }

  if (Settings.vexFlowIsActive) {
    void loadClassicalNotation()
  }

  return null
}

/*
 * Row draw scheduler. Rows are drawn individually into the surfaces that are
 * currently mounted (virtualized), batched into one animation frame. Notation
 * structures are rebuilt at most once per song-data version, before drawing.
 */
const pendingRowIds = new Set<number>()
let pendingTrack = { trackId: 0, voiceId: 0 }
let structuresKey: string | null = null
let flushScheduled = false

function scheduleFlush(): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(flushRowDraws)
  } else {
    queueMicrotask(flushRowDraws)
  }
}

function flushRowDraws(): void {
  flushScheduled = false
  if (!Settings.vexFlowIsActive || pendingRowIds.size === 0) {
    pendingRowIds.clear()
    return
  }
  if (!loadedClassicalNotation) {
    void loadClassicalNotation().then(scheduleFlush)
    return
  }

  const notation = loadedClassicalNotation
  const { trackId, voiceId } = pendingTrack
  const key = `${trackId}:${voiceId}:${songDataVersion.value}`
  if (structuresKey !== key) {
    notation.computeVexFlowDataStructures(trackId, voiceId)
    structuresKey = key
    if (notation.syncLayoutMetrics()) {
      // Widths or row height changed: the layout is about to move every row,
      // so drawing now would be thrown away. Keep the rows queued for the
      // next frame, after Vue has applied the new layout.
      scheduleFlush()
      return
    }
  }

  const rowIds = [...pendingRowIds]
  pendingRowIds.clear()
  for (const rowId of rowIds) {
    const surface = getClassicalRowSurface(rowId)
    if (surface != null) {
      notation.drawVexFlowRow(trackId, voiceId, rowId, surface)
    }
  }
}

function queueRowDraws(trackId: number, voiceId: number, rowIds: Iterable<number>): void {
  if (!Settings.vexFlowIsActive) {
    return
  }
  pendingTrack = { trackId, voiceId }
  for (const rowId of rowIds) {
    pendingRowIds.add(rowId)
  }
  scheduleFlush()
}

function invalidateClassicalStructures(): void {
  structuresKey = null
}

function invalidateClassicalConsumers(): void {
  invalidateClassicalStructures()
  notifySongDataChanged()
  typedEventBus.emit('classical-notation-changed')
  requestFullRender()
}

const classicalNotation: ClassicalNotationAdapter = {
  async preload() {
    await loadClassicalNotation()
  },

  /**
   * Toggle classical notation using the documented lifecycle order.
   * @see classicalNotationLifecycle.ts
   */
  async toggleClassicalVisibility() {
    const notation = await loadClassicalNotation()
    const trackId = Song.currentTrackId
    const voiceId = Song.currentVoiceId
    const turningOn = !Settings.vexFlowIsActive

    if (turningOn) {
      activateClassicalNotation(notation, trackId, voiceId)
    } else {
      deactivateClassicalNotation(notation)
    }

    invalidateClassicalConsumers()
  },

  /** Cold start / remount when classical is already enabled in settings. */
  async ensurePrepared(trackId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    const notation = await loadClassicalNotation()
    ensureClassicalPreparedWhenActive(notation, trackId, voiceId)
    invalidateClassicalConsumers()
  },

  computeVexFlowDataStructures(trackId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      prepareClassicalLayoutMetrics(notation, trackId, voiceId, { bumpVersion: false })
    })
  },

  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.updateVexFlowBlock(trackId, voiceId, blockId)
      notation.syncLayoutMetrics()
    })
    invalidateClassicalStructures()
    queueRowDraws(trackId, voiceId, getRegisteredClassicalRowIds())
  },

  convertBlockToNotation(trackId: number, blockId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.convertBlockToNotation(trackId, blockId, voiceId)
    })
  },

  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number {
    if (!Settings.vexFlowIsActive) {
      return 0
    }

    const cachedWidth = getClassicalBeatWidth(blockId)
    if (cachedWidth > 0) {
      return cachedWidth
    }

    return getLoadedNotation()?.calculateLargestBeatWidth(trackId, blockId, voiceId) ?? 0
  },

  requestRowDraw(trackId: number, voiceId: number, rowId: number) {
    queueRowDraws(trackId, voiceId, [rowId])
  },

  /** Draw queued rows now instead of on the next frame (e.g. before export). */
  async flushPendingRowDraws() {
    if (!Settings.vexFlowIsActive || pendingRowIds.size === 0) {
      return
    }
    await loadClassicalNotation()
    flushRowDraws()
  },

  /** Redraw every mounted row after rebuilding notation for the current song state. */
  drawAllRows(trackId: number, voiceId: number) {
    invalidateClassicalStructures()
    queueRowDraws(trackId, voiceId, getRegisteredClassicalRowIds())
  },
}

if (Settings.vexFlowIsActive) {
  void classicalNotation.ensurePrepared(Song.currentTrackId, Song.currentVoiceId)
}

export { classicalNotation, loadClassicalNotation }
export default classicalNotation
