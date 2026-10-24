import { redrawTrack } from './layoutInvalidation'
import Song from '../../stores/song'
import Settings from '../../stores/settingsState'
import {
  applyViewportPageMode,
  CM_TO_PX,
  DIN_A4_WIDTH_CM,
  recomputeViewportWidthFromContainer,
  tabViewportState,
} from '../../stores/tabViewportState'
import { typedEventBus } from '../../utils/typedEventBus'
import { TAB_SHEET } from '../../utils/tabSheetConstants'

let lastWidth = TAB_SHEET.completeWidth

export function disablePageMode(): void {
  const recomputedWidth = recomputeViewportWidthFromContainer()

  if (recomputedWidth != null && lastWidth !== recomputedWidth) {
    lastWidth = recomputedWidth
    applyViewportPageMode(false, recomputedWidth)
  } else {
    const nextPageMode = !Settings.pageMode
    const sheetWidthPx = nextPageMode
      ? DIN_A4_WIDTH_CM * CM_TO_PX
      : (recomputedWidth ?? TAB_SHEET.completeWidth)

    applyViewportPageMode(nextPageMode, sheetWidthPx)
    lastWidth = sheetWidthPx
  }

  redrawTrack(Song.currentTrackId, Song.currentVoiceId)

  typedEventBus.emit('ui.pageModeChanged', tabViewportState.pageMode)
}
