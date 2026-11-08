<template>
    <BaseModal :modal-id="DIALOGS.PRACTICE.id">
        <template #title>Practice</template>
        <div class="modal-stack practiceSheet">
            <PracticeOptions transport />
        </div>
    </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue';
import PracticeOptions from './practice/PracticeOptions.vue';
import { DIALOGS } from '../services/dialogs/dialogs';

// The practice options as a window (a bottom sheet on phones, where the toolbar's practice
// popover isn't mounted; Big win 28): speed, metronome, count-in, trainer, loop, dock.
</script>

<style scoped>
.practiceSheet {
    min-width: 280px;
    max-width: 360px;
}
</style>
