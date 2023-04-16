<template>
  <BaseModal>
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
</script>