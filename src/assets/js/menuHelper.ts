import { Measure, Note, Song } from './songData';
import { tab } from './tab';
import { modalManager } from './modals/modalManager';
import { revertHandler } from './revertHandler';
import classicalNotation from '../../services/editor/classicalNotationAdapter';
import {
  getMenuEffectVariable,
  handleMenuEffectGroupCollision,
  handleMenuEffectGroupCollisionBeat,
  menuEffectGroups,
  setMenuEffectVariable,
  type MenuEffectBeatRef,
  type MenuEffectNoteRef,
} from '../../services/menuEffectMutations';
import { requestBlockRender } from '../../services/editor/renderCommands';
import { MODALS } from './modals/modalTypes';

function getBeat(noteRef: MenuEffectNoteRef): Measure {
  return Song.measures[noteRef.trackId][noteRef.blockId][noteRef.voiceId][noteRef.beatId];
}

function getBeatFromBeatRef(beatRef: MenuEffectBeatRef): Measure {
  return Song.measures[beatRef.trackId][beatRef.blockId][beatRef.voiceId][beatRef.beatId];
}

function getMeasureMeta(blockId: number) {
  return Song.measureMeta[blockId];
}

function getEffectVariable(beat: Measure, note: Note | null, name: string): boolean {
  const blockId = tab.markedNoteObj?.blockId ?? 0;
  return getMenuEffectVariable(beat, note, name, getMeasureMeta(blockId));
}

function setEffectVariable(beatIn: Measure, noteIn: Note | null, name: string, value: boolean) {
  const blockId = tab.markedNoteObj?.blockId ?? 0;
  setMenuEffectVariable(beatIn, noteIn, name, value, getMeasureMeta(blockId));
}

function handleEffectGroupCollision(
  notes: MenuEffectNoteRef[],
  id: string,
  isVariableSet: boolean,
): Record<string, Record<string, boolean>> {
  return handleMenuEffectGroupCollision(notes, id, isVariableSet, getBeat, getMeasureMeta);
}

function handleEffectGroupCollisionBeat(
  beats: MenuEffectBeatRef[],
  id: string,
  isVariableSet: boolean,
) {
  return handleMenuEffectGroupCollisionBeat(
    beats,
    id,
    isVariableSet,
    getBeatFromBeatRef,
    getMeasureMeta,
  );
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
  let isVariableSet = true;
  for (const no of arr.notes) {
    const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
    const note = beat.notes[no.string];
    isVariableSet = getEffectVariable(beat, note, id);
  }

  if (id === 'bend' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.BEND, arr);
    return;
  }
  if (id === 'artificial' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.ARTIFICIAL, arr);
    return;
  }
  if (id === 'tremoloBar' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.TREMOLO_BAR, arr);
    return;
  }
  if (id === 'tremoloPicking' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.TREMOLO_PICKING, arr);
    return;
  }
  if (id === 'grace' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.GRACE, arr);
    return;
  }
  if (id === 'stroke' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
    modalManager.toggleByModal(MODALS.STROKE, arr);
    return;
  }

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
    requestBlockRender(Song.currentTrackId, blockId, Song.currentVoiceId);
  }
}

export {
  getEffectVariable,
  menuEffectGroups as effectGroups,
  handleEffectGroupCollisionBeat,
  handleEffectGroupCollision,
  setEffectVariable,
  processEffectSelect,
};
