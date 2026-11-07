<template>
  <div ref="rootRef" class="tb-menu" data-fold-menu>
    <button
      :id="buttonId"
      ref="buttonRef"
      type="button"
      :class="label ? 'tb-pill' : 'tb-button'"
      :aria-label="name"
      :data-tip="name"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <AppIcon v-if="icon" :name="icon" :size="label ? 16 : 20" />
      <span v-if="label">{{ label }}</span>
      <AppIcon v-if="label" name="chevron-down" :size="14" />
    </button>
    <!-- The toolbar clips its overflow, so the menu is rendered at the end of <body>. -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="tb-popover"
        role="menu"
        :aria-label="name"
        :style="popoverStyle"
        @keydown="onMenuKeydown"
      >
        <template v-for="(entry, index) in entries" :key="index">
          <div v-if="entry.kind === 'heading'" class="tb-popover__heading" role="presentation">{{ entry.label }}</div>
          <button
            v-else-if="entry.kind === 'action'"
            :id="`${entry.action.id}-menuitem`"
            type="button"
            :role="entry.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'"
            class="tb-popover__item"
            :class="{ 'is-pressed': entry.pressed === true }"
            :aria-checked="entry.pressed"
            :disabled="entry.disabled"
            @click="choose(entry.action.run)"
          >
            <span class="tb-popover__icon" :class="{ 'tb-popover__icon--music-font': entry.action.musicFont }">
              <AppIcon v-if="iconOf(entry.action)" :name="iconOf(entry.action)!" :size="18" />
              <template v-else>{{ entry.action.text }}</template>
            </span>
            <span class="tb-popover__label">{{ entry.action.label }}{{ entry.action.opensDialog ? '…' : '' }}</span>
            <span v-if="shortcutOf(entry.action)" class="tb-popover__hint">{{ shortcutOf(entry.action) }}</span>
          </button>
          <button
            v-else
            :id="entry.id"
            type="button"
            :role="entry.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'"
            class="tb-popover__item"
            :class="{ 'is-pressed': entry.pressed === true }"
            :aria-checked="entry.pressed"
            @click="choose(entry.run)"
          >
            <span class="tb-popover__icon"><AppIcon v-if="entry.icon" :name="entry.icon" :size="18" /></span>
            <span class="tb-popover__label">{{ entry.label }}</span>
            <span v-if="entry.hint" class="tb-popover__hint">{{ entry.hint }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import type { IconName } from '../../assets/icons/icons'
import { actionTooltip, type ToolbarAction } from '../../services/editor/toolbarActions'
import { focusMenuItem } from './menuKeyboard'

export type ToolbarMenuEntry =
  | { kind: 'heading'; label: string }
  | { kind: 'action'; action: ToolbarAction; pressed?: boolean; disabled?: boolean }
  | { kind: 'item'; id: string; label: string; icon?: IconName; hint?: string; pressed?: boolean; run: () => void }

defineProps<{
  buttonId: string
  /** The menu's accessible name (and the button's tooltip). */
  name: string
  entries: ToolbarMenuEntry[]
  /** Shown on the button ("File ▾"); without it the button is just the icon. */
  label?: string
  icon?: IconName
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const anchor = ref<DOMRect | null>(null)

const POPOVER_WIDTH = 260

const popoverStyle = computed(() => {
  const rect = anchor.value
  if (rect == null) return {}
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8))
  return { top: `${rect.bottom + 6}px`, left: `${left}px`, width: `${POPOVER_WIDTH}px` }
})

function iconOf(action: ToolbarAction): IconName | undefined {
  return action.currentIcon?.() ?? action.icon
}

/** "Ctrl+Z" from the tooltip "Undo (Ctrl+Z)". */
function shortcutOf(action: ToolbarAction): string | null {
  return /\(([^)]+)\)$/.exec(actionTooltip(action))?.[1] ?? null
}

async function toggle(): Promise<void> {
  if (open.value) {
    close()
    return
  }
  anchor.value = buttonRef.value?.getBoundingClientRect() ?? null
  open.value = true
  await nextTick()
  focusMenuItem(popoverRef.value, 'first')
}

function close({ focusButton = false } = {}): void {
  if (!open.value) return
  open.value = false
  if (focusButton) buttonRef.value?.focus()
}

function choose(run: () => void): void {
  close({ focusButton: true })
  run()
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close({ focusButton: true })
  } else if (event.key === 'Tab') {
    close()
  } else if (focusMenuItem(popoverRef.value, event.key)) {
    event.preventDefault()
  }
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (open.value && !rootRef.value?.contains(target) && !popoverRef.value?.contains(target)) close()
}

function onResize(): void {
  close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', onResize)
})

defineExpose({ close })
</script>
