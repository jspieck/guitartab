<template>
  <BaseModal :modal-id="MODALS.ARTIFICIAL.id">
    <template #title>Harmonic</template>
    <div class="modal-stack">
      <div class="modal-field">
        <label for="harmonicSelection">Type</label>
        <div class="select">
          <select id="harmonicSelection">
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
        <SubmitButton button-id="harmonicSelectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
</script>
