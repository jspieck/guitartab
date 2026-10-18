import Song, { Beat, Note } from './songData';
import type { MenuEffectState } from '../../services/menuEffectMutations';
import { tab } from './tab';
import AppManager from './appManager';
import { typedEventBus } from '../../utils/typedEventBus';
import Settings from './settingManager';
import { applyNoteLengthSelection } from '../../services/menuActionCommands';
import type { NoteLengthCode } from '../../types/tab';
import {
  applyMenuEffectCollision,
  deactivateMenuEffectsInGroup,
  getMenuEffectVariable,
  handleMenuEffectGroupCollision,
  handleMenuEffectGroupCollisionBeat,
  setMenuEffectVariable,
  type MenuEffectBeatRef,
  type MenuEffectNoteRef,
} from '../../services/menuEffectMutations';

type NoteDuration = NoteLengthCode;

const noteToBeat: Record<NoteDuration, string> = {
  w: 'wholeNote',
  h: 'halfNote',
  q: 'quarterNote',
  e: '8thNote',
  s: '16thNote',
  t: '32ndNote',
  z: '64thNote',
  o: '128thNote',
};

function getBeat(noteRef: MenuEffectNoteRef): Beat {
  return Song.getBeat({ trackId: noteRef.trackId, blockId: noteRef.blockId, voiceId: noteRef.voiceId, beatId: noteRef.beatId });
}

function getBeatFromBeatRef(beatRef: MenuEffectBeatRef): Beat {
  return Song.getBeat({ trackId: beatRef.trackId, blockId: beatRef.blockId, voiceId: beatRef.voiceId, beatId: beatRef.beatId });
}

function getMeasureMeta(blockId: number) {
  return Song.measureMeta[blockId];
}

function requestMenuResync() {
  typedEventBus.emit('menu.activateEffectsForMarkedPos');
}

class MenuHandler {
  private static instance: MenuHandler;

  private lastNoteLengthButton = '8thNote';

  private constructor() { }

  public static getInstance(): MenuHandler {
    if (!MenuHandler.instance) {
      MenuHandler.instance = new MenuHandler();
    }
    return MenuHandler.instance;
  }

  public applyStyleMode() {
    if (Settings.darkMode) {
      document.body.setAttribute('id', 'darkMode');
    } else {
      document.body.setAttribute('id', 'lightMode');
    }
  }

  public selectBar(_id: number) {
    requestMenuResync();
  }

  public activateEffectsForMarkedBeat() {
    requestMenuResync();
  }

  public activateEffectsForMarkedPos() {
    requestMenuResync();
  }

  public activateEffectsForNote(_note: Note) {
    requestMenuResync();
  }

  public enableNoteEffectButtons() {
    requestMenuResync();
  }

  public disableNoteEffectButtons() {
    typedEventBus.emit('menu.disableNoteEffectButtons');
  }

  public deactivateAllEffects() {
    requestMenuResync();
  }

  public deactivateEffects(beat: Beat, note: Note | null, effects: string[]) {
    const blockId = tab.markedNoteObj?.blockId ?? 0;
    deactivateMenuEffectsInGroup(beat, note, effects, getMeasureMeta(blockId));
  }

  public deactivateEffectsForBeat() {
    requestMenuResync();
  }

  public activateEffectsForBeat(_beat: Beat) {
    requestMenuResync();
  }

  public activateEffectsForBlock() {
    requestMenuResync();
  }

  public activateEffectsForPos(
    _trackId: number,
    _blockId: number,
    _voiceId: number,
    _beatId: number,
    _string: number,
  ) {
    requestMenuResync();
  }

  public selectVoice(voiceId: number) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    AppManager.changeTrack(Song.currentTrackId, voiceId, false, null);
  }

  public setEffectVariable(beatIn: Beat, noteIn: Note | null, name: string, value: MenuEffectState) {
    const blockId = tab.markedNoteObj?.blockId ?? 0;
    setMenuEffectVariable(beatIn, noteIn, name, value, getMeasureMeta(blockId));
  }

  public getEffectVariable(beat: Beat, note: Note | null, name: string): boolean {
    const blockId = tab.markedNoteObj?.blockId ?? 0;
    return getMenuEffectVariable(beat, note, name, getMeasureMeta(blockId));
  }

  public handleEffectCollision(
    beat: Beat,
    note: Note | null,
    groupIndex: number,
    id: string,
    isVariableSet: boolean,
  ): Record<string, MenuEffectState> {
    const blockId = tab.markedNoteObj?.blockId ?? 0;
    return applyMenuEffectCollision(
      beat,
      note,
      groupIndex,
      id,
      isVariableSet,
      getMeasureMeta(blockId),
    );
  }

  public handleEffectGroupCollision(
    notes: MenuEffectNoteRef[],
    id: string,
    isVariableSet: boolean,
  ): Record<string, Record<string, MenuEffectState>> {
    return handleMenuEffectGroupCollision(notes, id, isVariableSet, getBeat, getMeasureMeta);
  }

  public handleEffectGroupCollisionBeat(
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

  public setNoteLengthForMark(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    _string: number,
  ) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });
    const duration = beat.duration[0] as NoteDuration;
    this.chooseNoteLength(duration);
    requestMenuResync();
  }

  public showAvailableTupletSizes(_noteDuration: number) {
    requestMenuResync();
  }

  public chooseNoteLength(duration: NoteDuration) {
    if (this.lastNoteLengthButton === noteToBeat[duration]) {
      AppManager.typeOfNote = duration;
      return;
    }
    this.lastNoteLengthButton = noteToBeat[duration];
    AppManager.typeOfNote = duration;
    requestMenuResync();
  }

  public checkForNoteToTie(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    string: number,
  ) {
    let noteToTie = null;
    for (let i = blockId; i >= 0; i -= 1) {
      const startBeatId = (i === blockId)
        ? (beatId - 1)
        : Song.measures[trackId][i][voiceId].length - 1;
      for (let j = startBeatId; j >= 0; j -= 1) {
        const { notes } = Song.getBeat({ trackId, blockId: i, voiceId, beatId: j });
        if (notes?.[string] != null) {
          noteToTie = { blockId: i, beatId: j };
          break;
        }
      }
      if (noteToTie != null) {
        break;
      }
    }
    return noteToTie;
  }

  public noteLengthSelect(_id: string, noteLength: NoteLengthCode) {
    applyNoteLengthSelection(noteLength);
  }
}

export const menuHandler = MenuHandler.getInstance();
export default menuHandler;
