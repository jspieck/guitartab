<template>
  <BaseModal :modal-id="MODALS.DELETE_TRACK.id">
    <template #title>Delete</template>
    <div class="modal-stack">
      <p class="modal-body-text">Do you really want to delete this instrument? All of its data will be lost.</p>
      <div class="modal-button-row">
        <button id="noDelete" type="button" class="modal-secondary-button">Cancel</button>
        <button id="yesDelete" type="button" class="modal-danger-button">Delete</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
</script>
