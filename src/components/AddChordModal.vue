<template>
  <BaseModal :modal-id="MODALS.ADD_CHORD.id">
    <template #title>Chord</template>
    <div class="modal-stack chord-modal">
      <div class="modal-section chord-diagram-section">
        <div class="chord-diagram-header">
          <label class="modal-field-label" for="chordDisplay">Diagram</label>
          <span class="chord-diagram-caption">Click strings to place notes</span>
        </div>
        <div class="chord-diagram-surface modal-surface-block">
          <svg id="chordDisplay" ref="chordDisplayRef" @click="handleChordClick">
            <rect :x="handler.paddingLeft" :y="handler.paddingRight" :width="handler.width" :height="handler.height"
              stroke-width="1" />
            <path :d="`M${handler.paddingLeft} ${handler.paddingRight}V${handler.height + handler.paddingRight}`"
              style="stroke: var(--tab-primary); fill: none" stroke-width="3" />
            <path v-for="i in handler.horizontalSteps" :key="`fret-${i}`"
              :d="`M${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.paddingRight}L${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.height + handler.paddingRight}`"
              stroke-width="1" fill="none" class="gridLine" />
            <path v-for="i in handler.numStrings" :key="`string-${i}`"
              :d="`M${handler.paddingLeft} ${handler.getStringY(i - 1)}L${handler.width + handler.paddingLeft} ${handler.getStringY(i - 1)}`"
              stroke-width="1" fill="none" class="strongGridLine" pointer-events="none" />
            <text v-for="(note, i) in stringNotes" :key="`label-${i}`" :x="0"
              :y="handler.getStringY(handler.numStrings - i - 1) + 3" font-family="Source Sans Pro" font-size="12px">{{ note
              }}</text>

            <template v-for="(note, index) in handler.getModalState().chordProperties.currentNotes" :key="`note-${index}`">
              <path v-if="note === -1"
                :d="`M13 ${handler.getStringY(handler.numStrings - index - 1) - 3}L19 ${handler.getStringY(handler.numStrings - index - 1) + 3}M13 ${handler.getStringY(handler.numStrings - index - 1) + 3}L19 ${handler.getStringY(handler.numStrings - index - 1) - 3}`"
                style="stroke: var(--tab-primary); fill: none" stroke-width="1" class="chordCross" />

              <g v-else-if="note !== 0">
                <circle :cx="handler.getFretX(note)" :cy="handler.getStringY(handler.numStrings - index - 1)" r="9"
                  style="fill: var(--editor-point); stroke: none" />
                <text v-if="handler.getModalState().chordProperties.fingers[index]" :x="handler.getFretX(note) - 3"
                  :y="handler.getStringY(handler.numStrings - index - 1) + 4" style="fill: var(--editor-on-point)" font-family="Source Sans Pro"
                  font-size="13px">
                  {{ handler.getModalState().chordProperties.fingers[index] }}
                </text>
              </g>

              <circle v-else cx="16" :cy="handler.getStringY(handler.numStrings - index - 1)" r="4" style="stroke: var(--tab-primary); fill: var(--editor-bg)"
                stroke-width="1" />
            </template>

            <template v-if="handler.getModalState().chordProperties.capo > 1">
              <text x="46" y="12" font-family="Source Sans Pro" font-size="12px">
                {{ handler.getModalState().chordProperties.capo - 1 }}
              </text>
              <rect x="46" y="15" width="7" :height="handler.height + 2 * handler.stringPadding - 10"
                style="fill: var(--tab-primary); stroke: none" rx="4" ry="4" />
            </template>
          </svg>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-field-grid two-column chord-field-grid">
          <div class="modal-field">
            <label for="chordRootSelect">Root Note</label>
            <div class="select">
              <select id="chordRootSelect" :value="handler.getChordRoot()"
                @change="(e: Event) => handler.updateChordRoot((e.target as HTMLSelectElement).value)">
                <option v-for="note in chordNotes" :key="note" :value="note">
                  {{ note }}
                </option>
              </select>
              <div class="select__arrow"></div>
            </div>
          </div>
          <div class="modal-field">
            <label for="chordTypeSelect">Chord Type</label>
            <div class="select">
              <select id="chordTypeSelect" :value="handler.getChordType()"
                @change="(e: Event) => handler.updateChordType((e.target as HTMLSelectElement).value)">
                <option value="maj">Major</option>
                <option value="min">Minor</option>
              </select>
              <div class="select__arrow"></div>
            </div>
          </div>
          <div class="modal-field">
            <label for="chordCapoInput">Capo Position</label>
            <input id="chordCapoInput" type="number" :value="handler.getCapo()"
              @input="(e: Event) => handler.updateCapo(parseInt((e.target as HTMLInputElement).value, 10) || 0)" min="0" />
          </div>
          <div class="modal-field">
            <label for="chordNameInput">Chord Name</label>
            <input id="chordNameInput" v-model="handler.getModalState().chordProperties.name" />
          </div>
        </div>
      </div>
      <div class="modal-submit-row">
        <SubmitButton @submitInfo="saveChord" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../services/dialogs/modalTypes";
import { AddChordModalHandler } from "../services/dialogs/addChordModalHandler";
import { modalManager } from "../services/dialogs/modalManager";
import SubmitButton from "./SubmitButton.vue";

const chordNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const stringNotes = ['E', 'A', 'D', 'G', 'H', 'E'];

const handler = modalManager.getHandler(MODALS.ADD_CHORD.id) as AddChordModalHandler;

const handleChordClick = (e: MouseEvent) => {
  handler.handleChordClick(e);
};

const saveChord = () => {
  handler.saveChord();
};
</script>

<style scoped>
.chord-modal {
  gap: 0.5rem;
}

.chord-diagram-section {
  gap: 0.65rem;
}

.chord-diagram-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.chord-diagram-caption {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.chord-diagram-surface {
  display: flex;
  justify-content: center;
  padding: 0.75rem;
}

.chord-field-grid {
  align-items: end;
}

#chordDisplay {
  display: block;
  width: 100%;
  max-width: 220px;
  margin: 0;
}

.select__arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--color-text-muted);
  pointer-events: none;
}

.chordCross {
  pointer-events: none;
}

circle,
path {
  pointer-events: none;
}
</style>
