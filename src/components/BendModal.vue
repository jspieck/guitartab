<template>
  <BaseModal :modal-id="MODALS.BEND.id">
    <template #title>Bend</template>
    <div class="modal-stack">
      <svg id="bendEditor"></svg>
      <div class="modal-field">
        <label for="bendSelection">Preset</label>
        <div class="select">
          <select id="bendSelection">
            <option value="0">Bending</option>
            <option value="1">Bend / release</option>
            <option value="2">Bend / release / bend</option>
            <option value="3">Pre-bend</option>
            <option value="4">Pre-bend / release</option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="selectButton" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { MODALS } from '../assets/js/modals/modalTypes'
</script>
