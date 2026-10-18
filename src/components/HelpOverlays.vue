<template>
  <ShortcutsHelp v-if="shortcutsHelpState.open" />
  <FirstRunHint v-else-if="firstRunHintState.open" />
</template>

<script setup lang="ts">
// The shortcut sheet and the first-run card, loaded together on first use so they cost
// the startup chunk nothing.
import ShortcutsHelp from './ShortcutsHelp.vue'
import FirstRunHint from './FirstRunHint.vue'
import { shortcutsHelpState } from '../stores/shortcutsHelpState'
import { firstRunHintState } from '../stores/firstRunHintState'
</script>
