<template>
  <div class="shortcuts-help__backdrop" @click.self="closeShortcutsHelp">
    <div
      ref="dialogRef"
      id="shortcutsHelp"
      class="shortcuts-help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcutsHelpTitle"
      tabindex="-1"
      @keydown.esc.stop="closeShortcutsHelp"
    >
      <div class="shortcuts-help__header">
        <h2 id="shortcutsHelpTitle" class="shortcuts-help__title">Keyboard shortcuts</h2>
        <button type="button" class="shortcuts-help__close" aria-label="Close" @click="closeShortcutsHelp">×</button>
      </div>
      <p class="shortcuts-help__intro">
        Click a line in the tab to select a string, then type the fret. Shortcuts don't apply while you type in a text field.
      </p>
      <div class="shortcuts-help__groups">
        <section v-for="group in groups" :key="group.name" class="shortcuts-help__group">
          <h3 class="shortcuts-help__group-title">{{ group.name }}</h3>
          <dl class="shortcuts-help__list">
            <div v-for="shortcut in group.items" :key="shortcut.id" class="shortcuts-help__row" :data-shortcut="shortcut.id">
              <dt class="shortcuts-help__keys">
                <template v-for="(combo, comboIndex) in shortcut.keys" :key="comboIndex">
                  <span v-if="comboIndex > 0" class="shortcuts-help__or">or</span>
                  <span class="shortcuts-help__combo">
                    <kbd v-for="key in displayKeys(combo, mac)" :key="key">{{ key }}</kbd>
                  </span>
                </template>
              </dt>
              <dd class="shortcuts-help__description">{{ shortcut.description }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { displayKeys, groupShortcuts, isMacPlatform } from '../utils/keyboardShortcuts'
import { closeShortcutsHelp } from '../stores/shortcutsHelpState'

const groups = groupShortcuts()
const mac = isMacPlatform()
const dialogRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  dialogRef.value?.focus()
})

onBeforeUnmount(() => {
  previousFocus?.focus?.()
})
</script>

<style scoped>
.shortcuts-help__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 96px 16px 16px;
  background: var(--color-backdrop);
}

.shortcuts-help {
  width: min(720px, 100%);
  max-height: calc(100vh - 128px);
  overflow: auto;
  padding: 16px 20px 20px;
  border-radius: 10px;
  background: var(--color-inverse);
  color: var(--color-inverse-text);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--color-shadow) 25%, transparent);
  outline: none;
  line-height: 1.4;
}

.shortcuts-help__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shortcuts-help__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.shortcuts-help__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.shortcuts-help__intro {
  margin: 6px 0 14px;
  color: var(--color-inverse-muted);
  font-size: 13px;
}

.shortcuts-help__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 6px 28px;
}

.shortcuts-help__group-title {
  margin: 10px 0 4px;
  color: var(--color-inverse-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shortcuts-help__list {
  margin: 0;
}

.shortcuts-help__row {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 12px;
  align-items: baseline;
  padding: 5px 0;
  border-top: 1px solid var(--color-inverse-border);
}

.shortcuts-help__keys {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.shortcuts-help__combo {
  display: inline-flex;
  gap: 3px;
}

.shortcuts-help__or {
  color: var(--color-inverse-faint);
  font-size: 12px;
}

.shortcuts-help kbd {
  min-width: 14px;
  padding: 1px 6px;
  border: 1px solid var(--color-inverse-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--color-inverse-sunken);
  font: 12px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: center;
  white-space: nowrap;
}

.shortcuts-help__description {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}
</style>
