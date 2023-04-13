<template>
    <BaseModal>
        <template #title>Instrument Settings</template>
        <label>Name:</label>
        <input id="instrumentNameInput" />
        <label>Color:</label>
        <div id="instrumentColorPicker" readonly="readonly"></div>
        <div id="alternativeContainer">
          <ul class="unstyled">
            <li><input class="styled-checkbox" id="ringCheckbox" type="checkbox"><label for="ringCheckbox">Let it
                ring</label></li>
          </ul>
        </div>
        <label>String Count:</label>
        <div id="stringCountSelectBox" class="select">
          <select id="stringCountSelect">
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <label>Capo:</label>
        <div id="capoSelectBox" class="select">
          <select id="capoSelect">
            <option v-for="num in 16" :value="num - 1">{{ num - 1 }}</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <label>String Tuning:</label>
        <div id="tuningAreaModal"></div>

        <svg id="instrumentSettingsSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
    </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue';
</script>