<template>
    <BaseModal>
        <template #title>Piano</template>
        <div id="piano" class="piano">
          <ul id="pianoList">
            <li v-for="(key, index) in keys" :key="index">
              <div :class="`key${key.startKeyNumber}`" class="key" @mousedown="onKeyMouseDown(key.startKeyNumber)"></div>
              <div v-if="key.hasUpperKey" :class="`key${key.startKeyNumber + 1}`" class="upper-key" @mousedown="onKeyMouseDown(key.startKeyNumber + 1)"></div>
            </li>
          </ul>
        </div>
        <img class="eyeToggle visibleEye" src="../assets/images/eye.svg" />
    </BaseModal>
  </template>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  import midiEngine from '../assets/js/midiReceiver';
  import BaseModal from './BaseModal.vue';
  
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
  