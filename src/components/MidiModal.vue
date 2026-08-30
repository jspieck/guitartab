<template>
  <BaseModal :modal-id="MODALS.MIDI.id">
    <template #title>Midi</template>
    <div class="modal-stack midi-modal">
      <div class="modal-surface-block midi-table-wrap">
        <table id="midiDeviceList" class="midi-table">
          <thead>
            <tr>
              <th>Device name</th>
              <th>Manufacturer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="midiDeviceListBody"></tbody>
        </table>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { MidiModalHandler } from "../assets/js/modals/MidiModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const handler = modalManager.getHandler<MidiModalHandler>(MODALS.MIDI.id);
</script>

<style scoped>
.midi-table-wrap {
  padding: 0;
  overflow: auto;
  max-height: min(50vh, 360px);
}

.midi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.midi-table th,
.midi-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--modal-divider);
  text-align: left;
}

.midi-table th {
  position: sticky;
  top: 0;
  background: var(--modal-card-subtle);
  color: var(--modal-text-strong);
  font-weight: 600;
}
</style>
