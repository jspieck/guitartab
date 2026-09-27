/**
 * Classical notation lifecycle — single source of truth for enable/load order.
 *
 * ## Activation order (must stay in this sequence)
 *
 * 1. **Load** VexFlow module (lazy `import`)
 * 2. **Flip** `Settings.vexFlowIsActive = true` (via notation.toggle)
 * 3. **Compute** `computeVexFlowDataStructures` so per-beat notation exists
 * 4. **Publish** beat widths via `syncLayoutMetrics` → `classicalNotationLayoutState`
 * 5. **Bump** `classicalNotationLayoutState.version` so Vue layout re-reads widths
 * 6. **Invalidate** Vue tab rows (`song-data-changed` / `render.all`)
 * 7. **Draw** only into registered `#vexFlowRow` surfaces after DOM mounts
 *
 * Layout (`measureLayoutEngine` → `Tab.computeWidthOfBlock`) reads classical beat
 * widths in step 6. Drawing before step 4/6 causes one-row / clipped layouts.
 *
 * ## Deactivation
 *
 * 1. Flip `Settings.vexFlowIsActive = false`
 * 2. `clearClassicalLayoutMetrics()`
 * 3. Invalidate Vue so rows recompute without classical widths
 *
 * Tab beat X inside a measure must stay **block-local** (`measureBeatLayout` /
 * `beatPositions`), never row-absolute.
 */

import Settings from '../../assets/js/settingManager'
import {
  clearClassicalLayoutMetrics,
  classicalNotationLayoutState,
} from '../../stores/classicalNotationLayoutState'

export interface ClassicalNotationEngine {
  toggleClassicalVisibility(): void
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  syncLayoutMetrics(): void
}

export type ClassicalLifecyclePhase =
  | 'idle'
  | 'loading'
  | 'structures-ready'
  | 'metrics-published'
  | 'active'
  | 'deactivated'

let lastPhase: ClassicalLifecyclePhase = 'idle'

export function getClassicalLifecyclePhase(): ClassicalLifecyclePhase {
  return lastPhase
}

/** Steps 3–5: structures → metrics store; optionally bump version for Vue layout. */
export function prepareClassicalLayoutMetrics(
  engine: ClassicalNotationEngine,
  trackId: number,
  voiceId: number,
  options: { bumpVersion?: boolean } = {},
): void {
  const bumpVersion = options.bumpVersion !== false
  lastPhase = 'loading'
  engine.computeVexFlowDataStructures(trackId, voiceId)
  lastPhase = 'structures-ready'
  engine.syncLayoutMetrics()
  if (bumpVersion) {
    classicalNotationLayoutState.version += 1
  }
  lastPhase = 'metrics-published'
}

/**
 * Full activate path after the VexFlow module is loaded.
 * Caller is responsible for Vue invalidation + surface redraw (steps 6–7).
 */
export function activateClassicalNotation(
  engine: ClassicalNotationEngine,
  trackId: number,
  voiceId: number,
): void {
  const wasActive = Settings.vexFlowIsActive
  engine.toggleClassicalVisibility()

  if (!Settings.vexFlowIsActive) {
    // Toggle turned classical off (or was blocked during track creation).
    if (wasActive) {
      clearClassicalLayoutMetrics()
      lastPhase = 'deactivated'
    }
    return
  }

  prepareClassicalLayoutMetrics(engine, trackId, voiceId, { bumpVersion: true })
  lastPhase = 'active'
}

/**
 * Full deactivate path when classical is currently on.
 * Caller handles Vue invalidation.
 */
export function deactivateClassicalNotation(
  engine: ClassicalNotationEngine,
): void {
  if (!Settings.vexFlowIsActive) {
    clearClassicalLayoutMetrics()
    lastPhase = 'deactivated'
    return
  }

  engine.toggleClassicalVisibility()
  clearClassicalLayoutMetrics()
  lastPhase = 'deactivated'
}

/** Startup / remount when settings already have classical on. */
export function ensureClassicalPreparedWhenActive(
  engine: ClassicalNotationEngine,
  trackId: number,
  voiceId: number,
): void {
  if (!Settings.vexFlowIsActive) {
    lastPhase = 'idle'
    return
  }

  prepareClassicalLayoutMetrics(engine, trackId, voiceId, { bumpVersion: true })
  lastPhase = 'active'
}
