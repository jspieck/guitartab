import Song, {
  Measure, MeasureMetaInfo, Track, Bend, TremoloBar, Chord, Marker, Stroke,
  Grace, Note, MeasureEffects,
} from '../../assets/js/songData'
import { tab, Tab } from '../../assets/js/tab'
import AppManager from '../../assets/js/appManager'
import { sequencerHandler, SequencerHandler } from '../../assets/js/sequencerHandler'
import { menuHandler } from '../../assets/js/menuHandler'
import {
  processEffectSelect,
  setEffectVariable,
} from '../../assets/js/menuHelper'
import { typedEventBus } from '../../utils/typedEventBus'
import { requestBlockRender, requestDurationRender } from './renderCommands'

function requestCurrentVoiceBlockRender(trackId: number, blockId: number) {
  requestBlockRender(trackId, blockId, Song.currentVoiceId)
}

// Note length
export function revertNoteLength(
  infoObj: { trackId: number, blockId: number, voiceId: number,
    measureBefore: Measure[] },
) {
  Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureBefore;
  tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
}

export function restoreNoteLength(
  infoObj: { trackId: number, blockId: number, voiceId: number,
    measureAfter: Measure[] },
) {
  Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureAfter;
  tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
}

// Delete Note
export function revertDeleteNote(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteObj: Note, effectObj: MeasureEffects },
) {
  const {
    trackId, blockId, voiceId, beatId, string, noteObj, effectObj,
  } = infoObj;
  const redrawSequencer = Song.isBeatEmpty(trackId, blockId);
  const beatObj = Song.measures[trackId][blockId][voiceId][beatId];
  beatObj.duration = beatObj.duration[0];
  beatObj.notes[string] = noteObj;
  beatObj.effects = effectObj;
  if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
    requestCurrentVoiceBlockRender(trackId, blockId);
  }
  if (redrawSequencer) {
    sequencerHandler.redrawSequencerMain();
  }
}

export function restoreDeleteNote(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number },
) {
  Tab.deleteNote(
    infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.string, true,
  );
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  }
}

// Copy Paste
export function revertCopyPaste(
  infoObj: { trackId: number, voiceId: number,
    blocksBefore: {blockId: number, block: Measure[][]}[]},
) {
  for (let i = 0, n = infoObj.blocksBefore.length; i < n; i += 1) {
    const { blockId } = infoObj.blocksBefore[i];
    Song.measures[infoObj.trackId][blockId] = infoObj.blocksBefore[i].block;
  }
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    tab.drawTrack(0, 0, true, null);
  }
}

export function restoreCopyPaste(
  infoObj: { trackId: number, voiceId: number,
    blocksAfter: {blockId: number, block: Measure[][]}[]},
) {
  for (let i = 0, n = infoObj.blocksAfter.length; i < n; i += 1) {
    const { blockId } = infoObj.blocksAfter[i];
    Song.measures[infoObj.trackId][blockId] = infoObj.blocksAfter[i].block;
  }
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    tab.drawTrack(0, 0, true, null);
  }
}

// Tied
export function revertTied(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteTiedTo: { blockId: number, beatId: number } },
) {
  // Handle tied note restoration directly
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  const note = beat.notes[infoObj.string];
  if (note != null) {
    note.tied = !note.tied;
    note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 };
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  }
}

export function restoreTied(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteTiedTo: { blockId: number, beatId: number } },
) {
  // Handle tied note restoration directly
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  const note = beat.notes[infoObj.string];
  if (note != null) {
    note.tied = !note.tied;
    note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 };
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  }
}

// Note placement
export function revertNotePlacement(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, previousFret: number },
) {
  if (infoObj.previousFret !== -1) {
    tab.drawNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
      infoObj.string, infoObj.previousFret, true);
  } else {
    Tab.deleteNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
      infoObj.string, true);
    requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId);
  }
}

export function restoreNotePlacement(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, newFret: number },
) {
  tab.drawNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
    infoObj.string, infoObj.newFret, true);
}

