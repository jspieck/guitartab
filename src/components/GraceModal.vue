<template>
  <BaseModal :modal-id="MODALS.GRACE.id">
    <template #title>Grace note</template>
    <div class="modal-stack">
      <div class="modal-field-grid two-column">
        <div class="modal-field">
          <label for="grace-fret">Fret</label>
          <input id="grace-fret" v-model="graceModalData.fret" type="number" />
        </div>

        <div class="modal-field">
          <label for="grace-duration">Note length</label>
          <div class="select">
            <select id="grace-duration" v-model="graceModalData.duration">
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
            <select id="grace-timing" v-model="graceModalData.setOnBeat">
              <option value="before">Before the note</option>
              <option value="with">With the note</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>

        <div class="modal-field">
          <label for="grace-dynamic">Dynamic</label>
          <div class="select">
            <select id="grace-dynamic" v-model="graceModalData.dynamic">
              <option value="fff">fff</option>
              <option value="ff">ff</option>
              <option value="f">f</option>
              <option value="mf">mf</option>
              <option value="mp">mp</option>
              <option value="p">p</option>
              <option value="pp">pp</option>
              <option value="ppp">ppp</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>

        <div class="modal-field field-span-two">
          <label for="grace-transition">Transition</label>
          <div class="select">
            <select id="grace-transition" v-model="graceModalData.transition">
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
        <SubmitButton @submitInfo="onGraceSelectButtonClick" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import BaseModal from './BaseModal.vue'
import { GraceModalHandler } from '../assets/js/modals/graceModalHandler'
import { modalManager } from '../assets/js/modals/modalManager'
import { MODALS } from '../assets/js/modals/modalTypes'
import SubmitButton from './SubmitButton.vue'
import type { Note } from '../types/tab'

const graceModalDataDefault = {
  fret: 0,
  duration: 's',
  dynamic: 'f',
  transition: 'none',
  setOnBeat: 'before',
}

const graceModalData = ref({ ...graceModalDataDefault })
const handler = modalManager.getHandler<GraceModalHandler>(MODALS.GRACE.id)

watchEffect(() => {
  const note = handler.getModalState().notes[0]?.note
  if (note) {
    setGraceState(note)
  }
})

function setGraceState(note: Note) {
  const grace = note.graceObj
  if (grace != null) {
    graceModalData.value.fret = grace.fret
    graceModalData.value.duration = grace.duration
    graceModalData.value.dynamic = grace.dynamic
    graceModalData.value.transition = grace.transition
    graceModalData.value.setOnBeat = grace.setOnBeat
  } else {
    graceModalData.value = { ...graceModalDataDefault }
  }
}

function onGraceSelectButtonClick() {
  handler.updateGraceData(graceModalData.value)
  handler.applyGrace()
  modalManager.closeModal(handler.modalId)
}
</script>
