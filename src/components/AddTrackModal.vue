<template>
  <BaseModal>
    <template #title>New Instrument</template>
    <div class="instrumentContainer">
      <div
        v-for="(group, i) in handler.instrumentGroups"
        :key="i"
        class="addTrackDropDown"
        @click="handler.toggleVisibility(i)"
      >
        {{ group.title }}
        <div :class="{ 'addTrackRowCapsule': true, 'visible': group.visible }">
          <div
            v-for="(choice, j) in group.choices"
            :key="j"
            class="addTrackInnerRow"
            @click="handler.selectInstrument(choice)"
          >
            <img class="addTrackIcon" :src="instrumentList[choice][0]" />
            <div class="addTrackTitle">{{ instrumentList[choice][1] }}</div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { instrumentList } from "../assets/js/instrumentData";
import { modalManager } from "../assets/js/modals/modalManager";
import { AddTrackModalHandler } from "../assets/js/modals/addTrackModalHandler";

const handler = modalManager.getHandler<AddTrackModalHandler>('addTrack');
</script>
