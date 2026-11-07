<template>
  <BaseModal :modal-id="DIALOGS.INSTRUMENT_SETTINGS.id">
    <template #title>Instrument Settings</template>
    <div class="modal-stack instrument-settings-layout">
      <div class="modal-section">
        <div class="modal-field-grid instrument-settings-identity">
          <div class="modal-field">
            <label for="instrumentNameInput">Name</label>
            <input id="instrumentNameInput" v-model="form.name" />
          </div>
          <div class="modal-field instrument-settings-color-field">
            <label for="instrumentColorPicker">Color</label>
            <div
              id="instrumentColorPicker"
              ref="pickerParent"
              class="instrument-color-picker"
              :style="{ backgroundColor: cssColor }"
            ></div>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <div class="instrument-settings-controls">
          <ModalToggle input-id="ringCheckbox" label="Let it ring" :checked="form.letItRing" @change="form.letItRing = $event" />
          <div v-if="!form.drums" class="instrument-settings-select-row">
            <ModalSelectField label="String count" select-id="stringCountSelect">
              <select
                id="stringCountSelect"
                :value="form.numStrings"
                @change="handler.setStringCount(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="count in stringCounts" :key="count" :value="count">{{ count }}</option>
              </select>
            </ModalSelectField>
            <ModalSelectField label="Capo" select-id="capoSelect">
              <select id="capoSelect" v-model.number="form.capo">
                <option v-for="num in 16" :key="num" :value="num - 1">{{ num - 1 }}</option>
              </select>
            </ModalSelectField>
          </div>
        </div>
      </div>

      <p v-if="form.drums" class="instrument-settings-help">
        A drum track has one line per drum: change them in the drum map (footer: Drum map).
      </p>
      <div v-else class="modal-section">
        <label class="modal-field-label instrument-settings-section-label">String tuning</label>
        <p class="instrument-settings-help">Set the pitch of each open string.</p>
        <div class="instrument-settings-tuning-shell modal-surface-block">
          <div id="tuningAreaModal">
            <!-- Highest string first, as in the tab; the data index stays lowest-first. -->
            <div v-for="string in stringsHighFirst" :key="string" class="tuning-slot">
              <span class="tuning-slot__label">String {{ form.numStrings - string }}</span>
              <div class="select">
                <select
                  :id="`tuningSelect${string}`"
                  v-model.number="form.tuning[string]"
                  :aria-label="`String ${form.numStrings - string} tuning`"
                >
                  <option v-for="pitch in pitches" :key="pitch.value" :value="pitch.value">{{ pitch.name }}</option>
                </select>
                <div class="select__arrow"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-submit-row">
        <SubmitButton @submit-info="handler.submit()" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type Picker from 'vanilla-picker'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import ModalToggle from './ModalToggle.vue'
import ModalSelectField from './ModalSelectField.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { getDialogHandler } from '../services/dialogs/dialogHandlers'
import {
  TUNING_NOTE_NAMES,
  type InstrumentSettingsModalHandler,
} from '../services/dialogs/instrumentSettingsModalHandler'
import { isDialogOpen } from '../stores/dialogState'

const stringCounts = [4, 5, 6, 7, 8, 9]
const handler = getDialogHandler<InstrumentSettingsModalHandler>(DIALOGS.INSTRUMENT_SETTINGS.id)
const form = handler.form

const stringsHighFirst = computed(() => Array.from({ length: form.numStrings }, (_, i) => form.numStrings - 1 - i))
const pitches = Array.from({ length: 10 * 12 }, (_, value) => ({
  value,
  name: `${TUNING_NOTE_NAMES[value % 12]}${Math.floor(value / 12)}`,
}))

const cssColor = computed(() => `rgb(${form.color.red},${form.color.green},${form.color.blue})`)

// The colour picker (vanilla-picker) loads with the first opening, not at startup.
const pickerParent = ref<HTMLElement | null>(null)
let picker: Picker | null = null

async function setUpPicker() {
  const parent = pickerParent.value
  if (parent == null) return
  if (picker != null) {
    picker.setColor(cssColor.value, true)
    return
  }
  const { default: PickerClass } = await import('vanilla-picker')
  if (picker != null) return
  picker = new PickerClass({ parent, color: cssColor.value, popup: 'bottom', alpha: false })
  picker.onChange = (color: { rgba: number[] }) => {
    form.color = { red: color.rgba[0], green: color.rgba[1], blue: color.rgba[2] }
  }
  picker.onOpen = () => requestAnimationFrame(movePopupToBody)
  picker.onClose = movePopupBack
}

// The dialog mounts with its first opening; later openings only show it again.
onMounted(() => void setUpPicker())
watch(
  () => isDialogOpen(DIALOGS.INSTRUMENT_SETTINGS.id),
  (open) => {
    if (open) {
      void setUpPicker()
      return
    }
    // The popup lives on <body> while open; it must not outlive the dialog.
    picker?.hide()
    movePopupBack()
  },
  { flush: 'post' },
)

function findPopup(): HTMLElement | null {
  return (
    pickerParent.value?.querySelector<HTMLElement>('.picker_wrapper.popup') ??
    document.body.querySelector<HTMLElement>(':scope > .picker_wrapper.popup')
  )
}

// The dialog clips its overflow, so the open popup moves to <body>, fixed below the field.
function movePopupToBody() {
  const parent = pickerParent.value
  const wrapper = findPopup()
  if (parent == null || wrapper == null) return
  if (wrapper.parentElement !== document.body) document.body.appendChild(wrapper)
  const rect = parent.getBoundingClientRect()
  const width = wrapper.offsetWidth || 200
  const height = wrapper.offsetHeight || 220
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  const below = rect.bottom + 6
  const above = rect.top - height - 6
  const top = below + height > window.innerHeight - 8 && above > 8 ? above : below
  Object.assign(wrapper.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: '10001', margin: '0' })
}

function movePopupBack() {
  const parent = pickerParent.value
  const wrapper = findPopup()
  if (parent == null || wrapper == null || wrapper.parentElement !== document.body) return
  parent.appendChild(wrapper)
  Object.assign(wrapper.style, { position: '', left: '', top: '', zIndex: '', margin: '' })
}

onBeforeUnmount(() => {
  movePopupBack()
  picker?.destroy()
})
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
  min-height: var(--control-height);
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-surface-raised);
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

.instrument-settings-help {
  margin: 4px 0 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.instrument-settings-tuning-shell {
  padding: 10px;
}
</style>
