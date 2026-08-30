import Vex, { IRenderContext, Flow } from 'vexflow';
import { Song, Measure, Note } from './songData';
import Settings from './settingManager';
import playBackLogic from './playBackLogicNew';
import { tab } from './tab';
import Helper from './helper';
import renderBridge from '../../services/editor/renderBridge';
import { getClassicalRowSurface } from '../../stores/classicalNotationSurfaceState';
import { scrollToSvgBlock } from '../../services/editor/navigationController';
import { TAB_SHEET } from '../../utils/tabSheetConstants';
import AppManager from './appManager';
import {
  publishClassicalLayoutMetrics,
  setClassicalBeatWidth,
} from '../../stores/classicalNotationLayoutState';

class ClassicalNotation {
  vexFlowHeight: number;

  vexFlowStandardWidth: number;

  allNotes: { note: Vex.Flow.StaveNote, tied: boolean[], strings: number[], measure: Measure }[][];

  allVoices: Vex.Flow.StaveNote[][];

  allStaves: Vex.Flow.Stave[][][];

  currentVexDenominator: number;

  currentVexNumerator: number;

  marginTopPerRow: number[];

  noteArray: string[];

  locked: boolean;

  VEXFLOW_HEIGHT: number;

  lastContext: IRenderContext | null;

  rendererPerRow: Vex.Flow.Renderer[];

  allNoteRows: { note: Vex.Flow.StaveNote, strings: number[], tied: boolean[] }[][];

  formatter: Vex.Flow.Formatter | null;

  topLineY: number[];

  drawnStaves: Vex.Flow.Stave[];

  MARGIN_TOP_PADDING: number;

  constructor() {
    this.vexFlowHeight = 140;
    this.vexFlowStandardWidth = 250;

    this.allNotes = [];
    this.allVoices = [];
    this.allStaves = [];
    this.currentVexDenominator = -1;
    this.currentVexNumerator = -1;

    this.marginTopPerRow = [];

    this.noteArray = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    this.locked = true;

    this.VEXFLOW_HEIGHT = 150;
    this.lastContext = null;
    this.rendererPerRow = [];
    this.allNoteRows = [];

    this.formatter = null;

    this.topLineY = [];
    this.drawnStaves = [];
    this.MARGIN_TOP_PADDING = 5;
  }

