<template>
  <BaseModal :modal-id="DIALOGS.ARTIFICIAL.id">
    <template #title>Harmonic</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="harmonicSelection">Type</label>
        <div class="select">
          <select id="harmonicSelection" v-model="handler.form.style">
            <option value="N.H.">Natural harmonic (N.H.)</option>
            <option value="A.H.">Artificial harmonic (A.H.)</option>
            <option value="T.H.">Tapped harmonic (T.H.)</option>
            <option value="P.H.">Pinch harmonic (P.H.)</option>
            <option value="S.H.">Semi harmonic (S.H.)</option>
          </select>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="harmonicSelectButton" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { ArtificialModalHandler } from '../services/dialogs/effectModals'

const handler = getDialogHandler<InstanceType<typeof ArtificialModalHandler>>(DIALOGS.ARTIFICIAL.id)
</script>