// Special Select effects - simplified implementation
export function setSpecialSelect(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, tupleSel: number, id: string },
) {
  // Simplified implementation for special select operations
  if (infoObj.id === 'tuplet') {
    const tupletSet = tab.setTuplet(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.tupleSel);
    if (tupletSet) {
      requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId);
      tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
    }
  }
  
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Zoom
export function revertZoom(infoObj: {up: boolean}) {
  tab.scaleCompleteTab(!infoObj.up);
}

export function restoreZoom(infoObj: {up: boolean}) {
  tab.scaleCompleteTab(infoObj.up);
}

// NoteEffectSelect
export function revertNoteEffectSelect(infoObj: {
  arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
  },
  changes: {[key: string]: {[s: string]: boolean}},
  id: string}) {
  for (const no of infoObj.arr.notes) {
    const {
      trackId, blockId, voiceId, beatId, string,
    } = no;
    const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    for (const effect in infoObj.changes[noteStr]) {
      if (effect !== infoObj.id) {
        setEffectVariable(beat, beat.notes[string], effect,
          infoObj.changes[noteStr][effect]);
      }
    }
  }
  processEffectSelect(infoObj.arr, infoObj.id, true);
}

export function restoreNoteEffectSelect(infoObj: {arr: {
  notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, note: Note}[],
  blocks: number[],
  beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
}, id: string}) {
  processEffectSelect(infoObj.arr, infoObj.id, true);
}

