<template>
  <BaseModal :modal-id="DIALOGS.STROKE.id">
    <template #title>Stroke</template>
    <div class="modal-stack">
      <div class="modal-field-grid two-column">
        <div class="modal-field">
          <label for="strokeDirectionSelection">Direction</label>
          <div class="select">
            <select id="strokeDirectionSelection" v-model="handler.form.strokeType">
              <option value="up">Upstroke</option>
              <option value="down">Downstroke</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <div class="modal-field">
          <label for="strokeLengthSelection">Length</label>
          <div class="select">
            <select id="strokeLengthSelection" v-model.number="handler.form.strokeLength">
              <option :value="4">Quarter</option>
              <option :value="8">Eighth</option>
              <option :value="16">Sixteenth</option>
              <option :value="32">32nd</option>
              <option :value="64">64th</option>
              <option :value="128">128th</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton button-id="strokeSelectButton" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { StrokeModalHandler } from '../services/dialogs/effectModals'

const handler = getDialogHandler<InstanceType<typeof StrokeModalHandler>>(DIALOGS.STROKE.id)
</script>
