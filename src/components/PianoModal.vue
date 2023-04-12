<template>
    <div>
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Piano</label>
        <div class="hideTopBar"></div>
        <div id="pianoModalClose" class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div id="piano" class="piano">
          <ul id="pianoList">
            <li v-for="(key, index) in keys" :key="index">
              <div :class="`key${key.startKeyNumber}`" class="key" @mousedown="onKeyMouseDown(key.startKeyNumber)"></div>
              <div v-if="key.hasUpperKey" :class="`key${key.startKeyNumber + 1}`" class="upper-key" @mousedown="onKeyMouseDown(key.startKeyNumber + 1)"></div>
            </li>
          </ul>
        </div>
        <img class="eyeToggle visibleEye" src="../assets/images/eye.svg" />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  import midiEngine from '../assets/js/midiReceiver';
  
  let clickedKeyOnPiano = 0;
  const numTasten = ref(56);
  
  const keys = computed(() => {
    const keys = [];
    let keyNumber = 0;
    for (let i = 0; i < numTasten.value; i += 1) {
      const startKeyNumber = keyNumber;
      const hasUpperKey = i % 7 !== 2 && i % 7 !== 6;
      keys.push({ startKeyNumber, hasUpperKey });
      keyNumber += hasUpperKey ? 2 : 1;
    }
    return keys;
  });
  
  function onKeyMouseDown(keyNumber: number) {
    midiEngine.noteOn(keyNumber, 80);
    clickedKeyOnPiano = keyNumber;
  }
  
  defineExpose({
    numTasten,
    keys,
  });
  </script>
  