  getMarginTop(rowId: number): number {
    if (this.marginTopPerRow[rowId] == null) {
      return 0;
    }
    return this.marginTopPerRow[rowId] + this.MARGIN_TOP_PADDING;
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

  syncLayoutMetrics(): void {
    const trackId = Song.currentTrackId;
    const voiceId = Song.currentVoiceId;
    const beatWidthByBlock: Record<number, number> = {};
    const numBlocks = Song.measures[trackId]?.length ?? 0;

    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      const notes = this.allVoices[blockId];
      if (notes == null || notes.length === 0) {
        continue;
      }
      beatWidthByBlock[blockId] = ClassicalNotation.calculateLargestBeatWidthOfNotes(
        trackId,
        blockId,
        voiceId,
        notes,
      );
    }

    publishClassicalLayoutMetrics({
      staveBeginByBlock: { ...this.topLineY },
      marginTopByRow: Object.fromEntries(
        Object.entries(this.marginTopPerRow).map(([rowId, marginTop]) => [
          Number(rowId),
          marginTop + this.MARGIN_TOP_PADDING,
        ]),
      ),
      beatWidthByBlock,
    }, { bumpVersion: false });
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

  drawVexFlowRow(
    trackId: number, voiceId: number, rowId: number, vexFlowArea: HTMLElement,
  ) {
    Helper.removeAllChildren(vexFlowArea);

    const rowBlocks = this.getRowBlockRange(trackId, voiceId, rowId);
    if (!rowBlocks) {
      return;
    }

    const { start, end } = rowBlocks;
    let totalWidth = 0;
    for (let blockId = start; blockId < end; blockId += 1) {
      totalWidth += this.getMeasureDrawWidth(trackId, voiceId, blockId);
    }

    const renderer = new Vex.Flow.Renderer(vexFlowArea, Vex.Flow.Renderer.Backends.SVG);
    this.rendererPerRow[rowId] = renderer;
    renderer.resize(Math.max(totalWidth, 100), this.VEXFLOW_HEIGHT + 40);
    const context = renderer.getContext();
    context.setFont('Arial', 10).setBackgroundFillStyle('#eed');

    this.allNoteRows[rowId] = [];
    for (let blockId = start; blockId < end; blockId += 1) {
      for (let j = 0; j < this.allNotes[blockId].length; j += 1) {
        this.allNoteRows[rowId].push(this.allNotes[blockId][j]);
      }
    }
    this.marginTopPerRow[rowId] = 0;
    this.drawVexFlow(trackId, voiceId, rowId, context);
    if (this.lastContext != null) {
      this.drawVexTies(trackId, voiceId, rowId, context, this.lastContext);
    }
    this.lastContext = context;

    const rowHeight = Math.max(
      this.VEXFLOW_HEIGHT + 40,
      this.marginTopPerRow[rowId] + this.VEXFLOW_HEIGHT,
    );
    renderer.resize(Math.max(totalWidth, 100), rowHeight);
  }

  computeVexFlowDataStructures(trackId: number, voiceId: number): void {
    /** Compute voice information for the complete track */
    this.allNotes.length = 0;
    this.allVoices.length = 0;
    if (this.allStaves[trackId] == null) {
      this.allStaves[trackId] = [];
    }
    this.allStaves[trackId][voiceId] = [];

    for (let blockId = 0; blockId < Song.measures[trackId].length; blockId += 1) {
      this.convertBlockToNotation(trackId, blockId, voiceId);
    }
  }

  static durationToVexFlow(dur: Measure) {
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
    if (blockId === 0) {
      if (Song.playBackInstrument[Song.currentTrackId].instrument === 'drums') {
        stave.addClef('percussion');
      } else if (Song.tracks[Song.currentTrackId].numStrings > 5) {
        stave.addClef('treble');
      } else {
        stave.addClef('bass');
      }
    }
    if (Song.measureMeta[blockId].repeatOpen) {
      stave.setBegBarType(Vex.Flow.Barline.type.REPEAT_BEGIN);
    }
    if (Song.measureMeta[blockId].repeatClosePresent) {
      stave.setEndBarType(Vex.Flow.Barline.type.REPEAT_END);
    }

    /* if(Song.measureMeta[blockId].timeMeterPresent){
      stave.addTimeSignature(Song.measureMeta[blockId].numerator
        +"/"+Song.measureMeta[blockId].denominator);
    } */
    // stave.setMeasure(blockId);        --forced reflow because of line number!

    /* Marker macht nicht so viel Sinn!
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
          if (realNotes[u].gracePresent && grace != null) {
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

    setClassicalBeatWidth(
      blockId,
      ClassicalNotation.calculateLargestBeatWidthOfNotes(
        trackId, blockId, voiceId, this.allVoices[blockId],
      ),
    );
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

  drawVexFlow(trackId: number, voiceId: number, rowId: number, context: IRenderContext) {
    // first compute min-widths
    // TODO: at the moment width of note + 100; consider what is added to the stave
    const notePack: {
      notes: Vex.Flow.StaveNote[], width: number, voice: any, beams: any[], tuplets: any[]
    }[] = [];
    this.formatter = new Vex.Flow.Formatter();
    const rowBlocks = this.getRowBlockRange(trackId, voiceId, rowId);
    if (!rowBlocks) {
      return;
    }

    const { start, end } = rowBlocks;
    for (let i = start; i < end; i += 1) {
      const voice = new Vex.Flow.Voice({
        num_beats: Song.measureMeta[i].numerator,
        beat_value: Song.measureMeta[i].denominator,
      });
      voice.setStrict(false);
      const notes = this.allVoices[i];
      const tuplets = ClassicalNotation.generateVexFlowTuple(trackId, i, voiceId, notes);
      const beams = Vex.Flow.Beam.generateBeams(notes);
      voice.addTickables(notes);
      // Maybe max/min from vexflow vs. my notation
      // TODO; preCalculare possibly expensive - commented out atm
      /* console.log(voice);
      var minWidth = this.formatter.joinVoices([voice]).preCalculateMinTotalWidth([voice]);
      var justifyWidth = minWidth + 100;
      //console.log(justifyWidth);

      if(staveBarWidth+justifyWidth >= completeWidth){
          console.log("Stave too large for window size!");
      }
      staveBarWidth += justifyWidth; */
      // notePack.push({notes:notes, width:justifyWidth, voice:voice,
      //  beams:beams, tuplets:tuplets});
      notePack.push({
        notes, width: 0, voice, beams, tuplets,
      });
    }
    // generate row
    this.marginTopPerRow[rowId] = 0;
    const yPos = 10 + this.marginTopPerRow[rowId];
    let xPos = 0;
    for (let j = 0; j < notePack.length; j += 1) {
      const blockId = start + j;
      const width = this.getMeasureDrawWidth(trackId, voiceId, blockId);
      xPos = this.getMeasureDrawX(trackId, voiceId, blockId, xPos);
      this.drawStave(
        notePack[j].notes, xPos, yPos, width, trackId, voiceId, blockId, context, notePack[j].voice,
        rowId,
      );
      xPos += width;
    }
  }

  updateVexFlowBlock(trackId: number, voiceId: number, blockId: number) {
    /** Redraw row with classical notation to consider changes in given block */
    const rowId = renderBridge.getRowIdForBlock(trackId, voiceId, blockId)
      ?? tab.blockToRow[trackId]?.[voiceId]?.[blockId]?.rowId
    if (rowId == null) {
      console.error('VexFlow row mapping is missing')
      return
    }
    const vexFlowArea = getClassicalRowSurface(rowId);
    if (vexFlowArea != null) {
      this.drawVexFlowRow(trackId, voiceId, rowId, vexFlowArea);
    } else {
      console.error('VexFlowArea is null');
    }
  }

