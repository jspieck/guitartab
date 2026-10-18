import Vex, { IRenderContext, Flow } from 'vexflow';
import { toRaw } from 'vue';
import { Song, Beat, Note } from './songData';
import Settings from './settingManager';
import playBackLogic from './playbackEngine';
import { tab } from './tab';
import Helper from './helper';
import renderBridge from '../../services/editor/renderBridge';
import { scrollToSvgBlock } from '../../services/editor/navigationController';
import { TAB_SHEET } from '../../utils/tabSheetConstants';
import AppManager from './appManager';
import {
  CLASSICAL_STAFF_LINES_HEIGHT,
  getClassicalRowGeometry,
  publishClassicalLayoutMetrics,
  setClassicalBeatWidth,
  type ClassicalStaffExtents,
} from '../../stores/classicalNotationLayoutState';
import { CLASSICAL_CLEF_GUTTER } from '../../services/editor/tabLayoutMetrics';
import { getMeasureBeatWidth, getMeasureBeatX } from '../../utils/measureBeatLayout';

/** VexFlow places a stave's top line this far below the stave's y (4 spaces). */
const STAVE_SPACE_ABOVE_TOP_LINE = 40;
const STAFF_LINE_SPACING = 10;
/** Width of the clef-only stave segment that opens every row (inside the gutter). */
const CLEF_STAVE_WIDTH = 40;
/** Conservative stem length incl. beam slope, used for vertical extents. */
const STEM_EXTENT = 40;
/** Half height of a note head incl. accidental glyphs. */
const NOTE_HEAD_EXTENT = 8;

type RowNote = { note: Vex.Flow.StaveNote, tied: boolean[], strings: number[] };

class ClassicalNotation {
  vexFlowHeight: number;

  vexFlowStandardWidth: number;

  allNotes: { note: Vex.Flow.StaveNote, tied: boolean[], strings: number[], measure: Beat }[][];

  allVoices: Vex.Flow.StaveNote[][];

  allStaves: Vex.Flow.Stave[][][];

  /** Per-block content fingerprint of the last conversion (see `getBlockFingerprint`). */
  blockFingerprints: string[];

  /** Per-block largest beat width from the last conversion. */
  blockBeatWidths: number[];

  /** Track/voice/tuning the cached conversions belong to. */
  conversionScope: string;

  currentVexDenominator: number;

  currentVexNumerator: number;

  noteArray: string[];

  locked: boolean;

  formatter: Vex.Flow.Formatter | null;


  constructor() {
    this.vexFlowHeight = 140;
    this.vexFlowStandardWidth = 250;

    this.allNotes = [];
    this.allVoices = [];
    this.allStaves = [];
    this.blockFingerprints = [];
    this.blockBeatWidths = [];
    this.conversionScope = '';
    this.currentVexDenominator = -1;
    this.currentVexNumerator = -1;

    this.noteArray = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    this.locked = true;


    this.formatter = null;

  }

  toggleClassicalVisibility(): void {
    if (AppManager.duringTrackCreation) {
      return;
    }

    Settings.vexFlowIsActive = !Settings.vexFlowIsActive;

    if (Settings.songPlaying) {
      scrollToSvgBlock(
        Song.currentTrackId, Song.currentVoiceId, playBackLogic.currentBlockPP,
      );
    } else {
      scrollToSvgBlock(Song.currentTrackId, Song.currentVoiceId,
        tab.markedNoteObj.blockId);
    }
  }

  /**
   * Publish layout metrics derived from the notation data only: per-block beat
   * widths (tab spacing) and the track's staff extents (row height).
   * Returns whether anything layout-relevant changed.
   */
  syncLayoutMetrics(): boolean {
    const trackId = Song.currentTrackId;
    const voiceId = Song.currentVoiceId;
    const beatWidthByBlock: Record<number, number> = {};
    const numBlocks = Song.measures[trackId]?.length ?? 0;

    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      const notes = this.allVoices[blockId];
      if (notes == null || notes.length === 0) {
        continue;
      }
      // Computed during conversion; formatting every block again is costly.
      beatWidthByBlock[blockId] = this.blockBeatWidths[blockId]
        ?? ClassicalNotation.calculateLargestBeatWidthOfNotes(trackId, blockId, voiceId, notes);
    }

