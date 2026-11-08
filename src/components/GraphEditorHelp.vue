<template>
  <!-- One line of help under a graph editor (bend, tremolo bar). The info button opens the
       details as a popover over the dialog, so the dialog keeps its size and nothing moves. -->
  <div class="graph-help">
    <span>{{ summary }}</span>
    <button
      ref="buttonRef"
      type="button"
      class="graph-help__button"
      :aria-expanded="open"
      :aria-controls="popoverId"
      aria-label="More about this graph"
      @click="toggle"
    >
      <AppIcon name="info" :size="16" />
    </button>
    <!-- The dialog body scrolls and clips, so the popover lives at the end of <body>. -->
    <Teleport to="body">
      <ul
        v-if="open"
        :id="popoverId"
        ref="popoverRef"
        class="graph-help__popover"
        :style="popoverStyle"
      >
        <slot></slot>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import AppIcon from './AppIcon.vue'

defineProps<{ summary: string }>()

const MARGIN = 8
const GAP = 6

const popoverId = `graph-help-${useId()}`
const open = ref(false)
const buttonRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

/** Below the button, right-aligned with it; flipped above when there is no room below. */
function place() {
  const button = buttonRef.value
  const popover = popoverRef.value
  if (button == null || popover == null) return
  const anchor = button.getBoundingClientRect()
  const { width, height } = popover.getBoundingClientRect()
  const left = Math.max(MARGIN, Math.min(anchor.right - width, window.innerWidth - width - MARGIN))
  const below = anchor.bottom + GAP
  const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, anchor.top - GAP - height) : below
  popoverStyle.value = { left: `${left}px`, top: `${top}px` }
}

function onPointerDownOutside(event: PointerEvent) {
  const target = event.target as Node
  if (popoverRef.value?.contains(target) || buttonRef.value?.contains(target)) return
  close()
}

async function show() {
  open.value = true
  popoverStyle.value = { visibility: 'hidden' }
  await nextTick()
  place()
  document.addEventListener('pointerdown', onPointerDownOutside, true)
  document.addEventListener('keydown', onEscape, true)
  window.addEventListener('resize', close)
}

function close() {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
  document.removeEventListener('keydown', onEscape, true)
  window.removeEventListener('resize', close)
}

function toggle() {
  if (open.value) close()
  else void show()
}

// While open, Escape (wherever the focus is) closes the popover first, not the dialog:
// capture phase, before ModalsContainer's document listener.
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  close()
  buttonRef.value?.focus()
}

onBeforeUnmount(close)
</script>

<style scoped>
.graph-help {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.graph-help__button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-accent);
  cursor: pointer;
}

.graph-help__button:hover,
.graph-help__button[aria-expanded='true'] {
  background: var(--color-hover);
}

.graph-help__button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.graph-help__popover {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  width: min(320px, calc(100vw - 16px));
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.graph-help__popover :slotted(li:not(:first-child)) {
  margin-top: 4px;
}
</style>
