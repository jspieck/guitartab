<template>
  <BaseModal :modal-id="MODALS.ADD_CHORD.id">
    <template #title>Chord</template>
    <div class="strokeSelect">
      <label>Choose chord:</label>
      <svg id="chordDisplay" ref="chordDisplayRef" @click="handleChordClick">
        <!-- Base Rectangle -->
        <rect :x="handler.paddingLeft" :y="handler.paddingRight" :width="handler.width" :height="handler.height"
          stroke="#000" stroke-width="1" fill="none" />

        <!-- Left Side -->
        <path :d="`M${handler.paddingLeft} ${handler.paddingRight}V${handler.height + handler.paddingRight}`"
          stroke="rgb(0, 0, 0)" stroke-width="3" fill="none" />

        <!-- Frets -->
        <path v-for="i in handler.horizontalSteps" :key="`fret-${i}`"
          :d="`M${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.paddingRight}L${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.height + handler.paddingRight}`"
          stroke="rgb(180, 180, 180)" stroke-width="1" fill="none" class="gridLine" />

        <!-- Strings -->
        <path v-for="i in handler.numStrings" :key="`string-${i}`"
          :d="`M${handler.paddingLeft} ${handler.getStringY(i - 1)}L${handler.width + handler.paddingLeft} ${handler.getStringY(i - 1)}`"
          stroke="rgb(60, 60, 60)" stroke-width="1" fill="none" class="strongGridLine" style="pointer-events: none" />

        <!-- String Labels -->
        <text v-for="(note, i) in stringNotes" :key="`label-${i}`" :x="0"
          :y="handler.getStringY(handler.numStrings - i - 1) + 3" font-family="Source Sans Pro" font-size="12px">{{ note
          }}</text>

        <!-- Chord Notes -->
        <template v-for="(note, index) in handler.getModalState().chordProperties.currentNotes" :key="`note-${index}`">
          <!-- X marker for muted strings -->
          <path v-if="note === -1"
            :d="`M13 ${handler.getStringY(handler.numStrings - index - 1) - 3}L19 ${handler.getStringY(handler.numStrings - index - 1) + 3}M13 ${handler.getStringY(handler.numStrings - index - 1) + 3}L19 ${handler.getStringY(handler.numStrings - index - 1) - 3}`"
            stroke="#333" stroke-width="1" fill="none" class="chordCross" />

          <!-- Circle for fretted notes -->
          <g v-else-if="note !== 0">
            <circle :cx="handler.getFretX(note)" :cy="handler.getStringY(handler.numStrings - index - 1)" r="9"
              fill="#123e74" stroke="none" />
            <text v-if="handler.getModalState().chordProperties.fingers[index]" :x="handler.getFretX(note) - 3"
              :y="handler.getStringY(handler.numStrings - index - 1) + 4" fill="#fff" font-family="Source Sans Pro"
              font-size="13px">
              {{ handler.getModalState().chordProperties.fingers[index] }}
            </text>
          </g>

          <!-- Open string marker -->
          <circle v-else cx="16" :cy="handler.getStringY(handler.numStrings - index - 1)" r="4" stroke="#333333"
            stroke-width="1" fill="white" />
        </template>

        <!-- Capo indicator -->
        <template v-if="handler.getModalState().chordProperties.capo > 1">
          <text x="46" y="12" font-family="Source Sans Pro" font-size="12px">
            {{ handler.getModalState().chordProperties.capo - 1 }}
          </text>
          <rect x="46" y="15" width="7" :height="handler.height + 2 * handler.stringPadding - 10" fill="#000"
            stroke="#000" stroke-width="0" rx="4" ry="4" />
        </template>
      </svg>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <!-- Root Note -->
          <div class="space-y-2">
            <label for="root" class="block text-sm font-medium text-gray-700">
                Root Note
            </label>
            <div class="select">
              <select :value="handler.getChordRoot()"
                @change="(e) => handler.updateChordRoot((e.target as HTMLSelectElement).value)">
                <option v-for="note in chordNotes" :key="note" :value="note">
                  {{ note }}
                </option>
              </select>
              <div class="select__arrow"></div>
            </div>
          </div>

          <div class="space-y-2">
            <label for="type" class="block text-sm font-medium text-gray-700">
                Chord Type
            </label>
            <div class="select">
              <select :value="handler.getChordType()"
                @change="(e) => handler.updateChordType((e.target as HTMLSelectElement).value)">
                <option value="maj">Major</option>
                <option value="min">Minor</option>
              </select>
              <div class="select__arrow"></div>
            </div>
          </div>
          <div class="space-y-2">
            <label for="capo" class="block text-sm font-medium text-gray-700">
                Capo Position
            </label>
            <input class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" type="number" :value="handler.getCapo()"
              @input="(e) => handler.updateCapo(parseInt((e.target as HTMLInputElement).value) || 0)" min="0" />
          </div>
          <div class="space-y-2">
            <label for="name" class="block text-sm font-medium text-gray-700">
              Chord Name
            </label>
            <input class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" v-model="handler.getModalState().chordProperties.name" />
          </div>
        </div>
      </div>
    </div>
    <SubmitButton @submitInfo="saveChord" />
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { AddChordModalHandler } from "../assets/js/modals/addChordModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";
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
.strokeSelect {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.select-container {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  border-top: 5px solid #333;
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