    const staffExtentsByBlock: Record<number, ClassicalStaffExtents> = {};
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      staffExtentsByBlock[blockId] = ClassicalNotation.computeStaffExtents([this.allVoices[blockId] ?? []]);
    }

    return publishClassicalLayoutMetrics({ beatWidthByBlock, staffExtentsByBlock });
  }

  /** How far notes reach beyond the staff lines, from key lines and stem directions. */
  static computeStaffExtents(voices: Vex.Flow.StaveNote[][]): ClassicalStaffExtents {
    let top = 0;
    let bottom = CLASSICAL_STAFF_LINES_HEIGHT;
    voices.forEach((notes) => {
      notes?.forEach((note) => {
        if (note.isRest()) {
          return;
        }
        const ys = note.getKeyProps().map((props) => (5 - props.line) * STAFF_LINE_SPACING);
        if (ys.length === 0) {
          return;
        }
        let noteTop = Math.min(...ys) - NOTE_HEAD_EXTENT;
        let noteBottom = Math.max(...ys) + NOTE_HEAD_EXTENT;
        if (note.hasStem()) {
          if (note.getStemDirection() > 0) {
            noteTop = Math.min(noteTop, Math.min(...ys) - STEM_EXTENT);
          } else {
            noteBottom = Math.max(noteBottom, Math.max(...ys) + STEM_EXTENT);
          }
        }
        top = Math.min(top, noteTop);
        bottom = Math.max(bottom, noteBottom);
      });
    });
    return {
      above: Math.max(0, -top),
      below: Math.max(0, bottom - CLASSICAL_STAFF_LINES_HEIGHT),
    };
  }

  private getRowBlockRange(
    trackId: number,
    voiceId: number,
    rowId: number,
  ): { start: number, end: number } | null {
    const layout = renderBridge.getTrackLayout(trackId, voiceId)
    if (layout) {
      const blockIds = layout.blockLayouts
        .map((blockLayout, blockId) => ({ blockId, rowId: blockLayout.rowId }))
        .filter((entry) => entry.rowId === rowId)
        .map((entry) => entry.blockId)
        .sort((left, right) => left - right)

      if (blockIds.length > 0) {
        return {
          start: blockIds[0],
          end: blockIds[blockIds.length - 1] + 1,
        }
      }
    }

    return tab.blocksPerRow[trackId]?.[voiceId]?.[rowId] ?? null
  }

  private getMeasureDrawWidth(
    trackId: number,
    voiceId: number,
    blockId: number,
  ): number {
    const layoutWidth = renderBridge.getBlockWidth(trackId, voiceId, blockId)
    const legacyWidth = tab.finalBlockWidths[trackId]?.[voiceId]?.[blockId]
    const width = (Number.isFinite(layoutWidth) && layoutWidth > 0)
      ? layoutWidth
      : (Number.isFinite(legacyWidth) && (legacyWidth ?? 0) > 0 ? legacyWidth! : 200)
    return width
  }

  private getMeasureDrawX(
    trackId: number,
    voiceId: number,
    blockId: number,
    fallbackX: number,
  ): number {
    const blockLayout = renderBridge.getBlockLayout(trackId, voiceId, blockId)
    if (blockLayout != null && Number.isFinite(blockLayout.xOffset)) {
      return blockLayout.xOffset
    }
    return fallbackX
  }

  /**
   * Draw one classical row into its surface. The surface spans the row's tab
   * width plus `CLASSICAL_CLEF_GUTTER` on the left, and the classical area height.
   * Rows are self-contained (no shared state between rows), so any subset of
   * rows can be drawn in any order.
   */
  drawVexFlowRow(
    trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement,
  ) {
    Helper.removeAllChildren(vexFlowArea);

    const rowBlocks = this.getRowBlockRange(trackId, voiceId, rowId);
    if (!rowBlocks || this.allVoices.length === 0) {
      return;
    }

    const { start, end } = rowBlocks;
    let rowRight = 0;
    for (let blockId = start; blockId < end; blockId += 1) {
      rowRight = Math.max(
        rowRight,
        this.getMeasureDrawX(trackId, voiceId, blockId, rowRight)
          + this.getMeasureDrawWidth(trackId, voiceId, blockId),
      );
    }

    const { height, staffTop } = getClassicalRowGeometry(start, end);
    const renderer = new Vex.Flow.Renderer(vexFlowArea, Vex.Flow.Renderer.Backends.SVG);
    renderer.resize(CLASSICAL_CLEF_GUTTER + Math.max(rowRight, 100), height);
    const context = renderer.getContext();
    context.setFont('Arial', 10).setBackgroundFillStyle('#eed');

    const staveY = staffTop - STAVE_SPACE_ABOVE_TOP_LINE;
    const firstX = this.getMeasureDrawX(trackId, voiceId, start, 0);
    const clefStave = new Vex.Flow.Stave(
      CLASSICAL_CLEF_GUTTER + firstX - CLEF_STAVE_WIDTH, staveY, CLEF_STAVE_WIDTH,
    );
    clefStave.addClef(ClassicalNotation.getClefType());
    clefStave.setEndBarType(Vex.Flow.Barline.type.NONE);
    clefStave.setContext(context).draw();

    let fallbackX = firstX;
    for (let blockId = start; blockId < end; blockId += 1) {
      const xPos = this.getMeasureDrawX(trackId, voiceId, blockId, fallbackX);
      const width = this.getMeasureDrawWidth(trackId, voiceId, blockId);
      this.drawStave(trackId, voiceId, blockId, xPos, staveY, width, blockId === start, context);
      fallbackX = xPos + width;
    }

    this.drawVexTies(trackId, voiceId, rowId, context);
  }

  /**
   * Compute voice information for the complete track. Conversion is the costly
   * part (StaveNote construction), so blocks whose content fingerprint is
   * unchanged keep their previous notes.
   */
  computeVexFlowDataStructures(trackId: number, voiceId: number): void {
    const track = Song.tracks[trackId];
    const scope = JSON.stringify([
      trackId, voiceId, toRaw(track.strings), track.numStrings, ClassicalNotation.getClefType(),
    ]);
    if (scope !== this.conversionScope) {
      this.conversionScope = scope;
      this.blockFingerprints = [];
      this.blockBeatWidths = [];
    }
    if (this.allStaves[trackId] == null) {
      this.allStaves[trackId] = [];
    }
    this.allStaves[trackId][voiceId] = [];

    const numBlocks = Song.measures[trackId].length;
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      const fingerprint = ClassicalNotation.getBlockFingerprint(trackId, blockId, voiceId);
      if (
        fingerprint != null
        && fingerprint === this.blockFingerprints[blockId]
        && this.allVoices[blockId] != null
      ) {
        continue;
      }
      this.convertBlockToNotation(trackId, blockId, voiceId);
      this.blockFingerprints[blockId] = fingerprint ?? '';
    }
    this.allNotes.length = numBlocks;
    this.allVoices.length = numBlocks;
    this.blockFingerprints.length = numBlocks;
    this.blockBeatWidths.length = numBlocks;
  }

  /**
   * Everything `convertBlockToNotation` reads for one block, as a string.
   * Returns null when the data cannot be serialised (then the block is always converted).
   */
  static getBlockFingerprint(trackId: number, blockId: number, voiceId: number): string | null {
    try {
      const meta = Song.measureMeta[blockId];
      const beats = toRaw(Song.measures[trackId][blockId][voiceId]);
      const tuplets = beats.map((beat) => (
        beat.tuplet != null ? tab.tupletManager[beat.tupletId]?.originalDuration : null
      ));
      return JSON.stringify([meta?.numerator, meta?.denominator, beats, tuplets]);
    } catch {
      return null;
    }
  }

  static durationToVexFlow(dur: Beat) {
    let dottedString = '';
    if (dur.dotted) {
      dottedString = 'd';
    } else if (dur.doubleDotted) {
      dottedString = 'dd';
    }

    const durationStr = dur.duration;
    // special case: make tuplet of one dotted note to normal duration
    if (dur.dotted && dur.tuplet != null) {
      if (tab.tupletManager[dur.tupletId].originalDuration[0] === dur.duration[0]) {
        dottedString = '';
      }
    }

    switch (durationStr) {
      case 'w':
      case 'h':
      case 'q':
        return durationStr + dottedString;
      case 'wr':
      case 'hr':
      case 'qr':
        return durationStr.charAt(0) + dottedString + durationStr.charAt(1);
      case 'e':
        return `8${dottedString}`;
      case 'er':
        return `8${dottedString}r`;
      case 's':
        return `16${dottedString}`;
      case 'sr':
        return `16${dottedString}r`;
      case 't':
        return `32${dottedString}`;
      case 'tr':
        return `32${dottedString}r`;
      case 'z':
        return `64${dottedString}`;
      case 'zr':
        return `64${dottedString}r`;
      default:
        return '8';
    }
  }

  heightToVexFlow(height: number): string {
    const note = this.noteArray[height % 12];
    const octave = Math.floor(height / 12);
    return `${note}/${octave}`;
  }

  static valueToBendtext(val: number): string {
    const value = Math.abs(val);
    if (value === 25) return '1/4';
    if (value === 50) return '1/2';
    if (value === 75) return '3/4';
    if (value >= 100) return 'Full';
    console.log('Bend error!');
    return '';
  }

  static generateStave(
    xPos: number, yPos: number, width: number, blockId: number,
  ): Vex.Flow.Stave {
    const stave = new Vex.Flow.Stave(xPos, yPos, width);
    if (Song.measureMeta[blockId].repeatOpen) {
      stave.setBegBarType(Vex.Flow.Barline.type.REPEAT_BEGIN);
    }
    if (Song.measureMeta[blockId].repeatClose != null) {
      stave.setEndBarType(Vex.Flow.Barline.type.REPEAT_END);
    }

    /* if(Song.measureMeta[blockId].timeMeterPresent){
      stave.addTimeSignature(Song.measureMeta[blockId].numerator
        +"/"+Song.measureMeta[blockId].denominator);
    } */
    // stave.setMeasure(blockId);        --forced reflow because of line number!

    /* Markers on the stave add little here.
    if(Song.measureMeta[blockId].marker != null)
      stave.setText(Song.measureMeta[blockId].marker.text,
        Vex.Flow.Modifier.Position.ABOVE); */

    // stave.addKeySignature('A');
    // stave.setTempo(tempo, tempo_y);
    //
    /* stave.setText('Right Text', Vex.Flow.Modifier.Position.RIGHT);
        stave.setText('Above Text', Vex.Flow.Modifier.Position.ABOVE);
        stave.setText('Below Text', Vex.Flow.Modifier.Position.BELOW); */
    return stave;
  }

  convertBlockToNotation(trackId: number, blockId: number, voiceId: number) {
    const bar = Song.measures[trackId][blockId][voiceId];
    this.allNotes[blockId] = [];
    this.allVoices[blockId] = [];
    for (let i = 0; i < bar.length; i += 1) {
      const dur = ClassicalNotation.durationToVexFlow(bar[i]);
      const keys = [];
      const ties = [];
      const strings = [];
      const realNotes = [];

      const heights: { height: number, note: Note, string: number }[] = [];
      const set = new Set();
      const { numStrings } = Song.tracks[trackId];
      for (let j = 0; j < numStrings; j += 1) {
        const note = bar[i].notes[j];
        if (note != null) {
          const height = Math.round(Song.tracks[trackId].strings[j]) + note.fret;
          if (!set.has(height)) {
            set.add(height);
            heights.push({ height, note, string: j });
          }
        }
      }
      // Special Case GPX: add notes from otherNotes
      if (bar[i].otherNotes != null) {
        for (let j = 0; j < bar[i].otherNotes.length; j += 1) {
          const note = bar[i].otherNotes[j];
          if (!set.has(note.height)) {
            set.add(note.height);
            heights.push({ height: note.height, note, string: -1 });
          }
        }
      }
      const heightSorted = heights.sort((a, b) => a.height - b.height);
      for (let j = 0; j < heightSorted.length; j += 1) {
        keys.push(this.heightToVexFlow(heightSorted[j].height));
        // eslint-disable-next-line prefer-destructuring
        realNotes[j] = heightSorted[j].note;
        ties[j] = heightSorted[j].note.tied != null && heightSorted[j].note.tied;
        // eslint-disable-next-line prefer-destructuring
        strings[j] = heightSorted[j].string;
      }
      let clefType = 'treble';
      if (Song.playBackInstrument[Song.currentTrackId].instrument === 'drums') {
        clefType = 'percussion';
      } else if (Song.tracks[Song.currentTrackId].numStrings < 6) {
        clefType = 'bass';
      }
      // Rests need a pitch placeholder but must keep the rest duration suffix.
      if (keys.length === 0) {
        keys.push('b/4');
      }

      const staveNote = new Vex.Flow.StaveNote({
        clef: clefType,
        keys,
        duration: dur,
        auto_stem: true,
      });

      for (let u = 0; u < keys.length; u += 1) {
        // e#/4
        if (keys[u].length > 3) {
          staveNote.addModifier(new Vex.Flow.Accidental('#'), u);
        }
        if (realNotes[u] != null) {
        /* Do we really want to display these?
          if(realNotes[u].vibrato){
            //newVibrato().setVibratoWidth(60)   .setHarsh(true)
            note.addModifier(u, new Vex.Flow.Vibrato());
          }
          if(realNotes[u].bendObj != null){
              if(realNotes[u].bendObj.length == 0){
                  //gpx-Format
                  continue;
              }
              //BENDS
              var bendPhrase = [];
              var lastValue = parseInt(realNotes[u].bendObj[0].bendValue);
              for(var o = 1; o < realNotes[u].bendObj.length; o++){
                  var diff = parseInt(realNotes[u].bendObj[o].bendValue) - lastValue;
                  if(diff > 0){
                      bendPhrase.push({type:Vex.Flow.Bend.UP, text:valueToBendtext(diff)});
                  }else if(diff == 0){

                  }else{
                      bendPhrase.push({type:Vex.Flow.Bend.DOWN, text:valueToBendtext(diff)});
                  }
                  lastValue = realNotes[u].bendObj[o].bendValue;
              }
              //new Vex.Flow.Bend('', false));    //'Full', '1/2'
              note.addModifier(u, new Vex.Flow.Bend(null, null, bendPhrase));
          }

          //a- is bar over // a@a, a@u is fermate above, below,
          if(realNotes[u].accentuated || realNotes[u].heavyAccentuated)
              note.addArticulation(0, new Vex.Flow.Articulation('a>').setPosition(3));
          if(realNotes[u].stacatto)
              note.addArticulation(0, new Vex.Flow.Articulation('a.').setPosition(3)); */
          // handle grace
          const grace = realNotes[u].graceObj;
          if (grace != null) {
            // duration t, s, e
            let graceDuration = '16';
            if (grace.duration === 't') {
              graceDuration = '32';
            } else if (grace.duration === 'e') {
              graceDuration = '8';
            }

            const graceHeight = Song.tracks[trackId].strings[strings[u]] + grace.fret;
            // console.log("Grace Height "+graceHeight);
            const graceNote = new Vex.Flow.GraceNote({
              keys: [this.heightToVexFlow(graceHeight)],
              duration: graceDuration,
            });
            // console.log(graceNote);
            staveNote.addModifier(new Vex.Flow.GraceNoteGroup([graceNote]), u);
          }
          /* if(realNotes[u].trill){
            note.addModifier(u, new Vex.Flow.Ornament('tr'));
          } */
        }
      }
      if (bar[i].dotted) {
        // staveNote.addDotToAll();
        staveNote.addDotToAll();
      } else if (bar[i].doubleDotted) {
        // staveNote.addDotToAll().addDotToAll();
        staveNote.addDotToAll().addDotToAll();
        // Vex.Flow.Dot.buildAndAttach([staveNote], { all: true });
      }

      /* if(bar[i].effects !== null && bar[i].effects.strokeType !== null){
        if(bar[i].effects.strokeType == "down")
          note.addStroke(0, new Vex.Flow.Stroke(1));
        else if(bar[i].effects.strokeType == "up")
          note.addStroke(0, new Vex.Flow.Stroke(2));
      } */

      this.allNotes[blockId].push({
        note: staveNote, tied: ties, strings, measure: bar[i],
      });
      this.allVoices[blockId].push(staveNote);
    }

    this.blockBeatWidths[blockId] = ClassicalNotation.calculateLargestBeatWidthOfNotes(
      trackId, blockId, voiceId, this.allVoices[blockId],
    );
    setClassicalBeatWidth(blockId, this.blockBeatWidths[blockId]);
  }

  static generateVexFlowTuple(
    trackId: number, blockId: number, voiceId: number, notes: Vex.Flow.StaveNote[],
  ) {
    const bar = Song.measures[trackId][blockId][voiceId];
    const tuplets = [];
    for (let i = 0; i < bar.length; i += 1) {
      if (bar[i].tuplet != null) {
        const tupletNotes = [];
        const startTupletId = bar[i].tupletId;
        const startTuplet = bar[i].tuplet;
        let j;
        for (j = i; j < bar.length; j += 1) {
          if (bar[j].tuplet != null && startTupletId === bar[j].tupletId) {
            tupletNotes.push(notes[j]);
          } else {
            break;
          }
        }
        i = j - 1;

        // Special case: dotted single tuplet - also handled in vexflowDuration
        if (tupletNotes.length !== 1) {
          const tupleConfig = { num_notes: startTuplet!, ratioed: false };
          tuplets.push(new Vex.Flow.Tuplet(tupletNotes, tupleConfig));
        }
      }
    }
    return tuplets;
  }

  static getNoteWidth(note: Vex.Flow.StaveNote) {
    const metrics = note.getMetrics() as {
      width?: number
      notePx?: number
      noteWidth?: number
      extraRightPx?: number
      extraLeftPx?: number
      modRightPx?: number
      modLeftPx?: number
      leftDisplacedHeadPx?: number
      rightDisplacedHeadPx?: number
    }
    const alignment = 10
    const total = metrics.width
      ?? ((metrics.notePx ?? metrics.noteWidth ?? 0)
        + (metrics.modRightPx ?? 0)
        + (metrics.modLeftPx ?? 0)
        + (metrics.rightDisplacedHeadPx ?? metrics.extraRightPx ?? 0)
        + (metrics.leftDisplacedHeadPx ?? metrics.extraLeftPx ?? 0))
    const width = (Number.isFinite(total) ? total : 0) + alignment
    return width > 0 ? width : alignment
  }

  calculateLargestBeatWidth(trackId: number, blockId: number, voiceId: number) {
    return ClassicalNotation.calculateLargestBeatWidthOfNotes(
      trackId, blockId, voiceId, this.allVoices[blockId],
    );
  }

  static calculateLargestBeatWidthOfNotes(
    trackId: number, blockId: number, voiceId: number, notes: Vex.Flow.StaveNote[],
  ) {
    if (!Array.isArray(notes) || notes.length === 0) {
      return 0
    }

    let maxVoiceWidth = 0;
    const voice = new Vex.Flow.Voice({
      num_beats: Song.measureMeta[blockId].numerator,
      beat_value: Song.measureMeta[blockId].denominator,
    });
    voice.setStrict(false);
    voice.addTickables(notes);
    (new Vex.Flow.Formatter()).joinVoices([voice]).format([voice], 0);

    for (let i = 0, n = notes.length; i < n; i += 1) {
      const noteWidth = ClassicalNotation.getNoteWidth(notes[i]);
      maxVoiceWidth = Math.max(noteWidth, maxVoiceWidth);
    }
    return Number.isFinite(maxVoiceWidth) ? maxVoiceWidth : 0;
  }

  /** Re-convert one block after an edit; drawing is scheduled by the adapter. */
  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number) {
    this.convertBlockToNotation(trackId, blockId, voiceId);
  }

  static getClefType(): string {
    if (Song.playBackInstrument[Song.currentTrackId]?.instrument === 'drums') {
      return 'percussion';
    }
    return Song.tracks[Song.currentTrackId].numStrings > 5 ? 'treble' : 'bass';
  }

  /**
   * Draw one measure. Note heads are centred on the tab digit centres
   * (`beatX + beatWidth / 2`, as `TabNote` renders them) so both systems align.
   */
  drawStave(
    trackId: number,
    voiceId: number,
    blockId: number,
    xPos: number,
    yPos: number,
    width: number,
    isFirstInRow: boolean,
    ctx: IRenderContext,
  ) {
    const notes = this.allVoices[blockId] ?? [];
    const stave = ClassicalNotation.generateStave(
      CLASSICAL_CLEF_GUTTER + xPos, yPos, width, blockId,
    );
    if (isFirstInRow && !Song.measureMeta[blockId].repeatOpen) {
      // The clef segment already opened the system; avoid a barline right after it.
      stave.setBegBarType(Vex.Flow.Barline.type.NONE);
    }
    stave.setContext(ctx).draw();
    if (notes.length === 0) {
      return;
    }

    const voice = new Vex.Flow.Voice({
      num_beats: Song.measureMeta[blockId].numerator,
      beat_value: Song.measureMeta[blockId].denominator,
    });
    voice.setStrict(false);
    voice.addTickables(notes);
    // Beams first, so beamed notes do not also draw flags.
    const beams = Vex.Flow.Beam.generateBeams(notes);
    new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 0);
    // Voice.setStave does not reach the notes; their absolute X needs the stave.
    voice.setStave(stave);
    notes.forEach((note) => note.setStave(stave));

    const measureData = Song.measures[trackId][blockId][voiceId];
    for (let beatId = 0; beatId < notes.length; beatId += 1) {
      const note = notes[beatId];
      const targetCenter = CLASSICAL_CLEF_GUTTER + xPos
        + getMeasureBeatX(trackId, voiceId, blockId, beatId, measureData)
        + getMeasureBeatWidth(trackId, voiceId, blockId, beatId, measureData) / 2;
      const currentCenter = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
      const tickContext = note.getTickContext();
      tickContext.setX(tickContext.getX() + targetCenter - currentCenter);
    }

    beams.forEach((beam: Vex.Flow.Beam) => beam.postFormat());
    voice.draw(ctx, stave);
    beams.forEach((beam: Vex.Flow.Beam) => beam.setContext(ctx).draw());
  }

  private getRowNotes(trackId: number, voiceId: number, rowId: number): RowNote[] {
    const range = this.getRowBlockRange(trackId, voiceId, rowId);
    if (!range) {
      return [];
    }
    const rowNotes: RowNote[] = [];
    for (let blockId = range.start; blockId < range.end; blockId += 1) {
      rowNotes.push(...(this.allNotes[blockId] ?? []));
    }
    return rowNotes;
  }

  /**
   * Ties of one row. Ties crossing a row break are drawn as two halves, each in
   * its own row (outgoing half here when the next row starts tied, incoming half
   * when this row starts tied), so rows never need each other's context.
   */
  drawVexTies(trackId: number, voiceId: number, rowId: number, context: IRenderContext) {
    const rowNotes = this.getRowNotes(trackId, voiceId, rowId);
    if (rowNotes.length === 0) {
      return;
    }

    for (let i = 0; i < rowNotes.length; i += 1) {
      const current = rowNotes[i];
      for (let j = 0; j < current.tied.length; j += 1) {
        if (!current.tied[j]) {
          continue;
        }
        if (i === 0) {
          new Vex.Flow.StaveTie({ last_note: current.note, last_indices: [j] })
            .setContext(context).draw();
          continue;
        }
        const previousIndex = rowNotes[i - 1].strings.indexOf(current.strings[j]);
        if (previousIndex !== -1) {
          new Vex.Flow.StaveTie({
            first_note: rowNotes[i - 1].note,
            last_note: current.note,
            first_indices: [previousIndex],
            last_indices: [j],
          }).setContext(context).draw();
        }
      }
    }

    const nextFirst = this.getRowNotes(trackId, voiceId, rowId + 1)[0];
    const last = rowNotes[rowNotes.length - 1];
    nextFirst?.tied.forEach((tied, j) => {
      const lastIndex = tied ? last.strings.indexOf(nextFirst.strings[j]) : -1;
      if (lastIndex !== -1) {
        new Vex.Flow.StaveTie({ first_note: last.note, first_indices: [lastIndex] })
          .setContext(context).draw();
      }
    });
  }
}

const classicalNotation = new ClassicalNotation();
export default classicalNotation;
export { classicalNotation, ClassicalNotation };
