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

  function registerLegacyRenderInvalidationBridge(): () => void {
    typedEventBus.on('render.block', handleRenderBlock)
    typedEventBus.on('render.blocks', handleRenderBlocks)
    typedEventBus.on('render.all', handleRenderAll)

    return () => {
      typedEventBus.off('render.block', handleRenderBlock)
      typedEventBus.off('render.blocks', handleRenderBlocks)
      typedEventBus.off('render.all', handleRenderAll)
    }
  }

  return {
    renderVersion,
    invalidateRender,
    registerLegacyRenderInvalidationBridge,
  }
}