// NotationSelect - simplified implementation
export function revertNotationSelect(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
) {
  // Toggle the notation effect
  if (infoObj.id === 'timeMeter') {
    Song.measureMeta[infoObj.blockId].timeMeterPresent = !Song.measureMeta[infoObj.blockId].timeMeterPresent;
  } else if (infoObj.id === 'bpmMeter') {
    Song.measureMeta[infoObj.blockId].bpmPresent = !Song.measureMeta[infoObj.blockId].bpmPresent;
  }
  
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreNotationSelect(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
) {
  // Toggle the notation effect
  if (infoObj.id === 'timeMeter') {
    Song.measureMeta[infoObj.blockId].timeMeterPresent = !Song.measureMeta[infoObj.blockId].timeMeterPresent;
  } else if (infoObj.id === 'bpmMeter') {
    Song.measureMeta[infoObj.blockId].bpmPresent = !Song.measureMeta[infoObj.blockId].bpmPresent;
  }
  
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Dynamic Select - simplified implementation
export function revertDynamicSelect(
  {
    trackId, blockId, voiceId, beatId, id,
  }: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, id: string },
) {
  const beat = Song.measures[trackId][blockId][voiceId][beatId];
  beat.dynamicPresent = !beat.dynamicPresent;
  if (beat.dynamicPresent) {
    beat.dynamic = id.replace('Dynamic', '');
  }
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreDynamicSelect(
  {
    trackId, blockId, voiceId, beatId, id,
  }: { trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, id: string },
) {
  const beat = Song.measures[trackId][blockId][voiceId][beatId];
  beat.dynamicPresent = !beat.dynamicPresent;
  if (beat.dynamicPresent) {
    beat.dynamic = id.replace('Dynamic', '');
  }
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// OpenBar and closeBar - simplified implementation
export function toggleMeasureSelect(
  infoObj: { trackId: number, blockId: number, voiceId: number, id: string },
) {
  if (infoObj.id === 'openBar') {
    Song.measureMeta[infoObj.blockId].repeatOpen = !Song.measureMeta[infoObj.blockId].repeatOpen;
  }
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Text
export function revertText({
  trackId, blockId, voiceId, beatId, previousText, textPresentBefore,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number,
  previousText: string, textPresentBefore: boolean,
}) {
  Song.measures[trackId][blockId][voiceId][beatId].text = previousText;
  Song.measures[trackId][blockId][voiceId][beatId].textPresent = textPresentBefore;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreText({
  trackId, blockId, voiceId, beatId, nextText, textPresentAfter,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number,
  nextText: string, textPresentAfter: boolean,
}) {
  Song.measures[trackId][blockId][voiceId][beatId].text = nextText;
  Song.measures[trackId][blockId][voiceId][beatId].textPresent = textPresentAfter;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Marker
export function revertMarker(
  infoObj: {blockId: number, markerPresentBefore: boolean, markerBefore: Marker},
) {
  Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentBefore;
  Song.measureMeta[infoObj.blockId].marker = infoObj.markerBefore;
  SequencerHandler.setMarker(infoObj.blockId);
}

export function restoreMarker(
  infoObj: {blockId: number, markerPresentAfter: boolean, markerAfter: Marker},
) {
  Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentAfter;
  Song.measureMeta[infoObj.blockId].marker = infoObj.markerAfter;
  SequencerHandler.setMarker(infoObj.blockId);
}

export function setMarker(
  infoObj: {trackId: number, blockId: number, markerPresentBefore: boolean,
    markerPresentAfter: boolean}, reverting: boolean,
) {
  if (reverting) {
    if (!infoObj.markerPresentBefore && infoObj.markerPresentAfter) {
      SequencerHandler.removeMarker(infoObj.blockId);
    } else {
      SequencerHandler.setMarker(infoObj.blockId);
    }
  } else if (!infoObj.markerPresentAfter && infoObj.markerPresentBefore) {
    SequencerHandler.removeMarker(infoObj.blockId);
  } else {
    SequencerHandler.setMarker(infoObj.blockId);
  }
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Time Meter
export function revertTimeMeter(infoObj: {
  blockId: number,
  timeMeterPresentBefore: boolean,
  notesBefore: { blockId: number, beatId: number, notes: Note[] }[][][],
  numeratorBefore: number,
  denominatorBefore: number
}) {
  Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentBefore;
  // add all saved notes to measures
  for (let trackId = 0, numTr = infoObj.notesBefore.length; trackId < numTr; trackId += 1) {
    for (let voiceId = 0, numVc = infoObj.notesBefore[trackId].length;
      voiceId < numVc; voiceId += 1) {
      for (let i = 0, n = infoObj.notesBefore[trackId][voiceId].length; i < n; i += 1) {
        const { blockId } = infoObj.notesBefore[trackId][voiceId][i];

        Song.measureMeta[blockId].numerator = infoObj.numeratorBefore;
        Song.measureMeta[blockId].denominator = infoObj.denominatorBefore;

        for (let j = 0, m = infoObj.notesBefore[trackId][voiceId][i].notes.length;
          j < m; j += 1) {
          const { beatId, notes } = infoObj.notesBefore[trackId][voiceId][i];
          const clonedNote = JSON.parse(JSON.stringify(notes[j]));
          Song.measures[trackId][blockId][voiceId][beatId] = clonedNote;
        }
      }
    }
  }
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreTimeMeter(
  infoObj: {blockId: number, timeMeterPresentAfter: boolean, numeratorAfter: number,
    denominatorAfter: number},
) {
  Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentAfter;
  Song.measureMeta[infoObj.blockId].numerator = infoObj.numeratorAfter;
  Song.measureMeta[infoObj.blockId].denominator = infoObj.denominatorAfter;
  AppManager.checkAndAdaptTimeMeter(infoObj.blockId);
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Bpm Meter
export function revertBpmMeter(
  infoObj: {trackId: number, blockId: number, bpmPresentBefore: boolean,
    bpmBefore: number},
) {
  Song.measureMeta[infoObj.blockId].bpmPresent = infoObj.bpmPresentBefore;
  Song.measureMeta[infoObj.blockId].bpm = infoObj.bpmBefore;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreBpmMeter(
  infoObj: {trackId: number, blockId: number, bpmPresentAfter: boolean,
    bpmAfter: number},
) {
  Song.measureMeta[infoObj.blockId].bpmPresent = infoObj.bpmPresentAfter;
  Song.measureMeta[infoObj.blockId].bpm = infoObj.bpmAfter;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Chord
export function revertChord({
  trackId, blockId, voiceId, beatId, chordBefore, chordPresentBefore,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number,
  chordBefore: Chord, chordPresentBefore: boolean,
}) {
  Song.measures[trackId][blockId][voiceId][beatId].chord = chordBefore;
  Song.measures[trackId][blockId][voiceId][beatId].chordPresent = chordPresentBefore;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreChord({
  trackId, blockId, voiceId, beatId, chordAfter, chordPresentAfter,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number,
  chordAfter: Chord, chordPresentAfter: boolean,
}) {
  Song.measures[trackId][blockId][voiceId][beatId].chord = chordAfter;
  Song.measures[trackId][blockId][voiceId][beatId].chordPresent = chordPresentAfter;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Repeat Alternative
export function revertRepeatAlternative({
  trackId, blockId, repeatAlternativeBefore, repeatAlternativePresentBefore,
}: {
  trackId: number, blockId: number, repeatAlternativeBefore: number,
  repeatAlternativePresentBefore: boolean,
}) {
  Song.measureMeta[blockId].repeatAlternativePresent = repeatAlternativePresentBefore;
  Song.measureMeta[blockId].repeatAlternative = repeatAlternativeBefore;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreRepeatAlternative({
  trackId, blockId, repeatAlternativeAfter, repeatAlternativePresentAfter,
}: {
  trackId: number, blockId: number, repeatAlternativeAfter: number,
  repeatAlternativePresentAfter: boolean,
}) {
  Song.measureMeta[blockId].repeatAlternativePresent = repeatAlternativePresentAfter;
  Song.measureMeta[blockId].repeatAlternative = repeatAlternativeAfter;
  requestCurrentVoiceBlockRender(trackId, blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Repeat Close
export function revertRepeatClose(
  infoObj: {trackId: number, blockId: number, repeatClosePresentBefore: boolean,
    repeatCloseBefore: number},
) {
  Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentBefore;
  Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseBefore;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

export function restoreRepeatClose(
  infoObj: {trackId: number, blockId: number, repeatClosePresentAfter: boolean,
    repeatCloseAfter: number},
) {
  Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentAfter;
  Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseAfter;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedPos");
}

// Stroke
export function revertStroke(
  infoObj: {trackId: number, blockId: number, voiceId: number, beatId: number,
    strokePresentBefore: boolean,
  strokeBefore: Stroke},
) {
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  beat.effects.stroke = infoObj.strokeBefore;
  beat.effects.strokePresent = infoObj.strokePresentBefore;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedBeat");
}

export function restoreStroke(infoObj: {trackId: number, blockId: number, voiceId: number, beatId: number,
  strokePresentAfter: boolean, strokeAfter: Stroke }) {
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  beat.effects.stroke = infoObj.strokeAfter;
  beat.effects.strokePresent = infoObj.strokePresentAfter;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedBeat");
}

// Artificial
export function revertArtificial({
  trackId, blockId, voiceId, beatId, string, artificialBefore, artificialPresentBefore,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  artificialBefore: string, artificialPresentBefore: boolean,
}) {
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.artificialStyle = artificialBefore;
    note.artificialPresent = artificialPresentBefore;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

export function restoreArtificial({
  trackId, blockId, voiceId, beatId, string, artificialAfter, artificialPresentAfter,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  artificialAfter: string, artificialPresentAfter: boolean,
}) {
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.artificialStyle = artificialAfter;
    note.artificialPresent = artificialPresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is nul');
  }
}

// Grace
export function revertGrace({
  trackId, blockId, voiceId, beatId, string, graceBefore, gracePresentBefore,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  graceBefore: Grace, gracePresentBefore: boolean,
}) {
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.graceObj = graceBefore;
    note.gracePresent = gracePresentBefore;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

export function restoreGrace({
  trackId, blockId, voiceId, beatId, string, graceAfter, gracePresentAfter,
}: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  graceAfter: Grace, gracePresentAfter: boolean,
}) {
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.graceObj = graceAfter;
    note.gracePresent = gracePresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

// TremoloBar
export function revertTremoloBar(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
  tremoloBarBefore: TremoloBar, tremoloBarPresentBefore: boolean,
  effectsBefore: {string: number, effects: {[s: string]: boolean}}[]},
) {
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  beat.effects.tremoloBar = infoObj.tremoloBarBefore;
  beat.effects.tremoloBarPresent = infoObj.tremoloBarPresentBefore;
  for (const { string, effects } of infoObj.effectsBefore) {
    for (const effect in effects) {
      if (Object.prototype.hasOwnProperty.call(effects, effect)) {
        setEffectVariable(beat, beat.notes[string], effect, effects[effect]);
      }
    }
  }
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedBeat");
}

export function restoreTremoloBar(
  infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number
  tremoloBarAfter: TremoloBar, tremoloBarPresentAfter: boolean,
  effectsBefore: {string: number, effects: {[s: string]: boolean}}[]},
) {
  menuHandler.handleEffectGroupCollisionBeat([infoObj], 'tremoloBar', infoObj.tremoloBarPresentAfter);
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  beat.effects.tremoloBar = infoObj.tremoloBarAfter;
  beat.effects.tremoloBarPresent = infoObj.tremoloBarPresentAfter;
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
  typedEventBus.emit("menu.activateEffectsForMarkedBeat");
}

// tremoloPicking
export function revertTremoloPicking(infoObj: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  tremoloPickingBefore: string, tremoloPickingPresentBefore: boolean,
  effectsBefore: {[m: string]: boolean}
}) {
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  const note = beat.notes[infoObj.string];
  if (note != null) {
    note.tremoloPickingLength = infoObj.tremoloPickingBefore;
    note.tremoloPicking = infoObj.tremoloPickingPresentBefore;
    for (const effect in infoObj.effectsBefore) {
      if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
        setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
      }
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

export function restoreTremoloPicking(infoObj: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  tremoloPickingAfter: string, tremoloPickingPresentAfter: boolean
}) {
  const {
    trackId, blockId, voiceId, beatId, string, tremoloPickingAfter, tremoloPickingPresentAfter,
  } = infoObj;
  menuHandler.handleEffectGroupCollision([infoObj], 'tremoloPicking', tremoloPickingPresentAfter);
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.tremoloPickingLength = tremoloPickingAfter;
    note.tremoloPicking = tremoloPickingPresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

// Bend
export function revertBend(infoObj: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  bendBefore: Bend, bendPresentBefore: boolean, effectsBefore: {[m: string]: boolean}
}) {
  const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
  const note = beat.notes[infoObj.string];
  if (note != null) {
    note.bendObj = infoObj.bendBefore;
    note.bendPresent = infoObj.bendPresentBefore;
    for (const effect in infoObj.effectsBefore) {
      if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
        setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
      }
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

export function restoreBend(infoObj: {
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  bendAfter: Bend, bendPresentAfter: boolean
}) {
  const {
    trackId, blockId, voiceId, beatId, string, bendAfter, bendPresentAfter,
  } = infoObj;
  menuHandler.handleEffectGroupCollision([infoObj], 'bend', bendPresentAfter);
  const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
  if (note != null) {
    note.bendObj = bendAfter;
    note.bendPresent = bendPresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    typedEventBus.emit("menu.activateEffectsForMarkedPos");
  } else {
    console.error('Note is null');
  }
}

export function adaptToChangedTrack(trackId: number, currentTrack: Track, trackAfter: Track) {
  if (currentTrack.numStrings !== trackAfter.numStrings) {
    tab.redrawCompleteTrack(trackId);
  }
  if (trackId === Song.currentTrackId) {
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  }
  AppManager.setTrackInstrument(trackId);
}

// InstrumentSettings
export function revertInstrumentSetting(infoObj: { trackId: number, trackBefore: Track }) {
  const currentTrack = Song.tracks[infoObj.trackId];
  Song.tracks[infoObj.trackId] = infoObj.trackBefore;
  adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackBefore);
}

export function restoreInstrumentSetting(infoObj: { trackId: number, trackAfter: Track }) {
  const currentTrack = Song.tracks[infoObj.trackId];
  Song.tracks[infoObj.trackId] = infoObj.trackAfter;
  adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackAfter);
}

// Add BLOCK
export function revertAddBlock() {
  tab.removeBlock(true);
}

export function restoreAddBlock() {
  tab.addBlock(true);
}

// Remove Block
export function revertRemoveBlock(
  info: {blocksBefore: Measure[][][], measureMetaBefore: MeasureMetaInfo},
) {
  for (let i = 0; i < info.blocksBefore.length; i += 1) {
    if (Song.measures[i] != null) {
      Song.measures[i].push(info.blocksBefore[i]);
    }
  }
  Song.measureMeta.push(info.measureMetaBefore);
  Song.numMeasures += 1;
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
  sequencerHandler.redrawSequencerMain();
}

export function restoreRemoveBlock() {
  tab.removeBlock(true);
}
