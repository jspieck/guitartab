<template>
  <aside id="firstRunHint" class="first-run-hint" aria-labelledby="firstRunHintTitle">
    <div class="first-run-hint__header">
      <h2 id="firstRunHintTitle" class="first-run-hint__title">Getting started</h2>
      <button type="button" class="first-run-hint__close" aria-label="Close" @click="dismissFirstRunHint">×</button>
    </div>
    <ol v-if="layoutModeState.compact" class="first-run-hint__steps">
      <li><strong>Listen.</strong> Tap play; slow it down with the % menu.</li>
      <li><strong>Enter notes.</strong> Tap the pencil, then a string in the tab, then a fret.</li>
      <li><strong>Your own tabs.</strong> Pinch to zoom; open Guitar Pro, MusicXML, MIDI or .gt files from the ⋯ menu.</li>
      <li><strong>More music.</strong> Classical guitar pieces to hear and play along under Example songs.</li>
    </ol>
    <ol v-else class="first-run-hint__steps">
      <li><strong>Enter notes.</strong> Click a line in the tab, then type a fret number.</li>
      <li><strong>Listen.</strong> Press <kbd>Space</kbd> or the play button.</li>
      <li><strong>Bring your own tab.</strong> Open a Guitar Pro, MusicXML, MIDI or .gt file with the folder button.</li>
      <li><strong>More music.</strong> Classical guitar pieces to hear and play along under Example songs.</li>
    </ol>
    <p class="first-run-hint__more">
      More in the <a :href="GETTING_STARTED_URL" target="_blank" rel="noopener" class="first-run-hint__link">getting-started guide</a>.
    </p>
    <div class="first-run-hint__footer">
      <button v-if="!layoutModeState.compact" type="button" class="first-run-hint__link" @click="showShortcuts">All shortcuts <kbd>?</kbd></button>
      <span v-else />
      <span class="first-run-hint__actions">
        <button id="firstRunExampleSongs" type="button" class="autosave-banner__action autosave-banner__action--muted"
          @click="showExampleSongs">Example songs</button>
        <button type="button" class="autosave-banner__action" @click="dismissFirstRunHint">Got it</button>
      </span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { dismissFirstRunHint } from '../stores/firstRunHintState'
import { toggleShortcutsHelp } from '../stores/shortcutsHelpState'
import { layoutModeState } from '../stores/layoutModeState'
import { toolbarAction } from '../services/editor/toolbarActions'
import { GETTING_STARTED_URL } from '../services/whatsNew'

function showExampleSongs(): void {
  dismissFirstRunHint()
  toolbarAction('exampleSongs').run()
}

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
  background: var(--color-inverse);
  color: var(--color-inverse-text);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-shadow) 20%, transparent);
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

.first-run-hint__more {
  margin: 0 0 10px;
}

.first-run-hint__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.first-run-hint__actions {
  display: flex;
  gap: 6px;
}

.first-run-hint__link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-inverse-accent);
  font: inherit;
  cursor: pointer;
}

.first-run-hint kbd {
  padding: 0 5px;
  border: 1px solid var(--color-inverse-border);
  border-radius: 4px;
  background: var(--color-inverse-sunken);
  color: var(--color-inverse-text);
  font: 12px/17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
