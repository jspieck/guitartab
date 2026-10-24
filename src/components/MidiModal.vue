<template>
  <BaseModal :modal-id="MODALS.MIDI.id">
    <template #title>Midi</template>
    <div class="modal-stack midi-modal">
      <p class="modal-body-text">Click a device to play and enter notes with it; click again to disconnect.</p>
      <div class="modal-surface-block midi-table-wrap">
        <table class="midi-table">
          <thead>
            <tr>
              <th>Device name</th>
              <th>Manufacturer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in midiState.devices" :key="device.id" :class="{ selectedRow: device.connected }"
              @click="toggleMidiDevice(device.id)">
              <td>{{ device.name }}</td>
              <td>{{ device.manufacturer }}</td>
              <td>{{ device.connected ? 'connected' : device.state }}</td>
            </tr>
            <tr v-if="midiState.devices.length === 0">
              <td colspan="3">{{ emptyText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { MODALS } from '../services/dialogs/modalTypes'
import { useModalOpen } from '../composables/useModalOpen'
import { midiState, refreshMidiDevices, toggleMidiDevice } from '../services/midi/devices'

const isOpen = useModalOpen(MODALS.MIDI.id)

// Ask for MIDI access only when the dialog is opened.
watch(isOpen, (open) => {
  if (open) void refreshMidiDevices()
})

const emptyText = computed(() => {
  if (!midiState.supported) return 'MIDI is not supported in this browser.'
  return midiState.error || 'No MIDI device available.'
})
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
