<template>
  <div ref="rootRef" class="save-menu" @keydown.esc="close">
    <button
      id="downloadGP"
      type="button"
      class="tb-button"
      data-tip="Save as…"
      aria-label="Save as"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <AppIcon id="downloadIDGP" name="save" />
    </button>
    <!-- The toolbar clips its overflow, so the menu is rendered at the end of <body>. -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="save-menu__popover"
        role="menu"
        aria-label="Download as"
        :style="popoverStyle"
        @keydown.esc="close"
      >
        <button
          v-for="option in options"
          :id="`download-${option.format}`"
          :key="option.format"
          type="button"
          role="menuitem"
          class="save-menu__item"
          @click="choose(option.format)"
        >
          <span class="save-menu__label">{{ option.label }}</span>
          <span class="save-menu__hint">{{ option.hint }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { EXPORT_OPTIONS as options, exportSongAs, type ExportFormat } from '../utils/exportFormats'
import AppIcon from './AppIcon.vue'

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

function close(): void {
  open.value = false
}

function toggle(): void {
  if (open.value) {
    close()
    return
  }
  const rect = rootRef.value?.getBoundingClientRect()
  popoverStyle.value = rect ? { top: `${rect.bottom + 6}px`, left: `${rect.left}px` } : {}
  open.value = true
}

function choose(format: ExportFormat): void {
  close()
  exportSongAs(format)
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (open.value && !rootRef.value?.contains(target) && !popoverRef.value?.contains(target)) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', close)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', close)
})
</script>

<style scoped>
.save-menu {
  position: relative;
  display: inline-flex;
  /* Like the other toolbar buttons; on the baseline, the hover tooltip's text moved it. */
  vertical-align: top;
}

.save-menu__popover {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  width: 260px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-ui);
  box-shadow: var(--shadow-popover);
}

.save-menu__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--text-md);
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}

.save-menu__item:hover,
.save-menu__item:focus-visible {
  background: var(--color-hover);
  outline: none;
}

.save-menu__hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
</style>
