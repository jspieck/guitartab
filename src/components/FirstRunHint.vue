<template>
  <aside id="firstRunHint" class="first-run-hint" aria-labelledby="firstRunHintTitle">
    <div class="first-run-hint__header">
      <h2 id="firstRunHintTitle" class="first-run-hint__title">Getting started</h2>
      <button type="button" class="first-run-hint__close" aria-label="Close" @click="dismissFirstRunHint">×</button>
    </div>
    <ol v-if="layoutModeState.compact" class="first-run-hint__steps">
      <li><strong>Listen.</strong> Tap play; slow it down with the % menu.</li>
      <li><strong>Enter notes.</strong> Tap the pencil, then a string in the tab, then a fret.</li>
      <li><strong>Your own tabs.</strong> Pinch to zoom; open Guitar Pro, MIDI or .gt files from the ⋯ menu.</li>
    </ol>
    <ol v-else class="first-run-hint__steps">
      <li><strong>Enter notes.</strong> Click a line in the tab, then type a fret number.</li>
      <li><strong>Listen.</strong> Press <kbd>Space</kbd> or the play button.</li>
      <li><strong>Bring your own tab.</strong> Open a Guitar Pro, MIDI or .gt file with the folder button.</li>
    </ol>
    <div class="first-run-hint__footer">
      <button v-if="!layoutModeState.compact" type="button" class="first-run-hint__link" @click="showShortcuts">All shortcuts <kbd>?</kbd></button>
      <span v-else />
      <button type="button" class="autosave-banner__action" @click="dismissFirstRunHint">Got it</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { dismissFirstRunHint } from '../stores/firstRunHintState'
import { toggleShortcutsHelp } from '../stores/shortcutsHelpState'
import { layoutModeState } from '../stores/layoutModeState'

function showShortcuts(): void {
  dismissFirstRunHint()
  toggleShortcutsHelp()
}
</script>

<style scoped>
.first-run-hint {
  position: fixed;
  /* Bottom right, above the footer and the sequencer toggle. */
  right: 16px;
  bottom: 56px;
  z-index: 1150;
  width: min(340px, calc(100vw - 32px));
  padding: 12px 14px;
  border-radius: 8px;
  background: #1f2937;
  color: #f9fafb;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  font-size: 13px;
}

.first-run-hint__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.first-run-hint__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.first-run-hint__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.first-run-hint__steps {
  margin: 8px 0 10px;
  padding-left: 20px;
  line-height: 1.45;
}

.first-run-hint__steps li + li {
  margin-top: 4px;
}

.first-run-hint__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.first-run-hint__link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #93c5fd;
  font: inherit;
  cursor: pointer;
}

.first-run-hint kbd {
  padding: 0 5px;
  border: 1px solid #4b5563;
  border-radius: 4px;
  background: #111827;
  color: #f9fafb;
  font: 12px/17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
