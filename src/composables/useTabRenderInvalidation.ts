import { ref } from 'vue'
import { typedEventBus } from '../utils/typedEventBus'

export function useTabRenderInvalidation(syncSongData: () => void) {
  const renderVersion = ref(0)

  function invalidateRender(): void {
    syncSongData()
    renderVersion.value += 1
  }

  function handleRenderBlock(): void {
    invalidateRender()
  }

  function handleRenderBlocks(): void {
    invalidateRender()
  }

  function handleRenderAll(): void {
    invalidateRender()
  }

  function handleRenderOverBar(): void {
    invalidateRender()
  }

  function handleRenderDurations(): void {
    invalidateRender()
  }

  function handleRenderChordDiagrams(): void {
    invalidateRender()
  }

  function handleRenderDeleteTrack(): void {
    invalidateRender()
  }

  function registerRenderInvalidationBridge(): () => void {
    typedEventBus.on('render.block', handleRenderBlock)
    typedEventBus.on('render.blocks', handleRenderBlocks)
    typedEventBus.on('render.all', handleRenderAll)
    typedEventBus.on('render.overBar', handleRenderOverBar)
    typedEventBus.on('render.durations', handleRenderDurations)
    typedEventBus.on('render.chordDiagrams', handleRenderChordDiagrams)
    typedEventBus.on('render.deleteTrack', handleRenderDeleteTrack)

    return () => {
      typedEventBus.off('render.block', handleRenderBlock)
      typedEventBus.off('render.blocks', handleRenderBlocks)
      typedEventBus.off('render.all', handleRenderAll)
      typedEventBus.off('render.overBar', handleRenderOverBar)
      typedEventBus.off('render.durations', handleRenderDurations)
      typedEventBus.off('render.chordDiagrams', handleRenderChordDiagrams)
      typedEventBus.off('render.deleteTrack', handleRenderDeleteTrack)
    }
  }

  return {
    renderVersion,
    invalidateRender,
    registerRenderInvalidationBridge,
  }
}
