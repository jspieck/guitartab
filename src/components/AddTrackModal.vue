<template>
  <BaseModal>
    <template #title>New Instrument</template>
    <div class="instrumentContainer">
      <div
        v-for="(group, i) in reactiveInstrumentGroups"
        :key="i"
        class="addTrackDropDown"
        @click="toggleVisibility(i)"
      >
        {{ group.title }}
        <div :class="{ 'addTrackRowCapsule': true, 'visible': group.visible }">
          <div
            v-for="(choice, j) in group.choices"
            :key="j"
            class="addTrackInnerRow"
            @click="selectInstrument(choice)"
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
import { ref, reactive } from "vue";
import { Track, Song } from "../assets/js/songData";
import AppManager from "../assets/js/appManager";
import { tab } from "../assets/js/tab";
import { instrumentGroups, instrumentList } from "../assets/js/instrumentData";

let numberOfTrackToAdd = -1;

const reactiveInstrumentGroups = reactive(
  instrumentGroups.map((group) => ({ ...group, visible: false }))
);

function toggleVisibility(index: number) {
  reactiveInstrumentGroups[index].visible = !reactiveInstrumentGroups[index].visible;
}

function selectInstrument(choice: string) {
  const instrument = instrumentList[choice];
  if (numberOfTrackToAdd < 0) {
    addNewInstrument(instrument[2], instrument[1]);
  } else {
    changeInstrumentForTrack(numberOfTrackToAdd, instrument[2], instrument[1]);
  }
}

function addNewInstrument(instrumentChannel: number, instrumentName: string) {
    const numTracks = Song.measures.length;
    const instrObj = {
      name: instrumentName,
      channel: instrumentChannel,
      numStrings: 6,
      strings: [40, 45, 50, 55, 59, 64],
    };
    tab.createNewTrack(numTracks, instrObj);
    tab.createTakte(numTracks, 0);
    tab.fillMeasures(numTracks, 0);
    // sequencer.drawBeat();
  }

function changeInstrumentForTrack(
    numberOfTrackToAdd: number, instrumentChannel: number, instrumentName: string,
  ) {
    const instrObj: Track = {
      channel: { index: instrumentChannel, effectChannel: 0 },
      numStrings: 6,
      strings: [40, 45, 50, 55, 59, 64],
      name: instrumentName,
      capo: 0,
      volume: 127,
      balance: 127,
      color: { red: 1, green: 0, blue: 0 },
      reverb: 0,
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    };
    Song.tracks[numberOfTrackToAdd] = instrObj;

    // change all other infos
    let channelId = (numberOfTrackToAdd >= 9)
      ? numberOfTrackToAdd + 1
      : numberOfTrackToAdd;
    if (instrObj.name === 'Drums') {
      channelId = 9;
    }
    Song.allChannels[channelId] = {
      cInstrument: instrObj.channel.index,
      volume: 127,
      balance: 63,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
    };
    Song.tracks[numberOfTrackToAdd] = {
      numStrings: instrObj.numStrings,
      strings: instrObj.strings,
      capo: 0,
      name: instrObj.name,
      color: { red: 0, blue: 127, green: 0 },
      channel: { index: channelId, effectChannel: 0 },
      volume: 127,
      balance: 63,
      reverb: 0,
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    };
    Song.playBackInstrument[numberOfTrackToAdd] = {
      volume: 127,
      balance: 63,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
      instrument: instrObj.name,
      solo: false,
      mute: false,
    };
    AppManager.setTracks(numberOfTrackToAdd);
    // todo only change icon
    // sequencer.drawBeat();
    // TODO only change clef
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  }
</script>
