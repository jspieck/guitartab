<template>
  <!-- The bodies come from the generated icon map (scripts/build-icons.mjs), not from user input. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg
    class="app-icon"
    :viewBox="icon.viewBox"
    :width="width ?? size"
    :height="height ?? size"
    aria-hidden="true"
    focusable="false"
    v-html="icon.body"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from '../assets/icons/icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number; width?: number; height?: number }>(), {
  size: 20,
  width: undefined,
  height: undefined,
})

const icon = computed(() => ICONS[props.name])
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  pointer-events: none;
  color: inherit;
}

/* The global `svg text` rule (graph editors) would otherwise win over the icons' fill attribute. */
.app-icon :deep(text) {
  fill: currentColor;
}
</style>
