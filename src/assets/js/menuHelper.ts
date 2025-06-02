import { Measure, Note, Song } from "./songData";
import { tab } from "./tab";
import { svgDrawer } from "./svgDrawer";
import { modalManager } from "./modals/modalManager";
import { revertHandler } from "./revertHandler";
import classicalNotation from "./vexflowClassical";
import EventBus from "./eventBus";
import { MODALS } from "./modals/modalTypes";

const effectGroups = [
  ['pullDown', 'slide', 'bend', 'trill', 'tremoloPicking', 'tremoloBar', 'dead'],
  ['stacatto', 'palmMute'],
  ['tap', 'slap', 'pop'],
  ['fadeIn'],
  ['grace'],
  ['vibrato'],
  ['artificial'],
  ['accentuated', 'heavyAccentuated', 'ghost'],
  ['stroke'],
  ['addChord'],
  ['addText'],
  ['addMarker'],
  ['repeatAlternative'],
  ['pppDynamic', 'ppDynamic', 'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'],
  ['openBar'],
  ['closeBar'],
  ['timeMeter'],
  ['bpmMeter'],
  ['letRing'],
];

const elementToProperty: Record<string, string> = {
  bend: 'bendPresent',
  artificial: 'artificialPresent',
  tap: 'tap',
  slide: 'slide',
  fadeIn: 'fadeIn',
  grace: 'grace',
  pullDown: 'pullDown',
  stacatto: 'stacatto',
  accentuated: 'accentuated',
  trill: 'trillPresent',
  dead: 'dead',
  heavyAccentuated: 'heavyAccentuated',
  palmMute: 'palmMute',
  vibrato: 'vibrato',
  slap: 'slap',
  pop: 'pop',
  tremoloPicking: 'tremoloPicking',
  letRing: 'letRing',
  ghost: 'ghost',
};

const noteEffects = ['tap', 'slide', 'fadeIn', 'grace', 'pullDown', 'stacatto', 'accentuated', 'trill', 'bend', 'artificial',
    'heavyAccentuated', 'palmMute', 'vibrato', 'slap', 'pop', 'dead', 'tremoloPicking', 'letRing', 'ghost'];

function getEffectVariable(beat: Measure, note: Note | null, name: string): boolean {
  if (note != null && noteEffects.includes(name)) {
      return note[elementToProperty[name]];
  }
  switch (name) {
      // BEAT EFFECTS
      case 'tremoloBar':
          return beat.effects.tremoloBarPresent;
      case 'stroke':
          return beat.effects.strokePresent;
      case 'addText':
          return beat.textPresent;
      case 'addChord':
          return beat.chordPresent;
      case 'addMarker':
          return Song.measureMeta[tab.markedNoteObj.blockId].markerPresent;
      case 'repeatAlternative':
          return Song.measureMeta[tab.markedNoteObj.blockId].repeatAlternativePresent;
      case 'closeBar':
          return Song.measureMeta[tab.markedNoteObj.blockId].repeatClosePresent;
      case 'timeMeter':
          return Song.measureMeta[tab.markedNoteObj.blockId].timeMeterPresent;
      case 'bpmMeter':
          return Song.measureMeta[tab.markedNoteObj.blockId].bpmPresent;
      case 'pppDynamic':
      case 'ppDynamic':
      case 'pDynamic':
      case 'mpDynamic':
      case 'mfDynamic':
      case 'fDynamic':
      case 'ffDynamic':
      case 'fffDynamic':
          return beat.dynamicPresent;
      default:
          return false;
  }
}

function handleEffectCollision(
  beat: Measure, note: Note | null, i: number, id: string, isVariableSet: boolean,
): { [s: string]: boolean } {
  const effectGroupValues: { [s: string]: boolean } = {};
  for (const effect of effectGroups[i]) {
      effectGroupValues[effect] = getEffectVariable(beat, note, effect);
  }
  // isVariableSet = getEffectVariable(beat, note, id);
  EventBus.emit("menu.setEffectOnCollision", {isVariableSet, beat, note, id, index: i});
  return effectGroupValues;
}