  getYForStaveBegin(blockId: number) {
    return this.topLineY[blockId];
  }

  drawStave(
    notes: Vex.Flow.StaveNote[],
    xPos: number,
    yPos: number,
    width: number,
    trackId: number,
    voiceId: number,
    blockId: number,
    ctx: IRenderContext,
    voice: Vex.Flow.Voice,
    rowId: number,
  ) {
    const stave = ClassicalNotation.generateStave(xPos, yPos, width, blockId);
    this.drawnStaves[blockId] = stave;
    stave.setContext(ctx).draw();

    const formatter = new Vex.Flow.Formatter();
    this.formatter = formatter;
    formatter.joinVoices([voice]).format([voice], 0);
    const numNotes = notes.length;
    const alignment = 8;
    for (let beatId = 0; beatId < numNotes; beatId += 1) {
      const blockInPos = renderBridge.getPositionInRow(trackId, voiceId, blockId, beatId);
      // getAbsoluteX() already adds stave.getNoteStartX() (which includes stave.x).
      // Do not also subtract xPos, or later-bar notes collapse into the first measure.
      const xShift = blockInPos - stave.getNoteStartX() - alignment;
      notes[beatId].getTickContext().setX(xShift);
    }
    voice.draw(ctx, stave);
    let minNote = 1000;
    const beams = Vex.Flow.Beam.generateBeams(notes);
    for (let beatId = 0; beatId < numNotes; beatId += 1) {
      // console.log(stave.start_x);
      minNote = Math.min(minNote, notes[beatId].getNoteHeadBounds().y_top);
    }
    beams.forEach((beam: Vex.Flow.Beam) => beam.postFormat());
    // THIS is the line where the stems are drawn
    beams.forEach((beam: Vex.Flow.Beam) => beam.setContext(ctx).draw());
    // console.log(voice);

    /* There is a rendering bug in vexFlow, so we do not render them atm (12 will be shown as 21)
    for(var i = 0, n = tuplets.length; i < n; i++){
        tuplets[i].setContext(ctx).draw()
    } */

    this.topLineY[blockId] = stave.getBottomLineY() + stave.getHeight();

    const marginTopBlock = (minNote < 0) ? Math.abs(minNote) : 0;
    this.marginTopPerRow[rowId] = Math.max(marginTopBlock, this.marginTopPerRow[rowId]);
    /* var rowId = tab.blockToRow[trackId][Song.currentVoiceId][blockId].rowId;
    if(minNote < 0){
        console.log(completeWidth, Math.abs(minNote) + VEXFLOW_HEIGHT);
        this.rendererPerRow[rowId].resize(completeWidth, Math.abs(minNote) + VEXFLOW_HEIGHT);
    } */
  }

  drawVexTies(
    trackId: number,
    voiceId: number,
    r: number,
    context: IRenderContext,
    lContext: IRenderContext,
  ) {
    // NO blocks, all notes are grouped by row
    for (let i = 0, m = this.allNoteRows[r].length; i < m; i += 1) {
      for (let j = 0; j < this.allNoteRows[r][i].tied.length; j += 1) {
        if (this.allNoteRows[r][i].tied[j]) {
          if (i === 0) {
            // draw two bows at transition between two rows
            // draw in last row
            let secondIndex = j;
            const lastIndex = this.allNoteRows[r - 1].length - 1;
            for (let o = 0; o < this.allNoteRows[r - 1][lastIndex].strings.length; o += 1) {
              if (this.allNoteRows[r - 1][lastIndex].strings[o]
                === this.allNoteRows[r][i].strings[j]) {
                secondIndex = o;
                break;
              }
            }
            if (secondIndex === -1) {
              console.log('Second Index not found!');
            } else {
              const tie1 = new Vex.Flow.StaveTie({
                first_note: this.allNoteRows[r - 1][lastIndex].note,
                first_indices: [secondIndex],
              });
              // console.log(secondIndex);
              tie1.setContext(lContext).draw();

              // draw in own row
              const tie2 = new Vex.Flow.StaveTie({
                last_note: this.allNoteRows[r][0].note,
                last_indices: [j],
              });
              // console.log(j);
              tie2.setContext(context).draw();
              // console.log("Worked");
            }
          } else {
            const index = i - 1;
            // find suitable
            let secondIndex = -1;
            for (let o = 0; o < this.allNoteRows[r][i - 1].strings.length; o += 1) {
              if (this.allNoteRows[r][i - 1].strings[o] === this.allNoteRows[r][i].strings[j]) {
                secondIndex = o;
                break;
              }
            }
            if (secondIndex === -1) {
              console.log('Second Index not found!');
            } else {
              const tie = new Vex.Flow.StaveTie({
                first_note: this.allNoteRows[r][index].note,
                last_note: this.allNoteRows[r][i].note,
                first_indices: [secondIndex],
                last_indices: [j],
              });
              tie.setContext(context).draw();
            }
          }
        }
      }
    }
  }
}

const classicalNotation = new ClassicalNotation();
export default classicalNotation;
export { classicalNotation, ClassicalNotation };
