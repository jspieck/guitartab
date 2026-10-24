<template>
  <BaseModal :modal-id="MODALS.ARTIFICIAL.id">
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
          <div class="select__arrow"></div>
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
import { MODALS } from '../services/dialogs/modalTypes'
import { modalManager } from '../services/dialogs/modalManager'
import type { ArtificialModalHandler } from '../services/dialogs/effectModals'

const handler = modalManager.getHandler<InstanceType<typeof ArtificialModalHandler>>(MODALS.ARTIFICIAL.id)
</script>
