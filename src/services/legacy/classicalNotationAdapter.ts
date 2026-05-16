import Settings from '../../assets/js/settingManager'

interface LoadedClassicalNotation {
  toggleClassicalVisibility(): void
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number): void
  convertBlockToNotation(trackId: number, blockId: number, voiceId: number): void
  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number): number
  getMarginTop(rowId: number): number
  getYForStaveBegin(blockId: number): number
  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement): void
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
    notation.toggleClassicalVisibility()
  },

  computeVexFlowDataStructures(trackId: number, voiceId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.computeVexFlowDataStructures(trackId, voiceId)
    })
  },

  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.updateVexFlowBlock(trackId, voiceId, blockId)
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
    return getLoadedNotation()?.calculateLargestBeatWidth(trackId, blockId, voiceId) ?? 0
  },

  getMarginTop(rowId: number): number {
    return getLoadedNotation()?.getMarginTop(rowId) ?? 0
  },

  getYForStaveBegin(blockId: number): number {
    return getLoadedNotation()?.getYForStaveBegin(blockId) ?? 0
  },

  drawVexFlowRow(trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement) {
    if (!Settings.vexFlowIsActive) {
      return
    }

    withLoadedNotation((notation) => {
      notation.drawVexFlowRow(trackId, voiceId, rowId, vexFlowArea)
    })
  },
}

if (Settings.vexFlowIsActive) {
  void loadClassicalNotation()
}

export { classicalNotation, loadClassicalNotation }
export default classicalNotation