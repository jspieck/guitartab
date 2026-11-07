import { reactive } from 'vue'

/**
 * The score view (`Settings.scoreView`): several tracks stacked per system with shared bar
 * widths. Which tracks it shows is per song and not saved: `trackIds` null means all of them.
 * The edited track is always shown (`scoreTrackIds` in `services/editor/scoreLayout.ts`).
 */
export const scoreViewState = reactive({
  trackIds: null as number[] | null,
})

/** Top and bottom of each system of the last score layout, in row-group coordinates (print pages). */
export const scoreSystems: Array<{ top: number; bottom: number }> = []

export function resetScoreTracks(): void {
  scoreViewState.trackIds = null
}
