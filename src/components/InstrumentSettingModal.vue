<template>

  <BaseModal :modal-id="MODALS.INSTRUMENT_SETTINGS.id">

    <template #title>Instrument Settings</template>

    <div class="modal-stack instrument-settings-layout">

      <div class="modal-section">

        <div class="modal-field-grid instrument-settings-identity">

          <div class="modal-field">

            <label for="instrumentNameInput">Name</label>

            <input id="instrumentNameInput" />

          </div>

          <div class="modal-field instrument-settings-color-field">

            <label for="instrumentColorPicker">Color</label>

            <div id="instrumentColorPicker" class="instrument-color-picker" readonly="readonly"></div>

          </div>

        </div>

      </div>



      <div class="modal-section">

        <div class="instrument-settings-controls">

          <ModalToggle input-id="ringCheckbox" label="Let it ring" />

          <div class="instrument-settings-select-row">

            <ModalSelectField label="String count" select-id="stringCountSelect">

              <select id="stringCountSelect">

                <option v-for="count in stringCounts" :key="count" :value="count">{{ count }}</option>

              </select>

            </ModalSelectField>

            <ModalSelectField label="Capo" select-id="capoSelect">

              <select id="capoSelect">

                <option v-for="num in 16" :key="num" :value="num - 1">{{ num - 1 }}</option>

              </select>

            </ModalSelectField>

          </div>

        </div>

      </div>



      <div class="modal-section">

        <label class="modal-field-label instrument-settings-section-label">String tuning</label>

        <p class="instrument-settings-help">Set the pitch of each open string.</p>

        <div class="instrument-settings-tuning-shell modal-surface-block">

          <div id="tuningAreaModal"></div>

        </div>

      </div>



      <div class="modal-submit-row">

        <SubmitButton @submit-info="submitSettings" />

      </div>

    </div>

  </BaseModal>

</template>



<script setup lang="ts">

import BaseModal from './BaseModal.vue'

import SubmitButton from './SubmitButton.vue'

import ModalToggle from './ModalToggle.vue'

import ModalSelectField from './ModalSelectField.vue'

import { MODALS } from '../services/dialogs/modalTypes'

import { modalManager } from '../services/dialogs/modalManager'

import { InstrumentSettingsModalHandler } from '../services/dialogs/instrumentSettingsModalHandler'



const stringCounts = [4, 5, 6, 7, 8, 9]

const handler = modalManager.getHandler(MODALS.INSTRUMENT_SETTINGS.id) as InstrumentSettingsModalHandler



function submitSettings() {

  handler.submitFromModal()

}

</script>



<style scoped>

.instrument-settings-layout {

  gap: 12px;

}



.instrument-settings-identity {

  grid-template-columns: minmax(0, 1fr) 112px;

}



.instrument-settings-color-field {

  min-width: 0;

}



.instrument-color-picker {

  width: 100%;

  min-height: var(--modal-control-height);

  border: 1px solid #9aa8bc;

  border-radius: 10px;

  background: #eef1f6;

  box-sizing: border-box;

  cursor: pointer;

}



.instrument-settings-controls {

  display: grid;

  gap: 12px;

}



.instrument-settings-select-row {

  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 12px;

  align-items: end;

}



.instrument-settings-section-label {
  font-weight: 600;
  color: var(--modal-text-strong);
}

.instrument-settings-help {

  margin: 4px 0 8px;

  color: var(--modal-text-muted);

  font-size: 13px;

  line-height: 1.4;

}



.instrument-settings-tuning-shell {

  padding: 10px;

}

</style>

