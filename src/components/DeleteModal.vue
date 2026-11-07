<template>
  <BaseModal :modal-id="DIALOGS.DELETE_TRACK.id">
    <template #title>Delete</template>
    <div class="modal-stack">
      <p class="modal-body-text">Do you really want to delete this instrument? All of its data will be lost.</p>
      <div class="modal-button-row">
        <button id="noDelete" type="button" class="modal-secondary-button" @click="handler.closeModal()">Cancel</button>
        <button id="yesDelete" type="button" class="modal-danger-button" @click="handler.confirm()">Delete</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { DIALOGS } from "../services/dialogs/dialogs";
import { getDialogHandler } from "../services/dialogs/dialogHandlers";
import type { DeleteTrackModalHandler } from "../services/dialogs/deleteTrackModalHandler";

const handler = getDialogHandler<DeleteTrackModalHandler>(DIALOGS.DELETE_TRACK.id);
</script>
