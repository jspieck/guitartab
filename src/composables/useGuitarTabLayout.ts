import { computed, type Ref } from 'vue'
import { useTabRenderLayout } from './useTabRenderLayout'
import { useSongData } from './useSongData'
import legacyEditorCore from '../services/legacy/editorCoreAdapter'
import type { RenderedTabRow } from '../types/tab'
import { getPageMargins } from '../utils/tabLayout'

interface GuitarTabLayoutProps {
  trackId: number
  voiceId: number
  width: number
  height: number
}

const HEADER_HEIGHT = 80
const ROW_HEIGHT = 120

export function useGuitarTabLayout(
  props: Readonly<GuitarTabLayoutProps>,
  renderVersion: Ref<number>,
) {
  const {
    reactiveSongData,
    songDataVersion,
    syncSongData,
  } = useSongData()

  const { getTrackLayout } = useTabRenderLayout()

  const margins = computed(() => getPageMargins(props.width, props.height))
  const paddingLeft = computed(() => margins.value.left)
  const paddingTop = computed(() => margins.value.top)
  const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
  const pageWidth = computed(() => props.width)
  const renderLayout = computed(() => getTrackLayout(props.trackId, props.voiceId))

  const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
  const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')

  const tabRows = computed<RenderedTabRow[]>(() => {
    const renderRevision = renderVersion.value + songDataVersion.value
    void renderRevision

    if (legacyEditorCore.ensureSongInitialized()) {
      syncSongData()
    }

    return legacyEditorCore.buildModernTabRows(
      props.trackId,
      props.voiceId,
      reactiveSongData.measures?.[props.trackId] || [],
      {
        availableWidth: tabGroupWidth.value,
        headerHeight: HEADER_HEIGHT,
        rowHeight: ROW_HEIGHT,
        paddingTop: paddingTop.value,
        tabInformationHeight: HEADER_HEIGHT,
      },
    )
  })

  const playbackBarHeight = computed(() => {
    const rowLayouts = renderLayout.value?.rowLayouts
    if (!rowLayouts || rowLayouts.length === 0) {
      return ROW_HEIGHT
    }

    const lastRow = rowLayouts[rowLayouts.length - 1]
    return Math.max(ROW_HEIGHT, lastRow.yOffset + lastRow.height)
  })

  const totalHeight = computed(() => HEADER_HEIGHT + tabRows.value.length * ROW_HEIGHT + 100)

  return {
    songDataVersion,
    paddingLeft,
    paddingTop,
    tabGroupWidth,
    pageWidth,
    songTitle,
    songAuthor,
    tabRows,
    playbackBarHeight,
    totalHeight,
  }
}