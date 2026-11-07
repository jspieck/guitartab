import { reactive } from 'vue'
import { bumpSongDataVersion, songState } from './songState'
import { syncEditorScope } from './editorScopeState'

/**
 * What the tab must draw again, as version counters (Big win 30; replaces the seven `render.*`
 * events). Edits and commands bump them (`services/editor/renderCommands.ts`, `recordBarEdit`
 * and its undo/redo); components read them inside computeds, so they re-render through
 * Vue's dependency tracking instead of listening for events.
 *
 * - `song`: anything that changes the layout (the tab layout computed reads it).
 * - `bars[track:bar]`: the bars an edit changed, for code that wants one bar's changes only.
 * - `chords`: the chord library (chord manager, diagrams above the tab).
 */
export const renderVersionState = reactive({
  song: 0,
  bars: {} as Record<string, number>,
  chords: 0,
})

function barKey(trackId: number, blockId: number): string {
  return `${trackId}:${blockId}`
}

/** The version of one bar; reading it inside a computed makes that computed depend on it. */
export function barVersion(trackId: number, blockId: number): number {
  return renderVersionState.bars[barKey(trackId, blockId)] ?? 0
}

function invalidateSong(): void {
  // The tab reads the edited track and voice from the editor scope; keep them in step first.
  syncEditorScope(songState.currentTrackId, songState.currentVoiceId)
  bumpSongDataVersion()
  renderVersionState.song += 1
}

/** These bars changed (and so, possibly, the rows they sit in). */
export function invalidateBars(trackId: number, blockIds: Iterable<number>): void {
  for (const blockId of blockIds) {
    const key = barKey(trackId, blockId)
    renderVersionState.bars[key] = (renderVersionState.bars[key] ?? 0) + 1
  }
  invalidateSong()
}

/** The whole tab (a view switch, a deleted track, classical notation turned on). */
export function invalidateAll(): void {
  invalidateSong()
}

export function invalidateChords(): void {
  renderVersionState.chords += 1
  invalidateSong()
}
