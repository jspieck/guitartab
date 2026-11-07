<template>
  <button
    :id="action.id"
    type="button"
    class="tb-button"
    :class="{ 'is-pressed': pressed === true, 'tb-button--text': icon == null, 'tb-button--music-font': action.musicFont }"
    :aria-label="action.label"
    :aria-pressed="pressed"
    :data-tip="actionTooltip(action)"
    :disabled="disabled"
    @click="action.run()"
  >
    <AppIcon v-if="icon != null" :name="icon" :size="iconSize" />
    <span v-else aria-hidden="true">{{ action.text }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import { actionTooltip, type ToolbarAction } from '../../services/editor/toolbarActions'

const props = withDefaults(
  defineProps<{
    action: ToolbarAction
    /** Undefined for buttons that aren't toggles (no aria-pressed). */
    pressed?: boolean
    disabled?: boolean
    iconSize?: number
  }>(),
  { pressed: undefined, disabled: false, iconSize: 20 },
)

const icon = computed(() => props.action.currentIcon?.() ?? props.action.icon)
</script>
