<template>
    <BaseModal>
        <template #title>Time Meter</template>
        <div class="timeMeterSelectCapsule">
          <label class="labelTopMargin">Numerator</label>
          <div class="select">
            <select v-model="numerator">
              <option v-for="n in 31" :key="n" :value="n">{{ n }}</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Denominator</label>
          <div class="select timeMeterSelect">
            <select v-model="denominator">
              <option v-for="n in denominators" :key="n" :value="n">{{ n }}</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg
          id="timeMeterSelectButton"
          class="checkmark selectButton"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52"
          @click="onSelectButtonClick"
        >
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
    </BaseModal>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import BaseModal from './BaseModal.vue';

  const numerator = ref(4);
  const denominator = ref(4);
  const denominators = [1, 2, 4, 8, 16, 32];
  
  function onSelectButtonClick() {
    console.log('Selected time meter:', numerator.value, denominator.value);
  }
  </script>
  