<template>
  <BaseModal :modal-id="DIALOGS.GRACE.id">
    <template #title>Grace note</template>
    <div class="modal-stack">
      <div class="modal-field-grid two-column">
        <div class="modal-field">
          <label for="grace-fret">Fret</label>
          <input id="grace-fret" v-model.number="form.fret" type="number" min="0" />
        </div>
        <div class="modal-field">
          <label for="grace-duration">Note length</label>
          <div class="select">
            <select id="grace-duration" v-model="form.duration">
              <option value="e">Eighth</option>
              <option value="s">Sixteenth</option>
              <option value="t">Thirty-second</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <div class="modal-field">
          <label for="grace-timing">Timing</label>
          <div class="select">
            <select id="grace-timing" v-model="form.setOnBeat">
              <option value="before">Before the note</option>
              <option value="with">With the note</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <div class="modal-field">
          <label for="grace-dynamic">Dynamic</label>
          <div class="select">
            <select id="grace-dynamic" v-model="form.dynamic">
              <option v-for="dynamic in DYNAMICS" :key="dynamic" :value="dynamic">{{ dynamic }}</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <div class="modal-field field-span-two">
          <label for="grace-transition">Transition</label>
          <div class="select">
            <select id="grace-transition" v-model="form.transition">
              <option value="none">None</option>
              <option value="bending">Bending</option>
              <option value="slide">Slide</option>
              <option value="hammer">Hammer-on</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { GraceModalHandler } from '../services/dialogs/effectModals'

const DYNAMICS = ['fff', 'ff', 'f', 'mf', 'mp', 'p', 'pp', 'ppp']

const handler = getDialogHandler<InstanceType<typeof GraceModalHandler>>(DIALOGS.GRACE.id)
const { form } = handler
</script>
