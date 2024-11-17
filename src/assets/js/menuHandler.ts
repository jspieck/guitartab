import fastdom from 'fastdom';
import { Song, Note, Measure } from './songData';
import { tab } from './tab';
import { overlayHandler } from './overlayHandler';
import Settings from './settingManager';
import AppManager from './appManager';
import { classicalNotation } from './vexflowClassical';
import { revertHandler } from './revertHandler';
import { svgDrawer } from './svgDrawer';
import Duration from './duration';
import Helper from './helper';
import { modalHandler } from './modalHandler';

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

const elementToProperty: { [key: string]: string } = {
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

const noteEffects = [
    'tap', 'slide', 'fadeIn', 'grace', 'pullDown', 'stacatto', 'accentuated', 
    'trill', 'bend', 'artificial', 'heavyAccentuated', 'palmMute', 'vibrato', 
    'slap', 'pop', 'dead', 'tremoloPicking', 'letRing', 'ghost'
];

const secondStatusBar = [
    'pullDown', 'ghost', 'stacatto', 'accentuated', 'heavyAccentuated', 'palmMute',
    'vibrato', 'tremoloBar', 'artificial', 'trill', 'bend', 'slide', 'tap', 'fadeIn', 
    'grace', 'slap', 'pop', 'dead', 'tremoloPicking', 'stroke', 'letRing'
];

class MenuHandler {
  private static instance: MenuHandler;
  private lastVoiceId = 0;
  private lastNoteLengthButton = '8thNote';
  private lastMeasureSelectButton = '';
  private noteTiedTo: { blockId: number; beatId: number } | null = null;
  private previousBar = 1;

  private constructor() {}

  public static getInstance(): MenuHandler {
    if (!MenuHandler.instance) {
      MenuHandler.instance = new MenuHandler();
    }
    return MenuHandler.instance;
  }

  public applyStyleMode() {
    if (Settings.darkMode) {
      document.body.classList.add('darkMode');
    } else {
      document.body.classList.remove('darkMode');
    }
  }

  public selectBar(id: number) {
    fastdom.mutate(() => {
      if (this.previousBar === id) return;
      document.getElementById(`statusBar${this.previousBar}`)?.classList.toggle('statusBarSelected');
      document.getElementById(`statusBar${id}`)?.classList.toggle('statusBarSelected');

      document.getElementById(`barButton${this.previousBar}`)?.classList.toggle('tabBarElemSelected');
      document.getElementById(`barButton${id}`)?.classList.toggle('tabBarElemSelected');

      this.previousBar = id;
    });
  }

  public activateEffectsForMarkedBeat() {
    const {
        trackId, blockId, voiceId, beatId,
    } = tab.markedNoteObj;
    this.activateEffectsForBeat(
        Song.measures[trackId][blockId][voiceId][beatId],
    );
  }

  public activateEffectsForMarkedPos() {
    this.activateEffectsForPos(
        tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
        tab.markedNoteObj.beatId, tab.markedNoteObj.string,
    );
  }

  public activateEffectsForNote(note: Note) {
    for (const noteEffect of noteEffects) {
      if (note[elementToProperty[noteEffect]]) {
        document.getElementById(noteEffect)?.classList.add('pressed');
      }
    }
  }

  public enableNoteEffectButtons() {
    for (const noteEffect of secondStatusBar) {
      (document.getElementById(noteEffect) as HTMLButtonElement).disabled = false;
    }
  }

  public disableNoteEffectButtons() {
    for (const noteEffect of secondStatusBar) {
      (document.getElementById(noteEffect) as HTMLButtonElement).disabled = true;
    }
  }

  public deactivateAllEffects() {
    for (const group of effectGroups) { // staticEffectGroups
      for (const effect of group) {
        document.getElementById(effect)?.classList.remove('pressed');
      }
    }
  }

  public deactivateEffects(beat: Measure, note: Note | null, effects: string[]) {
    for (const effect of effects) {
        document.getElementById(effect)?.classList.remove('pressed');
        this.setEffectVariable(beat, note, effect, false);
    }
  }

  public deactivateEffectsForBeat() {
    const beatEffects = ['stroke', 'tremoloBar', 'addText', 'addChord', 'pppDynamic', 'ppDynamic',
        'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'];
    for (const effect of beatEffects) {
        document.getElementById(effect)?.classList.remove('pressed');
    }
  }

  public activateEffectsForBeat(beat: Measure) {
    this.deactivateEffectsForBeat();
    if (beat.effects.strokePresent) {
      document.getElementById('stroke')?.classList.add('pressed');
    }
    if (beat.effects.tremoloBarPresent) {
      document.getElementById('tremoloBar')?.classList.add('pressed');
    }
    if (beat.textPresent) {
      document.getElementById('addText')?.classList.add('pressed');
    }
    if (beat.chordPresent) {
      document.getElementById('addChord')?.classList.add('pressed');
    }
    if (beat.dynamicPresent) {
      document.getElementById(`${beat.dynamic}Dynamic`)?.classList.add('pressed');
    }
  }

  public activateEffectsForBlock() {
    const { blockId } = tab.markedNoteObj;
    if (Song.measureMeta[blockId].markerPresent) {
      document.getElementById('addMarker')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatAlternativePresent) {
      document.getElementById('repeatAlternative')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatClosePresent) {
      document.getElementById('closeBar')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatOpen) {
      document.getElementById('openBar')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].timeMeterPresent) {
      document.getElementById('timeMeter')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].bpmPresent) {
      document.getElementById('bpmMeter')?.classList.add('pressed');
    }
  }

  public activateEffectsForPos(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    string: number
  ) {
    this.deactivateAllEffects();
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const note = beat.notes[string];

    if (note != null) {
      this.enableNoteEffectButtons();
      this.activateEffectsForNote(note);
    } else if (overlayHandler.isNoteSelected()) {
      this.enableNoteEffectButtons();
    } else {
      this.disableNoteEffectButtons();
    }

    this.activateEffectsForBeat(beat);
    this.activateEffectsForBlock();
  }

  public selectVoice(voiceId: number) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    document.getElementById(`voice${this.lastVoiceId}`)?.classList.remove('voiceSelected');
    this.lastVoiceId = voiceId;
    document.getElementById(`voice${voiceId}`)?.classList.add('voiceSelected');
    AppManager.changeTrack(Song.currentTrackId, voiceId, false, null);
  }

  public setEffectVariable(beatIn: Measure, noteIn: Note | null, name: string, value: boolean) {
    const beat = beatIn;
    const note = noteIn;
    if (note != null && noteEffects.includes(name)) {
      note[elementToProperty[name]] = value;
    } else {
      switch (name) {
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
        default:
          if (name.endsWith('Dynamic')) {
            beat.dynamicPresent = value;
          }
          break;
      }
    }
  }

  public getEffectVariable(beat: Measure, note: Note | null, name: string): boolean {
    if (note != null && noteEffects.includes(name)) {
      return note[elementToProperty[name]];
    }
    switch (name) {
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
      default:
        if (name.endsWith('Dynamic')) {
          return beat.dynamicPresent;
        }
        return false;
    }
  }

  public handleEffectCollision(
    beat: Measure, note: Note | null, i: number, id: string, isVariableSet: boolean,
  ): { [s: string]: boolean } {
    const effectGroupValues: { [s: string]: boolean } = {};
    for (const effect of effectGroups[i]) {
        effectGroupValues[effect] = this.getEffectVariable(beat, note, effect);
    }
    // isVariableSet = getEffectVariable(beat, note, id);
    if (isVariableSet == null || isVariableSet === false) {
        this.deactivateEffects(beat, note, effectGroups[i]);
        this.setEffectVariable(beat, note, id, true);
        // TODO with loopInterval
        document.getElementById(id)?.classList.toggle('pressed');
    } else {
        this.setEffectVariable(beat, note, id, false);
    }
    return effectGroupValues;
}

  public handleEffectGroupCollision(
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
                changes[noStr] = this.handleEffectCollision(beat, note, i, id, isVariableSet);
                break;
            }
        }
    }
    return changes;
  }

  public handleEffectGroupCollisionBeat(
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
                            effects: this.handleEffectCollision(beat, beat.notes[string], i, id, isVariableSet),
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
}

export const menuHandler = MenuHandler.getInstance();
export default menuHandler; 