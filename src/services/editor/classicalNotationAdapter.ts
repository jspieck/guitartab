import Settings from '../../assets/js/settingManager'
import { notifySongDataChanged } from '../appEvents'
import Song from '../../assets/js/songData'
import { tab } from '../../assets/js/tab'
import renderBridge from './renderBridge'
import { typedEventBus } from '../../utils/typedEventBus'
import {
  clearClassicalLayoutMetrics,
  classicalNotationLayoutState,
  getClassicalBeatWidth,
  getClassicalRowMarginTop,
  getClassicalStaveBeginY,
} from '../../stores/classicalNotationLayoutState'
import { getClassicalRowSurface } from '../../stores/classicalNotationSurfaceState'

interface LoadedClassicalNotation {
  toggleClassicalVisibility(): void
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void
  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void
  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number
  getMarginTop(rowId: number): number
  getYForStaveBegin(blockId: number): number
  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement): void
  syncLayoutMetrics(): void
}

interface ClassicalNotationAdapter {
  preload(): Promise<void>
  toggleClassicalVisibility(): Promise<void>
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void
  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void
  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number
  getMarginTop(rowId: number): number
  getYForStaveBegin(blockId: number): number
  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement): void
  drawAllRows(trackId: number, voiceId: number): void
}

let loadedClassicalNotation: LoadedClassicalNotation | null = null
let classicalNotationPromise: Promise<LoadedClassicalNotation> | null = null

async function loadClassicalNotation(): Promise<LoadedClassicalNotation> {
  if (loadedClassicalNotation) {
    return loadedClassicalNotation
  }

  if (!classicalNotationPromise) {
    classicalNotationPromise = import('../../assets/js/vexflowClassical').then((module) => {
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

const classicalNotation: ClassicalNotationAdapter = {
  async preload() {
    await loadClassicalNotation()
  },

  async toggleClassicalVisibility() {
    const notation = await loadClassicalNotation()
    const trackId = Song.currentTrackId
    const voiceId = Song.currentVoiceId

    notation.toggleClassicalVisibility()

    if (Settings.vexFlowIsActive) {
      notation.computeVexFlowDataStructures(trackId, voiceId)
      notation.syncLayoutMetrics()
      classicalNotationLayoutState.version += 1
    } else {
      clearClassicalLayoutMetrics()
    }

    notifySongDataChanged()
    typedEventBus.emit('classical-notation-changed')
    typedEventBus.emit('render.all')
  },

  computeVexFlowDataStructures(trackId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.computeVexFlowDataStructures(trackId, voiceId)
      notation.syncLayoutMetrics()
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

  getMarginTop(rowId: number): number {
    if (!Settings.vexFlowIsActive) {
      return 0
    }
    return getClassicalRowMarginTop(rowId)
  },

  getYForStaveBegin(blockId: number): number {
    if (!Settings.vexFlowIsActive) {
      return 0
    }
    return getClassicalStaveBeginY(blockId)
  },

  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.drawVexFlowRow(trackId, voiceId, rowId, vexFlowArea)
    })
  },

  drawAllRows(trackId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      const layoutRowCount = renderBridge.getTrackLayout(trackId, voiceId)?.numRows ?? 0
      const rowCount = layoutRowCount || (tab.blocksPerRow[trackId]?.[voiceId]?.length ?? 0)
      if (rowCount === 0) {
        return
      }

      notation.computeVexFlowDataStructures(trackId, voiceId)

      for (let rowId = 0; rowId < rowCount; rowId += 1) {
        const vexFlowArea = getClassicalRowSurface(rowId)
        if (vexFlowArea != null) {
          notation.drawVexFlowRow(trackId, voiceId, rowId, vexFlowArea)
        }
      }
      notation.syncLayoutMetrics()
    })
  },
}

if (Settings.vexFlowIsActive) {
  void loadClassicalNotation().then((notation) => {
    notation.computeVexFlowDataStructures(Song.currentTrackId, Song.currentVoiceId)
    notation.syncLayoutMetrics()
    classicalNotationLayoutState.version += 1
  })
}

export { classicalNotation, loadClassicalNotation }
export default classicalNotation
