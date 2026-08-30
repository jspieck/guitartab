<template>
  <button
    :id="buttonId"
    type="button"
    :class="variant === 'secondary' ? 'modal-secondary-button' : 'modal-primary-button'"
    @click="handleSubmit"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  buttonId?: string
  label?: string
  variant?: 'primary' | 'secondary'
}>(), {
  label: 'Apply',
  variant: 'primary',
})

const emit = defineEmits<{
  (e: 'submitInfo', event: MouseEvent): void
}>()

function handleSubmit(event: MouseEvent) {
  emit('submitInfo', event)
}
</script>
