import { describe, expect, it, vi } from 'vitest'
import { ICONS } from '../src/assets/icons/icons'
import { SHORTCUTS } from '../src/utils/keyboardShortcuts'
import {
  MENU_DYNAMIC_BUTTON_IDS,
  MENU_NOTE_EFFECT_BUTTON_IDS,
  NOTE_LENGTH_BUTTON_BY_CODE,
} from '../src/utils/menuUiState'
import {
  actionsInGroup,
  actionTooltip,
  EDIT_TABS,
  groupsOfTab,
  TOOLBAR_ACTIONS,
  TOOLBAR_GROUPS,
  toolbarAction,
} from '../src/services/editor/toolbarActions'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
describe('toolbar action registry', () => {
  it('has unique ids, known groups, and icons that exist', () => {
    const ids = TOOLBAR_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
    const groups = new Set(TOOLBAR_GROUPS.map((group) => group.id))
    for (const action of TOOLBAR_ACTIONS) {
      expect(groups.has(action.group), action.id).toBe(true)
      // Every button shows something: an icon from the set or a text glyph (menu-only groups show labels).
      const menuOnly = action.group === 'clipboard' || action.group === 'beat'
      expect(action.icon != null || action.text != null || menuOnly, action.id).toBe(true)
      if (action.icon) expect(ICONS[action.icon], `${action.id} → ${action.icon}`).toBeDefined()
      if (action.shortcut) expect(SHORTCUTS.some((shortcut) => shortcut.id === action.shortcut)).toBe(true)
    }
  })

  it('keeps the element ids that e2e tests, toolbar state and older code use', () => {
    const ids = new Set(TOOLBAR_ACTIONS.map((action) => action.id))
    const used = [
      'openFile',
      'recoverDrafts',
      'shortcutsHelpButton',
      'stopButton',
      'recordButton',
      'play',
      'addMeasure',
      'removeMeasure',
      'classicalToggleButton',
      'zoomIn',
      'zoomOut',
      'guitarEyeToggle',
      'pianoEyeToggle',
      'undoButton',
      'redoButton',
      'voice0',
      'voice1',
      'tied',
      'dotted',
      'doubleDotted',
      'tuplet',
      ...MENU_NOTE_EFFECT_BUTTON_IDS,
      ...MENU_DYNAMIC_BUTTON_IDS,
      ...Object.values(NOTE_LENGTH_BUTTON_BY_CODE).filter((id) => id !== '128thNote'),
      'timeMeter',
      'bpmMeter',
      'openBar',
      'closeBar',
      'repeatAlternative',
      'addChord',
      'addText',
      'addMarker',
    ]
    expect(used.filter((id) => !ids.has(id))).toEqual([])
  })

  it('gives every edit tab its groups, in today’s order', () => {
    expect(EDIT_TABS.map((tab) => tab.label)).toEqual(['Note', 'Effects', 'Dynamics', 'Bar', 'Text'])
    for (const tab of EDIT_TABS) {
      expect(groupsOfTab(tab.id).length, tab.id).toBeGreaterThan(0)
      for (const group of groupsOfTab(tab.id))
        expect(actionsInGroup(group.id).length, group.id).toBeGreaterThan(0)
    }
    const effects = groupsOfTab('effects').flatMap((group) =>
      actionsInGroup(group.id).map((action) => action.id),
    )
    expect(effects).toHaveLength(21)
    expect(effects.slice(0, 3)).toEqual(['pullDown', 'slide', 'bend'])
  })

  it('puts the shortcut into the tooltip', () => {
    expect(actionTooltip(toolbarAction('quarterNote'), false)).toBe('Quarter note (Q)')
    expect(actionTooltip(toolbarAction('undoButton'), false)).toBe('Undo (Ctrl+Z)')
    expect(actionTooltip(toolbarAction('undoButton'), true)).toBe('Undo (⌘+Z)')
    expect(actionTooltip(toolbarAction('palmMute'), false)).toBe('Palm mute')
  })

  it('throws on an unknown id instead of rendering an empty button', () => {
    expect(() => toolbarAction('nope')).toThrow(/Unknown toolbar action/)
  })
})
