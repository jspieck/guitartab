<template>
  <BaseModal :modal-id="MODALS.MIDI.id">
    <template #title>Midi</template>
    <table id="midiDeviceList">
      <thead>
        <tr>
          <th>Device name</th>
          <th>Manufacturer</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="midiDeviceListBody"></tbody>
    </table>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue';
import { MODALS } from '../assets/js/modals/modalTypes';
import { MidiModalHandler } from '../assets/js/modals/MidiModalHandler';
import { modalManager } from '../assets/js/modals/modalManager';

const handler = modalManager.getHandler<MidiModalHandler>(MODALS.MIDI.id);  
</script>