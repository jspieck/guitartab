<template>
  <Teleport to="body">
    <!-- A tap on the dimmed tab closes the sheet: on click, so the tap doesn't reach the tab, and only
         for a tap that started here (the click the browser sends after the opening long-press doesn't). -->
    <div
      v-if="noteMenuState.open && noteMenuState.sheet"
      class="note-menu-backdrop"
      @pointerdown="backdropPressed = true"
      @click="onBackdropClick"
    />
    <div
      v-if="noteMenuState.open"
      id="noteMenu"
      ref="menuRef"
      class="note-menu"
      :class="{ 'note-menu--sheet': noteMenuState.sheet }"
      role="menu"
      aria-label="Note menu"
      :style="menuStyle"
      @keydown="onKeydown"
      @contextmenu.prevent
    >
      <div v-if="noteMenuState.sheet" class="note-menu__grabber" aria-hidden="true" />
      <div class="note-menu__header">
        <span class="note-menu__position">{{ positionText }}</span>
        <!-- Escape closes the menu; a non-item button inside role="menu" would break its structure. -->
        <button type="button" class="note-menu__close" aria-hidden="true" tabindex="-1" @click="close()">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="note-menu__section-label" aria-hidden="true">Effects</div>
      <div class="note-menu__grid" role="group" aria-label="Effects">
        <button
          v-for="action in shownEffects"
          :key="action.id"
          type="button"
          role="menuitemcheckbox"
          class="note-menu__toggle"
          :class="{ 'is-pressed': isPressed(action.id) }"
          :aria-checked="isPressed(action.id)"
          :disabled="isDisabled(action.id)"
          @click="runAction(action)"
        >
          <span class="note-menu__glyph">
            <AppIcon v-if="action.icon" :name="action.icon" :size="22" />
            <span v-else class="note-menu__letter">{{ action.text }}</span>
          </span>
          <span class="note-menu__toggle-label">{{ action.label }}{{ action.opensDialog ? '…' : '' }}</span>
        </button>
      </div>

      <div class="note-menu__section-label" aria-hidden="true">Dynamics</div>
      <div class="note-menu__row" role="group" aria-label="Dynamics">
        <button
          v-for="action in dynamics"
          :key="action.id"
          type="button"
          role="menuitemcheckbox"
          class="note-menu__chip note-menu__chip--music-font"
          :class="{ 'is-pressed': isPressed(action.id) }"
          :aria-checked="isPressed(action.id)"
          :aria-label="action.label"
          :title="action.label"
          :disabled="isDisabled(action.id)"
          @click="runAction(action)"
        >{{ action.text }}</button>
      </div>

      <div class="note-menu__section-label" aria-hidden="true">Length</div>
      <div class="note-menu__row" role="group" aria-label="Note length">
        <button
          v-for="action in lengths"
          :key="action.id"
          type="button"
          role="menuitemradio"
          class="note-menu__chip"
          :class="{ 'is-pressed': isPressed(action.id) }"
          :aria-checked="isPressed(action.id)"
          :aria-label="action.label"
          :title="actionTooltip(action)"
          :disabled="isDisabled(action.id)"
          @click="runAction(action)"
        >
          <AppIcon v-if="action.icon" :name="action.icon" :size="20" />
        </button>
      </div>

      <div class="note-menu__divider" role="separator" />
      <button v-if="!allEffects" type="button" role="menuitem" class="note-menu__item" @click="showAllEffects">
        <span class="note-menu__label">All effects…</span>
      </button>
      <template v-for="submenu in submenus" :key="submenu.id">
        <button
          :id="`noteMenu-${submenu.id}`"
          type="button"
          role="menuitem"
          class="note-menu__item"
          aria-haspopup="menu"
          :aria-expanded="openSubmenu === submenu.id"
          @click="toggleSubmenu(submenu.id)"
        >
          <span class="note-menu__label">{{ submenu.label }}</span>
          <AppIcon :name="openSubmenu === submenu.id ? 'chevron-up' : 'chevron-down'" :size="16" />
        </button>
        <div v-if="openSubmenu === submenu.id" class="note-menu__submenu" role="group" :aria-label="submenu.label">
          <button
            v-for="action in submenu.actions"
            :key="action.id"
            type="button"
            :role="isToggle(action) ? 'menuitemcheckbox' : 'menuitem'"
            class="note-menu__item note-menu__item--nested"
            :class="{ 'is-pressed': isToggle(action) && isPressed(action.id) }"
            :aria-checked="isToggle(action) ? isPressed(action.id) : undefined"
            :disabled="isDisabled(action.id)"
            @click="runAction(action, { close: true })"
          >
            <AppIcon v-if="action.icon" :name="action.icon" :size="20" />
            <span class="note-menu__label">{{ action.label }}{{ action.opensDialog ? '…' : '' }}</span>
          </button>
        </div>
      </template>

      <div class="note-menu__divider" role="separator" />
      <button
        v-for="action in clipboard"
        :key="action.id"
        type="button"
        role="menuitem"
        class="note-menu__item"
        @click="runAction(action, { close: true })"
      >
        <span class="note-menu__label">{{ action.label }}</span>
        <span v-if="keysOf(action)" class="note-menu__hint">{{ keysOf(action) }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import Song from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import { closeNoteMenu, noteMenuState, setEditTab } from '../../stores/toolbarUiState'
import { currentLoopInterval } from '../../services/editor/rangeSelection'
import editorCore from '../../services/editor/editorCore'
import {
  actionsInGroup,
  actionTooltip,
  groupsOfTab,
  toolbarAction,
  type ToolbarAction,
} from '../../services/editor/toolbarActions'
import { formatCursorPosition } from '../../utils/positionLabel'
import { focusMenuItem } from './menuKeyboard'

const props = defineProps<{
  isPressed: (id: string) => boolean
  isDisabled: (id: string) => boolean
}>()

// The effects used most, as labelled toggles; the rest are one click away under "All effects".
const quickEffects = ['pullDown', 'slide', 'bend', 'vibrato', 'palmMute', 'letRing', 'dead', 'ghost'].map(
  toolbarAction,
)
const dynamics = actionsInGroup('dynamics')
const lengths = [...actionsInGroup('length'), toolbarAction('dotted')]
const clipboard = actionsInGroup('clipboard')
const everyEffect = groupsOfTab('effects').flatMap((group) => actionsInGroup(group.id))
const submenus = [
  {
    id: 'bar',
    label: 'Bar',
    actions: ['timeMeter', 'bpmMeter', 'openBar', 'closeBar', 'repeatAlternative', 'addMeasure', 'removeMeasure'].map(
      toolbarAction,
    ),
  },
  { id: 'text', label: 'Text', actions: actionsInGroup('text') },
  { id: 'beat', label: 'Beat', actions: actionsInGroup('beat') },
]
/** Bar-structure commands, not states; everything else in the submenus shows pressed. */
const COMMANDS = new Set(['addMeasure', 'removeMeasure', ...actionsInGroup('beat').map((action) => action.id)])

const menuRef = ref<HTMLElement | null>(null)
const openSubmenu = ref<string | null>(null)
/** The phone has no edit bar: "All effects" shows them here instead of switching its tab. */
const allEffects = ref(false)
let backdropPressed = false
const shownEffects = computed(() => (allEffects.value ? everyEffect : quickEffects))
const size = ref({ width: 0, height: 0 })

const isPressed = (id: string) => props.isPressed(id)
const isDisabled = (id: string) => props.isDisabled(id)
const isToggle = (action: ToolbarAction) => !COMMANDS.has(action.id)

const positionText = computed(() => {
  const range = currentLoopInterval()
  if (range != null && range.trackId === selectionState.cursor.trackId) {
    const start = `bar ${range.startBlock + 1} beat ${range.startBeat + 1}`
    const end = `bar ${range.endBlock + 1} beat ${range.endBeat + 1}`
    return `Selection: ${start} – ${end}`
  }
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  const note = editorCore.getNote(trackId, blockId, voiceId, beatId, string)
  return formatCursorPosition({ blockId, beatId, string }, Song.tracks[trackId]?.numStrings ?? 6, note?.fret)
})

const MARGIN = 8

const menuStyle = computed(() => {
  if (noteMenuState.sheet) return {}
  const { width, height } = size.value
  const left = Math.max(MARGIN, Math.min(noteMenuState.x, window.innerWidth - width - MARGIN))
  // Below the point if it fits, otherwise above it, otherwise as high as the window allows.
  const below = noteMenuState.y + MARGIN
  const top =
    below + height <= window.innerHeight - MARGIN
      ? below
      : Math.max(MARGIN, Math.min(noteMenuState.y - height - MARGIN, window.innerHeight - height - MARGIN))
  return { left: `${left}px`, top: `${top}px` }
})

function keysOf(action: ToolbarAction): string | null {
  return /\(([^)]+)\)$/.exec(actionTooltip(action))?.[1] ?? null
}

function close({ restoreFocus = true } = {}): void {
  openSubmenu.value = null
  allEffects.value = false
  closeNoteMenu({ restoreFocus })
}

/** Toggles stay open so several can be set in a row; dialogs and one-off commands close it. */
function runAction(action: ToolbarAction, { close: closeAfter = false } = {}): void {
  if (closeAfter || action.opensDialog) close({ restoreFocus: !action.opensDialog })
  action.run()
}

async function showAllEffects(): Promise<void> {
  if (noteMenuState.sheet) {
    allEffects.value = true
    await nextTick()
    measure()
    return
  }
  setEditTab('effects')
  close()
}

async function toggleSubmenu(id: string): Promise<void> {
  openSubmenu.value = openSubmenu.value === id ? null : id
  await nextTick()
  measure()
}

function measure(): void {
  const rect = menuRef.value?.getBoundingClientRect()
  if (rect) size.value = { width: rect.width, height: rect.height }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
  } else if (event.key === 'Tab') {
    close()
  } else if (focusMenuItem(menuRef.value, event.key)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function onBackdropClick(): void {
  if (backdropPressed) close({ restoreFocus: false })
  backdropPressed = false
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Element
  // The sheet's backdrop closes on click instead.
  if (target.classList?.contains('note-menu-backdrop')) return
  if (noteMenuState.open && !menuRef.value?.contains(target)) close({ restoreFocus: false })
}

function onViewportChange(event: Event): void {
  // Scrolling the menu itself (a long list) is not the page moving away from it.
  if (event.target instanceof Node && menuRef.value?.contains(event.target)) return
  if (noteMenuState.open && !noteMenuState.sheet) close({ restoreFocus: false })
}

watch(
  () => noteMenuState.open && `${noteMenuState.x},${noteMenuState.y}`,
  async (opened) => {
    if (!opened) return
    openSubmenu.value = null
    allEffects.value = false
    backdropPressed = false
    size.value = { width: 0, height: 0 }
    await nextTick()
    measure()
    // Keyboard users land on the first entry; a finger (the sheet) doesn't need a focus ring.
    if (!noteMenuState.sheet) focusMenuItem(menuRef.value, 'first')
  },
  // The component loads on the first open, so that open must count too.
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('resize', onViewportChange)
  document.addEventListener('scroll', onViewportChange, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
/* Phones: a bottom sheet over a dimmed tab, with finger-sized targets. */
.note-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1090;
  background: var(--color-backdrop);
}

.note-menu.note-menu--sheet {
  right: 0;
  bottom: 0;
  left: 0;
  width: auto;
  max-height: 75vh;
  padding: 4px var(--space-3) calc(var(--space-3) + env(safe-area-inset-bottom));
  border-width: 1px 0 0;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  font-size: var(--text-lg);
}

.note-menu__grabber {
  flex: none;
  width: 36px;
  height: 4px;
  margin: 4px auto 6px;
  border-radius: 2px;
  background: var(--color-border-strong);
}

.note-menu--sheet .note-menu__grid {
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
}

.note-menu--sheet .note-menu__chip,
.note-menu--sheet .note-menu__item,
.note-menu--sheet .note-menu__close {
  min-height: 44px;
}

.note-menu--sheet .note-menu__close {
  width: 44px;
}

.note-menu__letter {
  font-size: var(--text-lg);
  font-weight: 700;
}

.note-menu {
  position: fixed;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  width: 336px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: var(--text-md);
  line-height: 1.3;
  box-shadow: var(--shadow-popover);
  box-sizing: border-box;
}

.note-menu__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 2px 2px var(--space-2) var(--space-1);
}

.note-menu__position {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.note-menu__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.note-menu__section-label {
  margin: var(--space-1) var(--space-1) 2px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.note-menu__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}

.note-menu__toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-height: 52px;
  padding: 4px 2px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--text-xs);
  cursor: pointer;
}

.note-menu__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
}

.note-menu__toggle-label {
  text-align: center;
}

.note-menu__row {
  display: flex;
  gap: 2px;
}

.note-menu__chip {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 34px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
}

.note-menu__chip--music-font {
  font-family: notesFont;
  font-size: 20px;
}

.note-menu__divider {
  height: 1px;
  margin: var(--space-2) 0 var(--space-1);
  background: var(--color-divider);
}

.note-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.note-menu__item--nested {
  padding-left: var(--space-4);
}

.note-menu__label {
  flex: 1;
}

.note-menu__hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.note-menu__submenu {
  display: flex;
  flex-direction: column;
}

/* Only real hover: on a touch screen the tint would stay where the finger was. */
@media (hover: hover) {
  .note-menu button:hover:not(:disabled) {
    background: var(--color-hover);
  }
}

.note-menu button.is-pressed {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.note-menu button:disabled {
  color: var(--color-text-faint);
  cursor: default;
}

.note-menu button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}
</style>
