import { computed, type Ref } from 'vue'
import { useSongData } from './useSongData'
import editorCore from '../services/editor/editorCore'
import { classicalNotationLayoutState } from '../stores/classicalNotationLayoutState'
import type { RenderedTabRow } from '../types/tab'
import { getPageMargins } from '../utils/tabLayout'
import { getTabRowContentHeight } from '../services/editor/tabLayoutMetrics'

interface GuitarTabLayoutProps {
  trackId: number
  voiceId: number
  width: number
  height: number
}

const HEADER_HEIGHT = 80

export function useGuitarTabLayout(
  props: Readonly<GuitarTabLayoutProps>,
  renderVersion: Ref<number>,
) {
  const {
    reactiveSongData,
    songDataVersion,
    syncSongData,
  } = useSongData()

  const margins = computed(() => getPageMargins(props.width, props.height))
  const paddingLeft = computed(() => margins.value.left)
  const paddingTop = computed(() => margins.value.top)
  const tabGroupWidth = computed(() => props.width - 2 * paddingLeft.value)
  const pageWidth = computed(() => props.width)

  const songTitle = computed(() => reactiveSongData.songDescription?.title || 'Untitled')
  const songAuthor = computed(() => reactiveSongData.songDescription?.author || 'Unknown Artist')

  // Rows are sized from their own content (annotation lanes, rhythm, classical
  // staff); see `computeRowLanes`. This is only a fallback for rows without lanes.
  const rowHeight = computed(() => getTabRowContentHeight(props.trackId))

  const tabRows = computed<RenderedTabRow[]>(() => {
    void renderVersion.value
    void songDataVersion.value

    if (classicalNotationLayoutState.active) {
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
        paddingTop: paddingTop.value,
        tabInformationHeight: HEADER_HEIGHT,
      },
    )
  })

  /** Height of the playback bar in the row it is in (strings down to the row's bottom). */
  function getPlaybackBarHeight(rowY: number): number {
    const row = tabRows.value.find((candidate) => candidate.yOffset === rowY)
    if (!row || row.top == null || row.height == null) {
      return rowHeight.value
    }
    return row.top + row.height - row.yOffset
  }

  const totalHeight = computed(() => {
    const lastRow = tabRows.value.at(-1)
    if (lastRow?.top != null && lastRow.height != null) {
      return lastRow.top + lastRow.height + 100
    }
    return HEADER_HEIGHT + tabRows.value.length * rowHeight.value + 100
  })

  return {
    songDataVersion,
    paddingLeft,
    paddingTop,
    tabGroupWidth,
    pageWidth,
    songTitle,
    songAuthor,
    tabRows,
    getPlaybackBarHeight,
    totalHeight,
    rowHeight,
  }
}
