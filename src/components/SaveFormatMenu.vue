<template>
  <div ref="rootRef" class="save-menu" @keydown.esc="close">
    <button
      id="downloadGP"
      type="button"
      class="checkBoxNote playButton"
      data-tooltip="Download File"
      aria-label="Download file"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <img id="downloadIDGP" src="../assets/images/saveOwn.svg" alt="" />
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
import type { ExportFormat } from '../services/songExport'

const options: { format: ExportFormat, label: string, hint: string }[] = [
  { format: 'gt', label: 'GuitarTab (.gt)', hint: 'Everything, opens here again' },
  { format: 'gpx', label: 'Guitar Pro 6 (.gpx)', hint: 'For Guitar Pro 6, 7 and 8' },
  { format: 'gp5', label: 'Guitar Pro 5 (.gp5)', hint: 'For Guitar Pro, TuxGuitar, Songsterr' },
  { format: 'musicxml', label: 'MusicXML (.musicxml)', hint: 'For MuseScore, Finale, Sibelius, Dorico' },
]

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
  void import('../services/songExport').then(({ exportSong }) => exportSong(format))
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
  border-radius: 6px;
  background: #1f2937;
  color: #f9fafb;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
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
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.save-menu__item:hover,
.save-menu__item:focus-visible {
  background: #374151;
  outline: none;
}

.save-menu__hint {
  color: #d1d5db;
  font-size: 11px;
}
</style>
