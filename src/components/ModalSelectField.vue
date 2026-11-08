<template>
  <div class="modal-field">
    <label :for="selectId">{{ label }}</label>
    <div class="select">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  selectId: string
}>()
</script>
