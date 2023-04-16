<template>
  <BaseModal>
    <template #title>Delete</template>
    <h4 class="modalCaption">Do you really want to delete the instrument?</h4>
    <button id="yesDelete" class="deleteButton">
      Yes, all data will be lost
    </button>
    <button id="noDelete" class="deleteButton">No</button>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
</script>
