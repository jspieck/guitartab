import { computed, type Ref } from 'vue'
import { useTabRenderLayout } from './useTabRenderLayout'
import { useSongData } from './useSongData'
import editorCore from '../services/editor/editorCore'
import Settings from '../assets/js/settingManager'
import { TAB_SHEET } from '../utils/tabSheetConstants'
import { classicalNotationLayoutState } from '../stores/classicalNotationLayoutState'
import type { RenderedTabRow } from '../types/tab'
import { getPageMargins } from '../utils/tabLayout'
import { getClassicalNotationTop } from '../services/editor/tabLayoutMetrics'

interface GuitarTabLayoutProps {
  trackId: number
  voiceId: number
  width: number
  height: number
}

const HEADER_HEIGHT = 80
const CLASSICAL_ROW_GAP = 8

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

  const tabRowHeight = computed(() => (
    getClassicalNotationTop(props.trackId) + 6
  ))

  const rowHeight = computed(() => {
    if (!Settings.vexFlowIsActive) {
      return tabRowHeight.value
    }

    const marginTops = Object.values(classicalNotationLayoutState.marginTopByRow)
    const extraTop = marginTops.length > 0 ? Math.max(...marginTops) : 0

    return tabRowHeight.value + CLASSICAL_ROW_GAP + TAB_SHEET.VEXFLOW_HEIGHT + extraTop
  })

  const tabRows = computed<RenderedTabRow[]>(() => {
    void renderVersion.value
    void songDataVersion.value

    if (Settings.vexFlowIsActive) {
      void classicalNotationLayoutState.version
    }

    if (editorCore.ensureSongInitialized()) {
      syncSongData()
    }

    return editorCore.buildModernTabRows(
      props.trackId,
      props.voiceId,
      reactiveSongData.measures?.[props.trackId] || [],
      {
        availableWidth: tabGroupWidth.value,
        headerHeight: HEADER_HEIGHT,
        rowHeight: rowHeight.value,
        paddingTop: paddingTop.value,
        tabInformationHeight: HEADER_HEIGHT,
      },
    )
  })

  const playbackBarHeight = computed(() => {
    const rowLayouts = renderLayout.value?.rowLayouts
    if (!rowLayouts || rowLayouts.length === 0) {
      return rowHeight.value
    }

    const lastRow = rowLayouts[rowLayouts.length - 1]
    if (!lastRow) {
      return rowHeight.value
    }
    return Math.max(rowHeight.value, lastRow.yOffset + lastRow.height)
  })

  const totalHeight = computed(() => (
    HEADER_HEIGHT + tabRows.value.length * rowHeight.value + 100
  ))

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
    rowHeight,
  }
}
