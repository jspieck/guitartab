<template>
  <BaseModal :modal-id="MODALS.ADD_CHORD.id">
    <template #title>Chord</template>
    <div class="strokeSelect">
      <label>Choose chord:</label>
      <svg id="chordDisplay" ref="chordDisplayRef" @click="handleChordClick">
        <!-- Base Rectangle -->
        <rect :x="handler.paddingLeft" :y="handler.paddingRight" :width="handler.width" :height="handler.height" stroke="#000" stroke-width="1" fill="none" />
        
        <!-- Left Side -->
        <path :d="`M${handler.paddingLeft} ${handler.paddingRight}V${handler.height + handler.paddingRight}`" stroke="rgb(0, 0, 0)" stroke-width="3" fill="none" />
        
        <!-- Frets -->
        <path 
          v-for="i in handler.horizontalSteps" 
          :key="`fret-${i}`"
          :d="`M${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.paddingRight}L${(handler.width / handler.horizontalSteps) * i + handler.paddingLeft} ${handler.height + handler.paddingRight}`"
          stroke="rgb(180, 180, 180)"
          stroke-width="1"
          fill="none"
          class="gridLine"
        />
        
        <!-- Strings -->
        <path
          v-for="i in handler.numStrings"
          :key="`string-${i}`"
          :d="`M${handler.paddingLeft} ${handler.getStringY(i-1)}L${handler.width + handler.paddingLeft} ${handler.getStringY(i-1)}`"
          stroke="rgb(60, 60, 60)"
          stroke-width="1"
          fill="none"
          class="strongGridLine"
          style="pointer-events: none"
        />
        
        <!-- String Labels -->
        <text
          v-for="(note, i) in stringNotes"
          :key="`label-${i}`"
          :x="0"
          :y="handler.getStringY(handler.numStrings - i - 1) + 3"
          font-family="Source Sans Pro"
          font-size="12px"
        >{{ note }}</text>

        <!-- Chord Notes -->
        <template v-for="(note, index) in handler.getModalState().chordProperties.currentNotes" :key="`note-${index}`">
          <!-- X marker for muted strings -->
          <path v-if="note === -1"
            :d="`M13 ${handler.getStringY(handler.numStrings - index - 1) - 3}L19 ${handler.getStringY(handler.numStrings - index - 1) + 3}M13 ${handler.getStringY(handler.numStrings - index - 1) + 3}L19 ${handler.getStringY(handler.numStrings - index - 1) - 3}`"
            stroke="#333"
            stroke-width="1"
            fill="none"
            class="chordCross"
          />
          
          <!-- Circle for fretted notes -->
          <g v-else-if="note !== 0">
            <circle
              :cx="handler.getFretX(note)"
              :cy="handler.getStringY(handler.numStrings - index - 1)"
              r="9"
              fill="#123e74"
              stroke="none"
            />
            <text v-if="handler.getModalState().chordProperties.fingers[index]"
              :x="handler.getFretX(note) - 3"
              :y="handler.getStringY(handler.numStrings - index - 1) + 4"
              fill="#fff"
              font-family="Source Sans Pro"
              font-size="13px"
            >{{ handler.getModalState().chordProperties.fingers[index] }}</text>
          </g>
          
          <!-- Open string marker -->
          <circle v-else
            cx="16"
            :cy="handler.getStringY(handler.numStrings - index - 1)"
            r="4"
            stroke="#333333"
            stroke-width="1"
            fill="white"
          />
        </template>

        <!-- Capo indicator -->
        <template v-if="handler.getModalState().chordProperties.capo > 1">
          <text
            x="46"
            y="12"
            font-family="Source Sans Pro"
            font-size="12px"
          >{{ handler.getModalState().chordProperties.capo - 1 }}</text>
          <rect
            x="46"
            y="15"
            width="7"
            :height="handler.height + 2 * handler.stringPadding - 10"
            fill="#000"
            stroke="#000"
            stroke-width="0"
            rx="4"
            ry="4"
          />
        </template>
      </svg>

      <div class="select-container">
        <label>Root:</label>
        <div class="select">
          <select 
            :value="handler.getChordRoot()"
            @change="(e) => handler.updateChordRoot((e.target as HTMLSelectElement).value)"
          >
            <option v-for="note in chordNotes" :key="note" :value="note">
              {{ note }}
            </option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      
      <div class="select-container">
        <label>Type:</label>
        <div class="select">
          <select 
            :value="handler.getChordType()"
            @change="(e) => handler.updateChordType((e.target as HTMLSelectElement).value)"
          >
            <option value="maj">Major</option>
            <option value="min">Minor</option>
          </select>
          <div class="select__arrow"></div>
        </div>
      </div>
      <label class="labelTopMargin">Capo:</label>
      <input 
        type="number" 
        :value="handler.getCapo()"
        @input="(e) => handler.updateCapo(parseInt((e.target as HTMLInputElement).value) || 0)"
        min="0"
      />
      <label>Name:</label>
      <input v-model="handler.getModalState().chordProperties.name" />
    </div>
    <div @click="handler.saveChord" class="submit-button">
      <svg
        class="checkmark selectButton"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 52 52"
      >
        <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
        <path
          class="checkmark__check"
          fill="none"
          d="M14.1 27.2l7.1 7.2 16.7-16.8"
        />
      </svg>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { AddChordModalHandler } from "../assets/js/modals/addChordModalHandler";
import { modalManager } from "../assets/js/modals/modalManager";

const chordNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const stringNotes = ['E', 'A', 'D', 'G', 'H', 'E'];

const handler = modalManager.getHandler(MODALS.ADD_CHORD.id) as AddChordModalHandler;

const handleChordClick = (e: MouseEvent) => {
  handler.handleChordClick(e);
  // Force Vue to re-render the component
  handler.getModalState();
};
</script>

<style scoped>
.strokeSelect {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#chordDisplay {
  width: 100%;
  height: 200px;
  margin: 1rem 0;
  cursor: pointer;
}

input[type="number"] {
  width: 60px;
}

.submit-button {
  cursor: pointer;
}

.select-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.select {
  position: relative;
  flex: 1;
}

.select select {
  width: 100%;
  padding: 0.5rem;
  cursor: pointer;
  appearance: none;
  border: 1px solid #ccc;
  border-radius: 4px;
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

circle, path {
  pointer-events: none;
}
</style>
