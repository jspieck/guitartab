<template>
  <BaseModal :modal-id="DIALOGS.DIRECTION.id">
    <template #title>Navigation signs</template>
    <div class="modal-stack">
      <p class="modal-body-text">Signs on this bar (jumps go to them):</p>
      <ul class="modal-checkbox-list direction-list">
        <li v-for="target in DIRECTION_TARGETS" :key="target" class="modal-checkbox-row">
          <input
            :id="`direction-target-${target}`"
            v-model="handler.form.targets"
            :value="target"
            class="styled-checkbox"
            type="checkbox"
          />
          <label :for="`direction-target-${target}`">{{ DIRECTION_LABELS[target] }}</label>
        </li>
      </ul>
      <p class="modal-body-text">Jumps at the end of this bar:</p>
      <ul class="modal-checkbox-list direction-list">
        <li v-for="jump in DIRECTION_JUMPS" :key="jump" class="modal-checkbox-row">
          <input
            :id="`direction-jump-${jump}`"
            v-model="handler.form.jumps"
            :value="jump"
            class="styled-checkbox"
            type="checkbox"
          />
          <label :for="`direction-jump-${jump}`">{{ DIRECTION_LABELS[jump] }}</label>
        </li>
      </ul>
      <div class="modal-submit-row">
        <SubmitButton button-id="directionSelectButton" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { DirectionModalHandler } from '../services/dialogs/effectModals'
import { DIRECTION_JUMPS, DIRECTION_LABELS, DIRECTION_TARGETS } from '../utils/directions'

const handler = getDialogHandler<InstanceType<typeof DirectionModalHandler>>(DIALOGS.DIRECTION.id)
</script>

<style scoped>
.direction-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
