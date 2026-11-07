<template>
  <BaseModal :modal-id="DIALOGS.KEY_SIGNATURE.id">
    <template #title>Key signature</template>
    <div class="modal-stack modal-stack-compact">
      <div class="modal-field modal-field-compact">
        <label for="key-signature-fifths">Key</label>
        <select id="key-signature-fifths" v-model.number="handler.form.fifths">
          <option v-for="option in options" :key="option.fifths" :value="option.fifths">{{ option.label }}</option>
        </select>
      </div>
      <div class="modal-checkbox-row">
        <input id="key-signature-minor" v-model="handler.form.minor" type="checkbox" />
        <label for="key-signature-minor">Minor</label>
      </div>
      <p class="key-signature-hint">Holds until the next key change, in every track. Shown on the classical staff.</p>
      <div class="modal-submit-row">
        <SubmitButton button-id="keySignatureSubmit" @submitInfo="handler.apply()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import type { KeySignatureModalHandler } from '../services/dialogs/effectModals'
import { keyName } from '../utils/keySignature'

const handler = getDialogHandler<InstanceType<typeof KeySignatureModalHandler>>(DIALOGS.KEY_SIGNATURE.id)

/** −7…7 fifths, named in the chosen mode, with the number of sharps or flats. */
const options = computed(() =>
  Array.from({ length: 15 }, (_, i) => {
    const fifths = i - 7
    const count = Math.abs(fifths)
    const signs = fifths === 0 ? 'no sharps or flats' : `${count} ${fifths > 0 ? 'sharp' : 'flat'}${count > 1 ? 's' : ''}`
    return { fifths, label: `${keyName({ keySignature: fifths, keyMinor: handler.form.minor })} (${signs})` }
  }),
)
</script>

<style scoped>
.key-signature-hint {
  margin: 0;
  max-width: 260px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
