<template>
  <BaseModal>
    <template #title>Stroke</template>
    <div class="strokeSelect">
      <label class="labelTopMargin">Stroke Direction</label>
      <div class="select">
        <select id="strokeDirectionSelection">
          <option value="up" selected>Upstroke</option>
          <option value="down">Downstroke</option>
        </select>
        <div class="select__arrow"></div>
      </div>
      <label class="labelTopMargin">Stroke Length</label>
      <div class="select">
        <select id="strokeLengthSelection">
          <option value="4">Quarter</option>
          <option value="8" selected>Eighth</option>
          <option value="16">Sixteenth</option>
          <option value="32">32nd</option>
          <option value="64">64th</option>
          <option value="128">128th</option>
        </select>
        <div class="select__arrow"></div>
      </div>
    </div>
    <svg
      id="strokeSelectButton"
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
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
</script>
