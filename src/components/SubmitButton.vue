<template>
  <svg
    @click="handleSubmit"
    class="checkmark selectButton"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 52 52"
  >
    <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
    <path
      class="checkmark__check"
      fill="none"
      d="M14.1 27.2l7.1 7.2 16.7-16.8"
    />
  </svg>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'submitInfo', event: MouseEvent): void
}>();

const handleSubmit = (event: MouseEvent) => {
  emit('submitInfo', event);
};
</script>
