<template>
    <BaseModal :modal-id="MODALS.PIANO.id">
        <template #title>Piano</template>
        <div id="piano" class="piano">
            <ul id="pianoList">
                <li v-for="(key, index) in handler.keys.value" :key="index">
                    <div 
                        :class="`key${key.startKeyNumber}`" 
                        class="key" 
                        @mousedown="handler.onKeyMouseDown(key.startKeyNumber)"
                    ></div>
                    <div 
                        v-if="key.hasUpperKey" 
                        :class="`key${key.startKeyNumber + 1}`" 
                        class="upper-key" 
                        @mousedown="handler.onKeyMouseDown(key.startKeyNumber + 1)"
                    ></div>
                </li>
            </ul>
        </div>
        <img class="eyeToggle visibleEye" src="../assets/images/eye.svg" />
    </BaseModal>
</template>
  
<script setup lang="ts">
import BaseModal from './BaseModal.vue';
import { modalManager } from '../assets/js/modals/modalManager';
import { PianoModalHandler } from '../assets/js/modals/pianoModalHandler';
import { MODALS } from '../assets/js/modals/modalTypes';

const handler = modalManager.getHandler<PianoModalHandler>(MODALS.PIANO.id);

defineExpose({
    numTasten: handler.numTasten,
    keys: handler.keys,
});
</script>
  