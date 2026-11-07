<template>
  <!-- The sequencer clips its overflow, so the menu is rendered at the end of <body>. -->
  <Teleport to="body">
    <div
      ref="menuRef"
      class="track-menu"
      role="menu"
      :aria-label="`${trackName} track`"
      :style="style"
      @keydown="onKeyDown"
    >
      <button id="trackMenuSettings" type="button" role="menuitem" class="track-menu__item" @click="choose(openTrackSettings)">
        <AppIcon name="edit" />
        <span>Track settings and tuning…</span>
      </button>
      <button id="trackMenuInstrument" type="button" role="menuitem" class="track-menu__item" @click="choose(openChangeInstrument)">
        <AppIcon name="guitar" />
        <span>Change instrument…</span>
      </button>
      <div class="track-menu__separator" role="separator" />
      <button
        id="trackMenuDelete"
        type="button"
        role="menuitem"
        class="track-menu__item track-menu__item--danger"
        @click="choose(requestDeleteTrack)"
      >
        <AppIcon name="trash" />
        <span>Delete track…</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { openChangeInstrument, openTrackSettings, requestDeleteTrack } from '../services/editor/trackActions'
import AppIcon from './AppIcon.vue'
import { focusMenuItem } from './toolbar/menuKeyboard'

/** A track's menu in the sequencer, opened from the edit button at the end of its row. */
const props = defineProps<{ trackId: number; trackName: string; anchor: HTMLElement }>()
const emit = defineEmits<{ close: [] }>()

const menuRef = ref<HTMLElement | null>(null)

// The sequencer sits at the bottom of the window, so the menu opens upwards from the button.
const style = computed(() => {
  const rect = props.anchor.getBoundingClientRect()
  return { left: `${rect.left}px`, bottom: `${window.innerHeight - rect.top + 4}px` }
})

function close(returnFocus: boolean): void {
  emit('close')
  if (returnFocus) props.anchor.focus()
}

function choose(action: (trackId: number) => void): void {
  close(false)
  action(props.trackId)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'Tab') {
    event.preventDefault()
    event.stopPropagation()
    close(true)
  } else if (focusMenuItem(menuRef.value, event.key)) {
    event.preventDefault()
  }
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  // A click on the opener toggles the menu there.
  if (!menuRef.value?.contains(target) && !props.anchor.contains(target)) close(false)
}

const onResize = () => close(false)

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('resize', onResize)
  void nextTick(() => focusMenuItem(menuRef.value, 'first'))
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.track-menu {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  min-width: 210px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-ui);
  box-shadow: var(--shadow-popover);
}

.track-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
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

.track-menu__item svg {
  width: 16px;
  height: 16px;
  flex: none;
}

.track-menu__item:hover,
.track-menu__item:focus-visible {
  background: var(--color-hover);
  outline: none;
}

.track-menu__item--danger {
  color: var(--color-danger);
}

.track-menu__separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--color-border);
}
</style>
