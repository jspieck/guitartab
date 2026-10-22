import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/stores/settingsState'
import {
  activateClassicalNotation,
  deactivateClassicalNotation,
  ensureClassicalPreparedWhenActive,
  getClassicalLifecyclePhase,
  prepareClassicalLayoutMetrics,
  type ClassicalNotationEngine,
} from '../src/services/editor/classicalNotationLifecycle'
import {
  classicalNotationLayoutState,
  clearClassicalLayoutMetrics,
} from '../src/stores/classicalNotationLayoutState'

function createEngineMock(overrides: Partial<ClassicalNotationEngine> = {}): ClassicalNotationEngine {
  return {
    toggleClassicalVisibility: vi.fn(() => {
      Settings.vexFlowIsActive = !Settings.vexFlowIsActive
    }),
    computeVexFlowDataStructures: vi.fn(),
    syncLayoutMetrics: vi.fn(),
    ...overrides,
  }
}

describe('classicalNotationLifecycle', () => {
  beforeEach(() => {
    Settings.vexFlowIsActive = false
    clearClassicalLayoutMetrics()
  })

  it('prepareClassicalLayoutMetrics computes then syncs before optional version bump', () => {
    Settings.vexFlowIsActive = true
    const order: string[] = []
    const engine = createEngineMock({
      computeVexFlowDataStructures: vi.fn(() => {
        order.push('compute')
      }),
      syncLayoutMetrics: vi.fn(() => {
        order.push('sync')
      }),
    })

    const versionBefore = classicalNotationLayoutState.version
    prepareClassicalLayoutMetrics(engine, 0, 0, { bumpVersion: true })

    expect(order).toEqual(['compute', 'sync'])
    expect(classicalNotationLayoutState.version).toBe(versionBefore + 1)
    expect(getClassicalLifecyclePhase()).toBe('metrics-published')
  })

  it('prepareClassicalLayoutMetrics can skip version bump for quiet recompute', () => {
    Settings.vexFlowIsActive = true
    const engine = createEngineMock()
    const versionBefore = classicalNotationLayoutState.version

    prepareClassicalLayoutMetrics(engine, 0, 0, { bumpVersion: false })

    expect(engine.computeVexFlowDataStructures).toHaveBeenCalledWith(0, 0)
    expect(engine.syncLayoutMetrics).toHaveBeenCalled()
    expect(classicalNotationLayoutState.version).toBe(versionBefore)
  })

  it('activateClassicalNotation flips on then prepares metrics', () => {
    const engine = createEngineMock()

    activateClassicalNotation(engine, 2, 1)

    expect(Settings.vexFlowIsActive).toBe(true)
    expect(engine.toggleClassicalVisibility).toHaveBeenCalledOnce()
    expect(engine.computeVexFlowDataStructures).toHaveBeenCalledWith(2, 1)
    expect(engine.syncLayoutMetrics).toHaveBeenCalled()
    expect(getClassicalLifecyclePhase()).toBe('active')
  })

  it('deactivateClassicalNotation flips off and clears metrics', () => {
    Settings.vexFlowIsActive = true
    classicalNotationLayoutState.beatWidthByBlock[0] = 40
    const engine = createEngineMock()

    deactivateClassicalNotation(engine)

    expect(Settings.vexFlowIsActive).toBe(false)
    expect(classicalNotationLayoutState.beatWidthByBlock[0]).toBeUndefined()
    expect(getClassicalLifecyclePhase()).toBe('deactivated')
  })

  it('ensureClassicalPreparedWhenActive no-ops when classical is off', () => {
    const engine = createEngineMock()

    ensureClassicalPreparedWhenActive(engine, 0, 0)

    expect(engine.computeVexFlowDataStructures).not.toHaveBeenCalled()
    expect(getClassicalLifecyclePhase()).toBe('idle')
  })

  it('ensureClassicalPreparedWhenActive prepares when classical is on', () => {
    Settings.vexFlowIsActive = true
    const engine = createEngineMock()

    ensureClassicalPreparedWhenActive(engine, 0, 0)

    expect(engine.computeVexFlowDataStructures).toHaveBeenCalledWith(0, 0)
    expect(getClassicalLifecyclePhase()).toBe('active')
  })
})