function handleEffectGroupCollisionBeat(
  beats: { trackId: number, blockId: number, voiceId: number, beatId: number }[],
  id: string,
  isVariableSet: boolean,
) {
  const changes: { [m: string]: { string: number, effects: { [s: string]: boolean } }[] } = {};
  for (const be of beats) {
      const beat = Song.measures[be.trackId][be.blockId][be.voiceId][be.beatId];
      const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
      for (let i = 0; i < effectGroups.length; i += 1) {
          if (effectGroups[i].includes(id)) {
              const changedEffects = [];
              for (let string = 0; string < beat.notes.length; string += 1) {
                  if (beat.notes[string] != null) {
                      changedEffects.push({
                          string,
                          effects: handleEffectCollision(beat, beat.notes[string], i, id, isVariableSet),
                      });
                  }
              }
              changes[beatStr] = changedEffects;
              break;
          }
      }
  }
  return changes;
}

function handleEffectGroupCollision(
  notes: { trackId: number, blockId: number, voiceId: number, beatId: number, string: number }[],
  id: string,
  isVariableSet: boolean,
): { [key: string]: { [s: string]: boolean } } {
  const changes: { [key: string]: { [s: string]: boolean } } = {};
  for (const no of notes) {
      const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
      const note = beat.notes[no.string];
      const noStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      for (let i = 0; i < effectGroups.length; i += 1) {
          if (effectGroups[i].includes(id)) {
              changes[noStr] = handleEffectCollision(beat, note, i, id, isVariableSet);
              break;
          }
      }
  }
  return changes;
}

function setEffectVariable(beatIn: Measure, noteIn: Note | null, name: string, value: boolean) {
  const beat = beatIn;
  const note = noteIn;
  if (note != null && noteEffects.includes(name)) {
      note[elementToProperty[name]] = value;
  } else {
      switch (name) {
          // BEAT EFFECTS
          case 'stroke':
              beat.effects.strokePresent = value;
              break;
          case 'tremoloBar':
              beat.effects.tremoloBarPresent = value;
              break;
          case 'addText':
              beat.textPresent = value;
              break;
          case 'addChord':
              beat.chordPresent = value;
              break;
          case 'addMarker':
              Song.measureMeta[tab.markedNoteObj.blockId].markerPresent = value;
              break;
          case 'repeatAlternative':
              Song.measureMeta[tab.markedNoteObj.blockId].repeatAlternativePresent = value;
              break;
          case 'closeBar':
              Song.measureMeta[tab.markedNoteObj.blockId].repeatClosePresent = value;
              break;
          case 'timeMeter':
              Song.measureMeta[tab.markedNoteObj.blockId].timeMeterPresent = value;
              break;
          case 'bpmMeter':
              Song.measureMeta[tab.markedNoteObj.blockId].bpmPresent = value;
              break;
          case 'pppDynamic':
          case 'ppDynamic':
          case 'pDynamic':
          case 'mpDynamic':
          case 'mfDynamic':
          case 'fDynamic':
          case 'ffDynamic':
          case 'fffDynamic':
              beat.dynamicPresent = value;
              break;
          default:
              break;
      }
  }
}

function processEffectSelect(
  arr: {
      notes: {
          trackId: number, blockId: number, voiceId: number, beatId: number,
          string: number, note: Note
      }[],
      blocks: number[],
      beats: { trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure }[]
  },
  id: string,
  isRevert: boolean,
) {
  // Variable is only set, if effect is active at every element in arr
  let isVariableSet: boolean = true;
  console.log(arr, id);
  console.log('Process Effect Select');
  for (const no of arr.notes) {
      const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
      const note = beat.notes[no.string];
      isVariableSet = getEffectVariable(beat, note, id);
  }
  console.log('PE', id, isVariableSet, isRevert);
  if (id === 'bend' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.BEND, arr);
  } else if (id === 'artificial' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.ARTIFICIAL, arr);
  } else if (id === 'tremoloBar' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.TREMOLO_BAR, arr);
  } else if (id === 'tremoloPicking' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.TREMOLO_PICKING, arr);
  } else if (id === 'grace' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.GRACE, arr);
  } else if (id === 'stroke' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalManager.toggleByModal(MODALS.STROKE, arr);
  } else {
      const changes = handleEffectGroupCollision(arr.notes, id, isVariableSet);
      if (isRevert === false) {
          revertHandler.addNoteEffectSelect(arr, id, changes);
      }
      if (id === 'grace') {
          classicalNotation.computeVexFlowDataStructures(
              Song.currentTrackId, Song.currentVoiceId,
          );
      }
      for (const blockId of arr.blocks) {
          svgDrawer.rerenderBlock(Song.currentTrackId, blockId, Song.currentVoiceId);
      }
  }
}

export {getEffectVariable, effectGroups, noteEffects, handleEffectCollision, elementToProperty, handleEffectGroupCollisionBeat, handleEffectGroupCollision, setEffectVariable, processEffectSelect};
