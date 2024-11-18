import fastdom from 'fastdom';
import { Song, Note, Measure } from './songData';
import { tab } from './tab';
import { overlayHandler } from './overlayHandler';
import Settings from './settingManager';
import AppManager from './appManager';
import Duration from './duration';
import Helper from './helper';

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

type NoteDuration = 'w' | 'h' | 'q' | 'e' | 's' | 't' | 'z' | 'o';

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


class MenuHandler {
  private static instance: MenuHandler;
  private lastVoiceId = 0;
  private lastNoteLengthButton = '8thNote';
  private lastMeasureSelectButton = '';
  private noteTiedTo: { blockId: number; beatId: number } | null = null;
  private previousBar = 1;

  private constructor() { }

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

  public setNoteLengthForMark(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    // TODO where is activate effects called???
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const duration = beat.duration[0];
    this.chooseNoteLength(duration as NoteDuration);

    document.getElementById('doubleDotted')?.classList.remove('pressed');
    document.getElementById('dotted')?.classList.remove('pressed');
    document.getElementById('tied')?.classList.remove('pressed');

    if (beat.dotted) {
      document.getElementById('dotted')?.classList.add('pressed');
    }
    if (beat.doubleDotted) {
      document.getElementById('doubleDotted')?.classList.add('pressed');
    }
    // check if the note is tied
    const note = beat.notes[string];
    // TODO make this more performant
    const tiedDom = document.getElementById('tied') as HTMLButtonElement;
    if (note != null && note.tied) {
      this.noteTiedTo = note.tiedTo;
      tiedDom.disabled = false;
      tiedDom?.classList.add('pressed');
    } else {
      this.noteTiedTo = this.checkForNoteToTie(trackId, blockId, voiceId, beatId, string);
      if (this.noteTiedTo == null) {
        tiedDom.disabled = true;
      } else {
        tiedDom.disabled = false;
      }
    }
    const tupletDom = document.getElementById('tuplet') as HTMLButtonElement;
    if (beat.tuplet != null) {
      tupletDom.classList.add('pressed');
    } else {
      tupletDom.classList.remove('pressed');
    }
    // no tuplets of 128ths
    if (duration === 'z' && beat.tuplet == null) {
      tupletDom.disabled = true;
    } else {
      tupletDom.disabled = false;
    }
    this.showAvailableTupletSizes(Duration.getDurationOfType(duration));
    // check if setting a dot is possible
  }

  public showAvailableTupletSizes(noteDuration: number) {
    const tDrop = document.getElementById('tupletDropDown');
    Helper.removeAllChildren(tDrop);
    // 3 5 6 7 9 11 12 13
    if (noteDuration >= 2) {
      this.addTupletDropdownOption(3);
    }
    if (noteDuration >= 4) {
      this.addTupletDropdownOption(5);
      this.addTupletDropdownOption(6);
      this.addTupletDropdownOption(7);
    }
    if (noteDuration >= 8) {
      this.addTupletDropdownOption(9);
      this.addTupletDropdownOption(10);
      this.addTupletDropdownOption(11);
      this.addTupletDropdownOption(12);
      this.addTupletDropdownOption(13);
    }
  }

  public addTupletDropdownOption(num: number) {
    const tDrop = document.getElementById('tupletDropDown');
    const option = document.createElement('option');
    option.setAttribute('value', num.toString());
    option.textContent = num.toString();
    tDrop?.appendChild(option);
  }

  public chooseNoteLength(duration: keyof typeof noteToBeat) {
    if (this.lastNoteLengthButton === noteToBeat[duration]) {
      return;
    }
    fastdom.mutate(() => {
      document.getElementById(this.lastNoteLengthButton)?.classList.toggle('pressed');
      this.lastNoteLengthButton = noteToBeat[duration];
      AppManager.typeOfNote = duration;
      document.getElementById(noteToBeat[duration])?.classList.toggle('pressed');
    });
  }

  // TODO buffer infos in array for speedup
  public checkForNoteToTie(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    let noteToTie = null;
    for (let i = blockId; i >= 0; i -= 1) {
      const startBeatId = (i === blockId)
        ? (beatId - 1)
        : Song.measures[trackId][i][voiceId].length - 1;
      for (let j = startBeatId; j >= 0; j -= 1) {
        const { notes } = Song.measures[trackId][i][voiceId][j];
        if (notes != null) {
          if (notes[string] != null) {
            noteToTie = { blockId: i, beatId: j };
            break;
          }
        }
      }
      if (noteToTie != null) {
        break;
      }
    }
    return noteToTie;
  }

  public noteLengthSelect(id: string, noteLength: NoteDuration) {
    if (AppManager.duringTrackCreation) {
        return;
    }
    if (
        tab.changeNoteDuration(
            tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
            tab.markedNoteObj.beatId, tab.markedNoteObj.string, noteLength, false,
        )
    ) {
        this.chooseNoteLength(noteLength);
    }
}
}

export const menuHandler = MenuHandler.getInstance();
export default menuHandler; 