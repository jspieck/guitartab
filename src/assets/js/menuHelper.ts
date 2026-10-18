import { Beat, Note, Song } from './songData';
import type { MenuEffectState } from '../../services/menuEffectMutations';
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

function getBeat(noteRef: MenuEffectNoteRef): Beat {
  return Song.getBeat({ trackId: noteRef.trackId, blockId: noteRef.blockId, voiceId: noteRef.voiceId, beatId: noteRef.beatId });
}

function getBeatFromBeatRef(beatRef: MenuEffectBeatRef): Beat {
  return Song.getBeat({ trackId: beatRef.trackId, blockId: beatRef.blockId, voiceId: beatRef.voiceId, beatId: beatRef.beatId });
}

function getMeasureMeta(blockId: number) {
  return Song.measureMeta[blockId];
}

function getEffectVariable(beat: Beat, note: Note | null, name: string): boolean {
  const blockId = tab.markedNoteObj?.blockId ?? 0;
  return getMenuEffectVariable(beat, note, name, getMeasureMeta(blockId));
}

function setEffectVariable(beatIn: Beat, noteIn: Note | null, name: string, value: MenuEffectState) {
  const blockId = tab.markedNoteObj?.blockId ?? 0;
  setMenuEffectVariable(beatIn, noteIn, name, value, getMeasureMeta(blockId));
}

function handleEffectGroupCollision(
  notes: MenuEffectNoteRef[],
  id: string,
  isVariableSet: boolean,
): Record<string, Record<string, MenuEffectState>> {
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
    beats: { trackId: number, blockId: number, voiceId: number, beatId: number, beat: Beat }[]
  },
  id: string,
  isRevert: boolean,
) {
  let isVariableSet = true;
  for (const no of arr.notes) {
    const beat = Song.getBeat({ trackId: no.trackId, blockId: no.blockId, voiceId: no.voiceId, beatId: no.beatId });
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
