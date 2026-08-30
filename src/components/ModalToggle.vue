<template>
  <label class="modal-toggle" :for="inputId">
    <input
      :id="inputId"
      type="checkbox"
      class="modal-toggle-input"
      :checked="checked"
      @change="onChange"
    />
    <span class="modal-toggle-track" aria-hidden="true">
      <span class="modal-toggle-thumb"></span>
    </span>
    <span class="modal-toggle-label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  inputId: string
  label: string
  checked?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', checked: boolean): void
}>()

function onChange(event: Event) {
  emit('change', (event.target as HTMLInputElement).checked)
}
</script>
