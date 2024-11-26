import tinycolor from 'tinycolor2';
import Song, {
  Note, Measure, Grace, TremoloBar, Bend,
} from './songData';
import Settings from './settingManager';
import Duration from './duration';
import playBackLogic from './playBackLogicNew';
import { tab } from './tab';
import Helper from './helper';
import AppManager from './appManager';
import { modalManager } from './modals/modalManager';
import { audioEngine } from './audioEngine';
import { classicalNotation } from './vexflowClassical';
import { overlayHandler } from './overlayHandler';
import EventBus from "./eventBus";
import { ChordModalHandler } from './modals/chordModalHandler';
import { MODALS } from './modals/modalTypes';
import { ChordManagerModalHandler } from './modals/chordManagerModalHandler';

class SvgDrawer {
  rowsPerPage: { rowStart: number, rowEnd: number }[][][];

  numRows: number;

  START_OFFSET_WIDTH: number;

  completeWidth: number; // 31.5cm to px

  completeHeight: number; // 44.55 to px

  PAGE_MARGIN_SIDE: number;

  PAGE_MARGIN_TOP: number;

  heightOfRow: number[][][];

  svgPagesCompleteTrack: {
    inner: SVGGElement,
    capsule: HTMLElement,
  }[][][];

  svgPagesPlayBackBar: SVGGElement[][][];

  heightPerString: number;

  svgRows: SVGGElement[];

  vexFlowRows: SVGGElement[];

  svgBlocks: { overBarGroup: SVGGElement | null, block: SVGGElement | null,
    notesGroup: SVGGElement | null, durationGroup: SVGGElement | null,
    effectGroup: SVGGElement | null }[][][];

  rowToY: number[][][];

  blockToX: number[][][];

  blockToPage: number[];

  scrollTopMC: number;

  FIRST_PAGE_TOP_MARGIN: number;

  lastPlayBackBarPageId: number;

  playBackBarObjects: SVGGElement[];

  NUM_CHORD_DIAGRAM_ROWS: number;

  DIA_WIDTH: number;

  DIA_HEIGHT: number;

  DIA_SPACING: number;

  generalColor: string;

  chordDiagramsHeight: number;

  clickMarkers: SVGGElement[];

  lastCurrentPos: number;

  lastNextPos: number;

  lastTime: number;

  lastTransformTime: number;

  jumpToNewPos: boolean;

  startClickPos: { blockId: number, beatId: number, relativeX: number };

  svgDefs: SVGGElement | null;

  DISTANCE_TO_BEAT_MIDDLE: number;

  usedNotes: Map<string, SVGGElement>;

  lastWidth: number;

  lastNotes: SVGGElement[];

  paddingLeft: number;

  paddingTop: number;

  pageHeight: number;

  pageWidth: number;

  tabInformationHeight: number;

  distanceBetweenPages: number;

  numPages: number;

  tabGroupWidth: number;

  trackCreated: boolean;

  VEXFLOW_HEIGHT: number;

  FOOTER_HEIGHT: number;

  durationToRest: {[a: string]: string};

  seamCounter: number;

  dynamicsToSymbol: {[a: string]: string};

  typeToFont: {[a: string]: string};

  triggerReflow: number;

  constructor() {
    this.rowsPerPage = [];
    this.numRows = 0;
    this.START_OFFSET_WIDTH = 32;
    this.completeWidth = 31.5 * 37.795276; // 31.5cm to px
    this.completeHeight = 44.55 * 37.795276; // 44.55 to px
    this.PAGE_MARGIN_SIDE = this.completeWidth * (1 / 21);
    this.PAGE_MARGIN_TOP = this.completeHeight * (1 / 29.7);

    this.heightOfRow = [];

    this.svgPagesCompleteTrack = [];
    this.svgPagesPlayBackBar = [];
    this.heightPerString = 12;

    this.triggerReflow = 0;
    this.svgRows = [];
    this.vexFlowRows = [];
    this.svgBlocks = [];

    // array with yPos of lines per row
    this.rowToY = [];
    this.blockToX = [];
    this.blockToPage = [];

    this.scrollTopMC = 0;
    this.FIRST_PAGE_TOP_MARGIN = 90;

    this.lastPlayBackBarPageId = -1;
    this.playBackBarObjects = [];

    this.NUM_CHORD_DIAGRAM_ROWS = 0;
    this.DIA_WIDTH = 60;
    this.DIA_HEIGHT = 80;
    this.DIA_SPACING = 40;

    this.generalColor = '#000';
    this.chordDiagramsHeight = 0;

    this.clickMarkers = [];

    this.lastCurrentPos = 0;
    this.lastNextPos = 0;
    this.lastTime = 0;
    this.lastTransformTime = 0;
    this.jumpToNewPos = true;

    this.startClickPos = { blockId: 0, beatId: 0, relativeX: 0 };
    this.svgDefs = null;
    this.DISTANCE_TO_BEAT_MIDDLE = 10;
    this.usedNotes = new Map<string, SVGGElement>();
    this.lastWidth = 0;
    this.lastNotes = [];

    /* width: 21cm; height: 29.7cm padding: 2.5 */
    this.paddingLeft = 0;
    this.paddingTop = 0;
    this.pageHeight = 0;
    this.pageWidth = 0;
    this.tabInformationHeight = 110;
    this.distanceBetweenPages = 20;
    this.numPages = 0;
    this.tabGroupWidth = 0;
    this.trackCreated = false;
    this.VEXFLOW_HEIGHT = 150;
    this.FOOTER_HEIGHT = 15;

    this.durationToRest = {
      wr: 'î',
      hr: '/',
      qr: 'Î',
      er: 'ä',
      sr: 'Å',
      tr: '¨',
      zr: 'ô',
      or: 'å',

      w: 'i',
      h: 'j',
      q: 'k',
      e: 'l',
      s: 'm',
      t: 'n',
      z: 'o',
      o: 'p',
    };

    this.seamCounter = 0;

    this.dynamicsToSymbol = {
      p: 'p',
      ppp: '¸',
      mf: 'F',
      mp: 'P',
      f: 'f',
      ff: 'Ä',
      fff: 'ì',
    };

    this.typeToFont = {
      chord: '16px',
      palmMute: '12px',
      stacatto: '20px',
      accentuated: '16px',
      artificial: '12px',
      letRing: '12px',
    };
  }

  getXForBlock(trackId: number, voiceId: number, blockId: number) {
    return this.blockToX[trackId][blockId][voiceId];
  }

  initHelperArrays(trackId: number, voiceId: number) {
    console.log('Init Helper Arrays');
    if (this.svgPagesCompleteTrack[trackId] == null) {
      this.svgPagesCompleteTrack[trackId] = [];
    }
    if (this.svgPagesCompleteTrack[trackId][voiceId] == null) {
      this.svgPagesCompleteTrack[trackId][voiceId] = [];
    }

    if (this.svgPagesPlayBackBar[trackId] == null) this.svgPagesPlayBackBar[trackId] = [];
    if (this.svgPagesPlayBackBar[trackId][voiceId] == null) {
      this.svgPagesPlayBackBar[trackId][voiceId] = [];
    }

    if (this.svgBlocks[trackId] == null) this.svgBlocks[trackId] = [];
    if (this.rowToY[trackId] == null) this.rowToY[trackId] = [];
    if (this.blockToX[trackId] == null) this.blockToX[trackId] = [];
    console.log(Song.measures);
    if (this.rowsPerPage[trackId] == null) {
      this.rowsPerPage[trackId] = [];
    }
    for (let blockId = 0; blockId < Song.measures[0].length; blockId += 1) {
      if (this.svgBlocks[trackId][blockId] == null) {
        this.svgBlocks[trackId][blockId] = [];
      }
      if (this.blockToX[trackId][blockId] == null) {
        this.blockToX[trackId][blockId] = [];
      }
      this.svgBlocks[trackId][blockId][voiceId] = {
        overBarGroup: null, block: null, notesGroup: null, durationGroup: null, effectGroup: null,
      };
      this.blockToX[trackId][blockId][voiceId] = 0;
    }

    if (this.rowToY[trackId][voiceId] == null) {
      this.rowToY[trackId][voiceId] = [];
    }
    for (let i = 0; i < this.numRows; i += 1) {
      this.rowToY[trackId][voiceId][i] = 0;
    }

    // no trackId or voiceId because it is rerendered atm anyway
    this.blockToPage.length = 0;
  }

  getPositionMarkerHeight(trackId: number) {
    let height = (Song.tracks[trackId].numStrings - 1) * this.heightPerString;
    if (Settings.vexFlowIsActive) {
      height += 150;
    }
    return height;
  }

  deleteTrack(trackId: number) {
    this.svgPagesPlayBackBar.splice(trackId, 1);
    this.svgPagesCompleteTrack.splice(trackId, 1);
    this.svgBlocks.splice(trackId, 1);
  }

  drawPositionMarker(trackId: number, voiceId: number, pageId: number) {
    const height = this.getPositionMarkerHeight(trackId);
    const width = 10;
    const exactHeight = 10;
    const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerGroup.style.display = 'none';

    markerGroup.setAttribute('id', `markerGroup${pageId}`);
    markerGroup.setAttribute('transform', `translate(${0},${0})`);
    const marker = SvgDrawer.createRect(0, 0, width, height, 'none', '1', 'rgba(109, 156, 207, 0.4)');

    const exactPosition = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    exactPosition.setAttribute('id', `exactPosition${pageId}`);
    const exactPositionMarker = SvgDrawer.createPath(`M0 0V${exactHeight} H${width}V0Z`, 'none', '1', '');
    exactPositionMarker.setAttribute('class', 'exactPositionMarker');
    exactPosition.appendChild(exactPositionMarker);
    markerGroup.appendChild(marker);
    markerGroup.appendChild(exactPosition);
    this.svgPagesPlayBackBar[trackId][voiceId][pageId].appendChild(markerGroup);
  }

  drawPlayBackBar(trackId: number, voiceId: number, pageId: number) {
    const height = (Song.tracks[trackId].numStrings - 1) * this.heightPerString;
    const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerGroup.setAttribute('id', `playBackBarGroup${pageId}`);
    markerGroup.setAttribute('transform', `translate(${0},${0})`);
    markerGroup.setAttribute('class', 'playBackBarClass');
    markerGroup.style.display = 'none';
    const marker = SvgDrawer.createRect(0, -5, 10, height, 'none', '1', 'rgba(49, 156, 217, 0.4)');
    markerGroup.appendChild(marker);
    this.svgPagesPlayBackBar[trackId][voiceId][pageId].appendChild(markerGroup);
    this.playBackBarObjects.push(markerGroup);
  }

  drawClickMarker(trackId: number, voiceId: number, pageId: number) {
    const clickMarker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    clickMarker.setAttribute('id', `clickMarker${pageId}`);
    clickMarker.style.display = 'none';
    this.clickMarkers[pageId] = clickMarker;
    const length = 14;
    const clickMarkerPath = SvgDrawer.createPath(`M0 0V${length} H${length}V0Z`, '', '1', 'none');
    clickMarkerPath.setAttribute('class', 'clickMarkerPath');
    clickMarker.appendChild(clickMarkerPath);
    this.svgPagesPlayBackBar[trackId][voiceId][pageId].appendChild(clickMarker);
  }

  hideClickMarkers() {
    for (let i = 0; i < this.numPages; i += 1) {
      if (this.clickMarkers[i] != null) {
        this.clickMarkers[i].style.display = 'none';
      }
    }
  }

  hidePlayBackBars() {
    for (let i = 0, n = this.playBackBarObjects.length; i < n; i = 1) {
      this.playBackBarObjects[i].style.display = 'none';
    }
  }

  markClickedPos(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, pageNumber: number,
  ) {
    let pageId = pageNumber;
    if (pageId == null) {
      pageId = this.blockToPage[blockId];
      if (pageId == null) {
        pageId = 0;
      }
    }
    const eGroup = this.clickMarkers[pageId];
    this.hideClickMarkers();
    eGroup.style.display = 'block';
    const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
    let xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 3;
    xPos += this.blockToX[trackId][blockId][voiceId];
    const yPos = this.rowToY[trackId][voiceId][rowId] - 1;
    let yPosString = yPos + (Song.tracks[trackId].numStrings
      - 1 - string - 0.5) * this.heightPerString;
    if (Settings.vexFlowIsActive) {
      yPosString += this.VEXFLOW_HEIGHT;
    }
    eGroup.setAttribute('transform', `translate(${xPos},${yPosString})`);
    tab.markedNoteObj = {
      trackId, blockId, beatId, voiceId, string,
    };
  }

  getPositionInRow(trackId: number, voiceId: number, blockId: number, beatId: number) {
    return Helper.getBeatPosX(trackId, blockId, voiceId, beatId)
      + this.blockToX[trackId][blockId][voiceId];
  }

  hideMarkersExcept(pageId: number) {
    for (let i = 0; i < this.numPages; i += 1) {
      const markerGroup = document.getElementById(`markerGroup${i}`);
      if (markerGroup != null) {
        if (i === pageId) {
          markerGroup.style.display = 'block';
        } else {
          markerGroup.style.display = 'none';
        }
      }
    }
  }

  moveMarkerToPosition(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, pageId: number,
  ) {
    const mGroup = document.getElementById(`markerGroup${pageId}`);
    if (mGroup == null) return;
    this.hideMarkersExcept(pageId);
    const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
    let xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 5;
    if (xPos == null) return;
    // console.log(xPos);
    xPos += this.blockToX[trackId][blockId][voiceId];
    // console.log(xPos);
    let yPos = this.rowToY[trackId][voiceId][rowId];
    let yPosString = (Song.tracks[trackId].numStrings
      - 1 - string - 0.5) * this.heightPerString + 1;
    let staveBegin = 0;
    if (Settings.vexFlowIsActive) {
      staveBegin = classicalNotation.getYForStaveBegin(blockId);
      yPos += staveBegin;
      yPosString += this.VEXFLOW_HEIGHT - staveBegin;
    }
    (mGroup.childNodes[0] as HTMLElement).style.height = (
      this.getPositionMarkerHeight(trackId) - staveBegin
    ).toString();
    // console.log(trackId, blockId, voiceId, beatId);
    mGroup.setAttribute('transform', `translate(${xPos},${yPos})`);
    const eGroup = document.getElementById(`exactPosition${pageId}`);
    eGroup?.setAttribute('transform', `translate(0,${yPosString})`);
  }

  movePlayBackBarToPosInBlock(
    trackId: number, blockId: number, voiceId: number, posInBlock: number,
    timing: number,
  ) {
    const pageId = this.blockToPage[blockId];
    const leftOffset = Helper.getLeftOffset(blockId);
    let xPos = this.blockToX[trackId][blockId][voiceId] + leftOffset + 5;

    const timeQuotient = Song.measureMeta[blockId].numerator
      / Song.measureMeta[blockId].denominator;
    const posPercentage = posInBlock / (64 * timeQuotient);

    xPos += (tab.finalBlockWidths[trackId][voiceId][blockId] - leftOffset) * posPercentage;
    // console.log(xPos + " "+posPercentage);
    this.movePlayBackBarToXPos(trackId, blockId, voiceId, pageId, xPos, timing);
  }

  movePlayBackBarToBeat(
    trackId: number, blockId: number, voiceId: number, beatId: number, timing: number,
  ) {
    if (!this.trackCreated || blockId >= Song.measures[trackId].length) {
      return;
    }
    const pageId = this.blockToPage[blockId];
    // console.log(pageId, blockId);
    // const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
    let xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 5;
    xPos += this.blockToX[trackId][blockId][voiceId];

    console.log(`TO BEAT ${xPos}`);
    this.movePlayBackBarToXPos(trackId, blockId, voiceId, pageId, xPos, timing);
  }

  movePlayBackBarToXPos(
    trackId: number, blockId: number, voiceId: number, pageId: number,
    xPos: number, timing: number,
  ) {
    if (!AppManager.duringTrackCreation) {
      const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
      const mGroup = document.getElementById(`playBackBarGroup${pageId}`);
      if (mGroup == null) {
        console.log('Playback bar not yet drawn');
        return;
      }
      if (Settings.songPlaying && this.lastPlayBackBarPageId !== pageId) {
        this.hidePlayBackBars();
        mGroup.style.display = 'block';
        this.lastPlayBackBarPageId = pageId;
      }
      let yPos = this.rowToY[trackId][voiceId][rowId];
      let staveBegin = 0;
      if (Settings.vexFlowIsActive) {
        staveBegin = classicalNotation.getYForStaveBegin(blockId);
        yPos += staveBegin;
      }
      (mGroup.childNodes[0] as HTMLElement).style.height = (
        this.getPositionMarkerHeight(trackId) - staveBegin + 10
      ).toString();

      // console.log("R1 ", xPos, yPos, timing);
      mGroup.setAttribute('transform', `translate(${xPos},${yPos})`);
      // mGroup.style.transform = "translate("+xPos+","+yPos+") rotate(0.1deg)";
      // mGroup.style.transform = "translate("+xPos+","+yPos+")";
      mGroup.style.transitionDuration = `${timing}s`;
      mGroup.style.transitionTimingFunction = 'linear';
      this.triggerReflow = mGroup.offsetWidth; // trigger reflow
    }
  }

  // first movement should be terrible
  initPlayBackParameters() {
    this.jumpToNewPos = true;
    this.lastCurrentPos = 0;
    this.lastNextPos = 0;
    this.lastTime = 0;
    this.lastTransformTime = 0;
    this.lastPlayBackBarPageId = -1;
  }

  hasBeenJumped() {
    return this.jumpToNewPos;
  }

  setJumped() {
    this.jumpToNewPos = true;
  }

  movePlayBackBarToPosition(
    trackId: number, nextBlockId: number, voiceId: number, nextBeatId: number,
    timing: number, longerFactor: number, currentBlockId: number, currentBeatId: number,
  ) {
    console.log('Move', trackId, nextBlockId, voiceId, nextBeatId, timing, longerFactor, currentBlockId, currentBeatId);

    if (AppManager.duringTrackCreation) return;
    const pageId = this.blockToPage[currentBlockId];
    if (pageId == null) return;
    const currentTime = audioEngine.getCurrentTime();

    let currentPos = 0;
    if (this.jumpToNewPos) { // After end of row was reached
      currentPos = Helper.getBeatPosX(trackId, currentBlockId, voiceId, currentBeatId)
        + this.blockToX[trackId][currentBlockId][voiceId];
      this.jumpToNewPos = false;
    } else {
      currentPos = this.lastCurrentPos + (this.lastNextPos - this.lastCurrentPos)
        * (((currentTime - this.lastTime)) / this.lastTransformTime);
      // console.log("Set to beginning of block "+currentPos);
    }

    const mGroup = document.getElementById(`playBackBarGroup${pageId}`);
    if (this.lastPlayBackBarPageId !== pageId) {
      this.hidePlayBackBars();
      if (mGroup != null) {
        mGroup.style.display = 'block';
      } else {
        console.error('MGroup null!');
      }
      this.lastPlayBackBarPageId = pageId;
    }

    const { rowId } = tab.blockToRow[trackId][voiceId][currentBlockId];
    let nextRowId = -1;
    let nextXPos = 0;
    if (nextBlockId < Song.measures[trackId].length) {
      nextRowId = tab.blockToRow[trackId][voiceId][nextBlockId].rowId;
      nextXPos = Helper.getBeatPosX(trackId, nextBlockId, voiceId, nextBeatId)
        + this.blockToX[trackId][nextBlockId][voiceId];
    }

    // SPECIAL CASE: next block is in another row OR
    // next beat is not following directly after the current
    if (rowId !== nextRowId || ((currentBlockId === nextBlockId)
      && (nextBeatId !== currentBeatId + 1))
      || ((currentBlockId !== nextBlockId)
      && (nextBeatId !== 0 || currentBlockId + 1 !== nextBlockId))) {
      // THEN: move to currentPos + noteDuration width
      nextXPos = Helper.getBeatPosX(trackId, currentBlockId, voiceId, currentBeatId)
        + this.blockToX[trackId][currentBlockId][voiceId];
      nextXPos += tab.measureOffset[trackId][currentBlockId][voiceId]
        * Duration.getDurationWidth(Song.measures[trackId][currentBlockId][voiceId][currentBeatId]);
      this.jumpToNewPos = true;
    }

    // console.log(currentPos, nextXPos);
    const transformedNextXPos = currentPos + (nextXPos - currentPos) * longerFactor;
    // Special case end of row reached -> go to the end of the row
    const transformedTiming = (timing * longerFactor) / 1000;
    this.movePlayBackBarToXPos(trackId, currentBlockId, voiceId,
      pageId, transformedNextXPos, transformedTiming);

    this.lastTime = currentTime;
    this.lastCurrentPos = currentPos;
    this.lastNextPos = transformedNextXPos;
    this.lastTransformTime = transformedTiming;
  }

  getBlockPosition(
    e: MouseEvent, trackId: number, voiceId: number, pageId: number,
  ) {
    // get xPos and yPos of svg - can be determined only once
    const dim = this.svgPagesPlayBackBar[trackId][voiceId][pageId].getBoundingClientRect();
    const xInSvg = ((e.clientX - dim.left) * 1) / Settings.currentZoom;
    const yInSvg = ((e.clientY - dim.top) * 1) / Settings.currentZoom;
    const LEGIT_SPACE_ABOVE_BLOCK = (20 * 1) / Settings.currentZoom;

    // find row
    const startRow = this.rowsPerPage[trackId][voiceId][pageId].rowStart;
    const endRow = this.rowsPerPage[trackId][voiceId][pageId].rowEnd;
    let rowId = 0;
    let yInBlock = 0;

    for (let row = startRow; row <= endRow; row += 1) {
      if (row === endRow || yInSvg < this.rowToY[trackId][voiceId][row] - LEGIT_SPACE_ABOVE_BLOCK) {
        rowId = Math.max(0, row - 1);
        yInBlock = yInSvg - this.rowToY[trackId][voiceId][rowId];
        break;
      }
    }
    if (Settings.vexFlowIsActive) {
      yInBlock -= this.VEXFLOW_HEIGHT;
    }
    yInBlock = Math.max(0, yInBlock);
    // find block
    let blockId = 0;
    let xInBlock = 0;
    const startBlock = tab.blocksPerRow[trackId][voiceId][rowId].start;
    const endBlock = tab.blocksPerRow[trackId][voiceId][rowId].end;
    for (let bId = startBlock; bId <= endBlock; bId += 1) {
      if (bId === endBlock || xInSvg < this.blockToX[trackId][bId][voiceId]) {
        blockId = Math.max(0, bId - 1);
        xInBlock = xInSvg - this.blockToX[trackId][blockId][voiceId];
        break;
      }
    }
    // console.log(xInBlock+" "+yInBlock);
    // xInBlock -= Helper.getLeftOffset(blockId)-5;
    // xInBlock = Math.max(0, xInBlock);
    const beatId = this.findBeatId(Song.currentTrackId, blockId, voiceId, xInBlock);
    const { numStrings } = Song.tracks[trackId];
    let string = numStrings - 1 - Math.round(yInBlock / this.heightPerString);
    // console.log(numStrings, string, yInBlock);
    string = Math.min(Math.max(0, string), numStrings - 1);

    return {
      blockId, beatId, string, relativeX: xInSvg,
    };
  }

  findBeatId(trackId: number, blockId: number, voiceId: number, xInBlock: number) {
    let smallestDistance = 9999999999;
    let nearestIndex = 0;
    for (let i = 0, n = Song.measures[trackId][blockId][voiceId].length; i < n; i += 1) {
      const distance = Math.abs(xInBlock - (Helper.getBeatPosX(trackId, blockId, voiceId, i)
        + this.DISTANCE_TO_BEAT_MIDDLE));
      // console.log(i, distance, xInBlock,  Helper.getBeatPosX(trackId, blockId, voiceId, i));
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nearestIndex = i;
      }
    }
    return nearestIndex;
  }

  moveOnArea(e: MouseEvent, pageId: number) {
    const trackId = Song.currentTrackId;
    const voiceId = Song.currentVoiceId;
    if (AppManager.duringTrackCreation) return;
    e.preventDefault();

    const blockPosition = this.getBlockPosition(e, trackId, voiceId, pageId);
    if (AppManager.stillMouseDown && (this.startClickPos.blockId !== blockPosition.blockId
        || this.startClickPos.beatId !== blockPosition.beatId
        || Math.abs(blockPosition.relativeX - this.startClickPos.relativeX) > 10)) {
      AppManager.loopIntervalChanged = true;
      const blockPositionRoundedDown = this.getBlockPosition(e, trackId, voiceId, pageId);
      overlayHandler.selectionMove(e, trackId, blockPositionRoundedDown.blockId, voiceId,
        blockPositionRoundedDown.beatId);
    } else {
      this.moveMarkerToPosition(trackId, blockPosition.blockId, voiceId,
        blockPosition.beatId, blockPosition.string, pageId);
    }
  }

  setNewClickedPos(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    if (AppManager.duringTrackCreation) return;
    const pageId = this.blockToPage[blockId];
    this.moveMarkerToPosition(trackId, blockId, voiceId, beatId, string, pageId);
    this.markClickedPos(trackId, blockId, voiceId, beatId, string, pageId);
    EventBus.emit("menu.clickedOnPos", {trackId, blockId, voiceId, beatId, string})
    playBackLogic.setPlayPosition(trackId, blockId, voiceId, beatId);
  }

  clickOnArea(e: MouseEvent, pageId: number) {
    if (AppManager.duringTrackCreation) return;
    e.preventDefault();
    const trackId = Song.currentTrackId;
    const voiceId = Song.currentVoiceId;
    AppManager.stillMouseDown = true;
    const blockPosition = this.getBlockPosition(e, trackId, voiceId, pageId);
    this.startClickPos = {
      blockId: blockPosition.blockId,
      beatId: blockPosition.beatId,
      relativeX: blockPosition.relativeX,
    };
    overlayHandler.initOverlay(trackId, blockPosition.blockId, voiceId, blockPosition.beatId);
    this.setNewClickedPos(trackId, blockPosition.blockId, voiceId, blockPosition.beatId,
      blockPosition.string);
  }

  getScrollTop() { return this.scrollTopMC; }

  setScrollTop(newTop: number) { this.scrollTopMC = newTop; }

  scrollToSvgBlock(trackId: number, voiceId: number, blockId: number) {
    if (!AppManager.duringTrackCreation) {
      const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
      this.scrollToSvgPos(rowId, blockId);
    }
  }

  scrollToSvgPos(rowId: number, blockId: number) {
    /** Scrolls the tab so that the indicated rowId and blockId are
     * at the top of the page (triggered when playing the song)
     */
    if (!AppManager.duringTrackCreation) {
      const pageId = this.blockToPage[blockId];
      const PAGE_POSITION = this.FIRST_PAGE_TOP_MARGIN
        + this.getYPosOfPage(pageId) * Settings.currentZoom;

      let TAB_GROUP_OFFSET = this.paddingTop;
      if (pageId === 0) {
        TAB_GROUP_OFFSET += this.tabInformationHeight;
        TAB_GROUP_OFFSET += this.getChordDiagramRowHeight(Song.currentTrackId);
      }
      TAB_GROUP_OFFSET *= Settings.currentZoom;

      const SCROLL_TOP_MARGIN = this.getOverBarHeight(Song.currentTrackId,
        Song.currentVoiceId, rowId) * Settings.currentZoom;

      const newScrollPos = PAGE_POSITION + TAB_GROUP_OFFSET
        + this.rowToY[Song.currentTrackId][Song.currentVoiceId][rowId]
        * Settings.currentZoom - SCROLL_TOP_MARGIN;

      const mainContentDiv = document.getElementById('mainContent')!;
      Helper.scrollToPure(mainContentDiv, this.scrollTopMC, newScrollPos, 800);
      console.log('Scroll to', rowId, blockId, this.scrollTopMC, newScrollPos);
      this.scrollTopMC = newScrollPos;
    }
  }

  createTabInformationGroup(trackId: number) {
    const tabInformationGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tabInformationGroup.setAttribute('id', 'tabInformationGroup');
    tabInformationGroup.setAttribute('transform', `translate(${this.paddingLeft},${this.paddingTop})`);
    // play at the mid of the tab
    const xPos = this.tabGroupWidth / 2;
    const yPosTitle = 0; const yPosAuthor = 30; const yPosTuning = 60; const
      yPosCapo = 82;
    const title = SvgDrawer.createText(xPos, yPosTitle, Song.songDescription.title, '27px', '', 'Source Sans Pro');
    const author = SvgDrawer.createText(xPos, yPosAuthor, Song.songDescription.author, '20px', this.generalColor, 'Source Sans Pro');
    const tuning = SvgDrawer.createText(0, yPosTuning, 'Tuning: EADGBE', '16px', this.generalColor, 'Source Sans Pro');
    const capo = SvgDrawer.createText(0, yPosCapo, 'Capo: 0', '16px', this.generalColor, 'Source Sans Pro');
    const colorString = `rgb(${Song.tracks[trackId].color.red},${Song.tracks[trackId].color.green},${Song.tracks[trackId].color.blue})`;
    const trackTitle = SvgDrawer.createText(this.tabGroupWidth, yPosCapo, Song.tracks[trackId].name, '16px', colorString, 'Source Sans Pro');
    title.setAttribute('id', 'tabTitle');
    author.setAttribute('id', 'tabAuthor');
    tuning.setAttribute('id', 'tuningTitle');
    capo.setAttribute('id', 'capoTitle');
    trackTitle.setAttribute('id', 'trackTitle');
    title.setAttribute('text-anchor', 'middle');
    author.setAttribute('text-anchor', 'middle');
    trackTitle.setAttribute('text-anchor', 'end');
    trackTitle.addEventListener('click', () => { modalManager.getHandler(MODALS.INSTRUMENT_SETTINGS.id).openModal(); });
    capo.addEventListener('click', () => { modalManager.getHandler(MODALS.INSTRUMENT_SETTINGS.id).openModal(); });
    tuning.addEventListener('click', () => { modalManager.getHandler(MODALS.INSTRUMENT_SETTINGS.id).openModal(); });
    title.addEventListener('click', () => {
      modalManager.getHandler(MODALS.INFO.id).openModal();
    });
    author.addEventListener('click', () => {
      modalManager.getHandler(MODALS.INFO.id).openModal();
    });
    tabInformationGroup.appendChild(title);
    tabInformationGroup.appendChild(author);
    tabInformationGroup.appendChild(tuning);
    tabInformationGroup.appendChild(capo);
    tabInformationGroup.appendChild(trackTitle);
    return tabInformationGroup;
  }

  getChordDiagramRowHeight(trackId: number) {
    return this.getNumChordDiagramRows(trackId) * 120 - 20;
  }

  getNumChordsPerRow() {
    return Math.floor((this.tabGroupWidth - 200) / (this.DIA_WIDTH + this.DIA_SPACING));
  }

  static getNumChords(trackId: number) {
    let numChords = 0;
    for (const chord of Song.chordsMap[trackId].values()) {
      if (chord.display) {
        numChords += 1;
      }
    }
    return numChords;
  }

  getNumChordDiagramRows(trackId: number) {
    const numChords = SvgDrawer.getNumChords(trackId);
    const numChordsPerRow = this.getNumChordsPerRow();
    return Math.ceil(numChords / numChordsPerRow);
  }

  createChordInformationGroup(trackId: number) {
    const chordInformationGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chordInformationGroup.setAttribute('id', 'chordInformationGroup');
    chordInformationGroup.setAttribute('transform', `translate(${this.paddingLeft},${this.paddingTop + this.tabInformationHeight})`);
    this.drawChordDiagrams(trackId, chordInformationGroup);
    return chordInformationGroup;
  }

  redrawChordDiagrams() {
    let trackRerendered = false;
    if (this.NUM_CHORD_DIAGRAM_ROWS === this.getNumChordDiagramRows(Song.currentTrackId)) {
      const cGroup = document.getElementById('chordInformationGroup')!;
      Helper.removeAllChildren(cGroup);
      this.drawChordDiagrams(Song.currentTrackId, cGroup as unknown as SVGGElement);
    } else {
      tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
      trackRerendered = true;
    }
    return trackRerendered;
  }

  drawChordDiagrams(trackId: number, chordInformationGroup: SVGGElement) {
    let chordCounter = 0;
    let chordId = 0;
    let chordRowNum = 0;
    let numChords = SvgDrawer.getNumChords(trackId);
    const numChordsPerRow = this.getNumChordsPerRow();
    this.NUM_CHORD_DIAGRAM_ROWS = Math.ceil(numChords / numChordsPerRow);

    // for (const chord in Song.chordsMap[trackId]) {
    if (Song.chordsMap[trackId] != null) {
      for (const chord of Song.chordsMap[trackId].values()) {
        if (chord.display) {
          const NUM_IN_ROW = Math.min(numChords, numChordsPerRow);
          const rowWidth = this.DIA_WIDTH * NUM_IN_ROW + this.DIA_SPACING * (NUM_IN_ROW - 1);
          const chordDia = this.createChordDiagram(chord);
          chordDia.setAttribute('id', `chord${chordId}`);
          chordDia.setAttribute('class', 'chordDiagram');
          const xPos = this.tabGroupWidth / 2 - rowWidth / 2
            + chordCounter * (this.DIA_WIDTH + this.DIA_SPACING);
          const yPos = chordRowNum * (this.DIA_HEIGHT + 40);
          chordDia.setAttribute('transform', `translate(${xPos},${yPos})`);
          chordDia.addEventListener('click', () => { (modalManager.getHandler(MODALS.CHORD_MANAGER.id) as ChordManagerModalHandler).openModal({trackId: Song.currentTrackId}); });
          chordInformationGroup.appendChild(chordDia);
          chordCounter += 1;
          chordId += 1;
          if (chordCounter >= numChordsPerRow) {
            numChords -= numChordsPerRow;
            chordCounter = 0;
            chordRowNum += 1;
          }
        }
      }
    }
    return chordInformationGroup;
  }

  createChordDiagram({ frets, capo, name }: {frets: number[], capo: number, name: string}) {
    const chordDiagram = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const rect = SvgDrawer.createRect(0, 0, this.DIA_WIDTH, this.DIA_HEIGHT, '#111', '1', 'white');
    chordDiagram.appendChild(rect);
    // draw thicker top line
    const pathEl = SvgDrawer.createPath(`M-0.5 0H${this.DIA_WIDTH + 0.5}`, 'rgb(0, 0, 0)', '3', 'none');
    chordDiagram.appendChild(pathEl);
    // Draw 5 frets
    const HOSTEPS = 5;
    for (let i = 1; i < HOSTEPS; i += 1) {
      // const yPos = (this.DIA_WIDTH / HOSTEPS) * (i + 1) + this.paddingLeft;
      const fretPath = SvgDrawer.createPath(`M0 ${(i * this.DIA_HEIGHT) / HOSTEPS}H${this.DIA_WIDTH}`, 'rgb(180, 180, 180)', '1', 'none');
      fretPath.setAttribute('class', 'gridLine');
      chordDiagram.appendChild(fretPath);
    }
    // draw strings
    const NUMSTRINGS = 6;
    for (let i = 0; i < NUMSTRINGS; i += 1) {
      const stringPath = SvgDrawer.createPath(`M${(i * this.DIA_WIDTH) / (NUMSTRINGS - 1)} 1.5V${this.DIA_HEIGHT - 0.5}`, 'rgb(60, 60, 60)', '1', 'none');
      stringPath.setAttribute('class', 'strongGridLine');
      chordDiagram.appendChild(stringPath);
    }

    const capoText = capo > 1 ? capo - 1 : capo;
    const capoNum = SvgDrawer.createText(-14, 10, capoText.toString(), '12px', '', 'Source Sans Pro');
    chordDiagram.appendChild(capoNum);

    if (capo > 1) {
      const drawnCapo = SvgDrawer.createRect(-3, 5, this.DIA_WIDTH + 6, 5, '#000', '0', '#000');
      drawnCapo.setAttribute('rx', '3');
      drawnCapo.setAttribute('ry', '3');
      chordDiagram.appendChild(drawnCapo);
    }

    const chordName = SvgDrawer.createText(this.DIA_WIDTH / 2, -18, name, '14px', '', 'Source Sans Pro');
    chordName.setAttribute('text-anchor', 'middle');
    chordDiagram.appendChild(chordName);

    for (let i = 0; i < NUMSTRINGS; i += 1) {
      const xPos = (i * this.DIA_WIDTH) / (NUMSTRINGS - 1);
      if (frets[5 - i] === -1) {
        const cross = SvgDrawer.createPath(`M${xPos - 3} -13L${xPos + 3} -5M${xPos + 3} -13L${xPos - 3} -5`, '#333', '1', 'none');
        cross.setAttribute('class', 'chordCross');
        chordDiagram.appendChild(cross);
      } else if (frets[5 - i] - (capo - 1) !== 0) {
        const fret = capo > 1 ? frets[5 - i] - capo + 1 : frets[5 - i] - capo;
        const yPos = this.DIA_HEIGHT / (2 * HOSTEPS) + this.DIA_HEIGHT / (HOSTEPS * fret);
        console.log(xPos, yPos);
        const circle = SvgDrawer.createCircle(xPos, yPos, 4, 'none', '1', 'black');
        chordDiagram.appendChild(circle);
      } else {
        const circle = SvgDrawer.createCircle(xPos, -9, 4, '#333333', '1', 'white');
        chordDiagram.appendChild(circle);
      }
    }

    return chordDiagram;
  }

  getNumOfPages() { return this.numPages; }

  getSvgPage(trackId: number, voiceId: number, pageId: number) {
    return this.svgPagesCompleteTrack[trackId][voiceId][pageId].inner;
  }

  getRowWidth() {
    return this.tabGroupWidth;
  }

  createPagePromise(
    resolve: (value?: void | PromiseLike<void>) => void,
    reject: (reason?: any) => void,
    trackId: number, voiceId: number, i: number,
  ) {
    this.createPage(trackId, voiceId, i).then(() => {
      this.drawPositionMarker(trackId, voiceId, i);
      this.drawClickMarker(trackId, voiceId, i);
      this.drawPlayBackBar(trackId, voiceId, i);
      this.moveMarkerToPosition(0, 0, 0, 0, 0, i);
      // const svgTestArea = document.getElementById("svgTestArea");
      // svgTestArea.appendChild( svgPagesCompleteTrack[trackId][voiceId][i].capsule );
      // svgTestArea.appendChild( svgPagesPlayBackBar[trackId][voiceId][i] );
      resolve();
    });
  }

  async createTrack(
    trackId: number, voiceId: number, width: number, height: number,
    callback: (() => void) | null,
  ) {
    console.log('SVGDRAWER: Create track called');
    this.usedNotes.clear();
    this.paddingLeft = this.PAGE_MARGIN_SIDE;// width * (1/21);
    this.paddingTop = this.PAGE_MARGIN_TOP;// height * (1/29.7);
    this.tabGroupWidth = width - 2 * this.paddingLeft;
    this.pageHeight = height;
    this.pageWidth = width;

    this.initHelperArrays(trackId, voiceId);
    this.computeYPositionOfRows(trackId, voiceId);
    this.trackCreated = true;

    this.playBackBarObjects.length = 0;

    // Now render pages
    const svgTestArea = document.getElementById('svgTestArea')!;
    Helper.removeAllChildren(svgTestArea);
    const promises = [];
    const pagePositions = [];
    for (let i = 0; i < this.numPages; i += 1) {
      this.createBasicPage(trackId, voiceId, i);
      svgTestArea.appendChild(this.svgPagesCompleteTrack[trackId][voiceId][i].capsule);
      svgTestArea.appendChild(this.svgPagesPlayBackBar[trackId][voiceId][i]);
      console.log('Page ', i, this.getYPosOfPage(i));
      pagePositions[i] = this.getYPosOfPage(i);
    }
    const scrollTop = document.getElementById('mainContent')!.scrollTop / Settings.currentZoom;
    console.log('Scrolltop', document.getElementById('mainContent')!.scrollTop);
    // get page that should be done first
    let pageRenderedFirst = -1;
    for (let i = 0; i < this.numPages; i += 1) {
      if (pagePositions[i] > scrollTop) break;
      pageRenderedFirst += 1;
    }
    promises.push(new Promise((resolve, reject) => {
      setTimeout(() => {
        this.createPagePromise(resolve, reject, trackId, voiceId, pageRenderedFirst);
      }, 0);
    }));
    if (pageRenderedFirst + 1 < this.numPages) {
      promises.push(new Promise((resolve, reject) => {
        setTimeout(() => {
          this.createPagePromise(resolve, reject, trackId, voiceId, pageRenderedFirst + 1);
        }, 0);
      }));
    }
    for (let i = 0; i < this.numPages; i += 1) {
      if (i !== pageRenderedFirst && i !== pageRenderedFirst + 1) {
        promises.push(new Promise((resolve, reject) => {
          setTimeout(() => { this.createPagePromise(resolve, reject, trackId, voiceId, i); }, 0);
        }));
      }
    }
    Promise.all(promises).then(() => {
      // Now add in rows
      /* const svgTestArea = document.getElementById("svgTestArea");
            Helper.removeAllChildren(svgTestArea);
            for(var pageId = 0; pageId < this.numPages; pageId++){
                svgTestArea.appendChild( svgPagesCompleteTrack[trackId][voiceId][pageId].capsule );
                svgTestArea.appendChild( svgPagesPlayBackBar[trackId][voiceId][pageId] );
            } */
      AppManager.duringTrackCreation = false;
      (document.getElementById('classicalToggleButton') as HTMLButtonElement).disabled = false;
      // console.log("ALL PROMISES FINISHED");
      this.setNewClickedPos(tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
        tab.markedNoteObj.voiceId, tab.markedNoteObj.beatId, tab.markedNoteObj.string);
      overlayHandler.redrawOverlays();
      AppManager.setTrackInfo();
      AppManager.setTrackInstrument(trackId);
      AppManager.setCapo(Song.tracks[trackId].capo);
      // Now adapt yPositions if vexFlow is too high
      this.adaptYPosOfRows(trackId, voiceId);

      this.lastPlayBackBarPageId = -1;
      const blockId = playBackLogic.getCurrentBlock();
      const absoluteTime = playBackLogic.getAbsoluteTime();
      const timeQuotient = Song.measureMeta[blockId].numerator
        / Song.measureMeta[blockId].denominator;
      const posInBlock = absoluteTime * (64 * timeQuotient);
      this.movePlayBackBarToPosInBlock(trackId, blockId, voiceId, posInBlock, 0);

      if (callback != null && tab.drawTrackCall == null) {
        callback();
      }
      if (tab.drawTrackCall != null) {
        console.log('WORKING!!!');
        const info = tab.drawTrackCall;
        tab.drawTrackCall = null;
        tab.drawTrack(info[0], info[1], info[2], info[3]);
      }
      if (!Settings.pageMode) {
        this.resetPageHeight();
      }
      if (Settings.songPlaying) {
        this.scrollToSvgBlock(trackId, voiceId, blockId);
      }
      console.log('Everything finished!');
    });
  }

  adaptYPosOfRows(trackId: number, voiceId: number) {
    const BLOCK_HEIGHT = this.getBlockHeight(trackId);
    for (let rowId = 0; rowId < this.numRows; rowId += 1) {
      let maxHeight = -1;
      const rowStart = tab.blocksPerRow[trackId][voiceId][rowId].start;
      const rowEnd = tab.blocksPerRow[trackId][voiceId][rowId].end;
      for (let blockId = rowStart; blockId < rowEnd; blockId += 1) {
        maxHeight = Math.max(maxHeight, tab.computeHeightOfBlock(trackId, blockId, voiceId));
      }
      this.heightOfRow[trackId][voiceId][rowId] = maxHeight + BLOCK_HEIGHT;
    }
    const currentPagePerRow = [];
    for (let pageId = 0; pageId < this.numPages; pageId += 1) {
      for (let j = this.rowsPerPage[trackId][voiceId][pageId].rowStart;
        j < this.rowsPerPage[trackId][voiceId][pageId].rowEnd; j += 1) {
        currentPagePerRow[j] = pageId;
      }
    }
    const numPagesBefore = this.numPages;
    this.computeYPositionOfRows(trackId, voiceId);
    // reset blockToPage
    for (let pageId = 0; pageId < this.numPages; pageId += 1) {
      for (let rowId = this.rowsPerPage[trackId][voiceId][pageId].rowStart;
        rowId < this.rowsPerPage[trackId][voiceId][pageId].rowEnd; rowId += 1) {
        for (let blockId = tab.blocksPerRow[trackId][voiceId][rowId].start;
          blockId < tab.blocksPerRow[trackId][voiceId][rowId].end; blockId += 1) {
          this.blockToPage[blockId] = pageId;
        }
      }
    }

    for (let pageId = 0; pageId < Math.min(numPagesBefore, this.numPages); pageId += 1) {
      const firstRow = this.rowsPerPage[trackId][voiceId][pageId].rowStart;
      const lastRow = this.rowsPerPage[trackId][voiceId][pageId].rowEnd;
      for (let rowId = firstRow; rowId < lastRow; rowId += 1) {
        let rowYPos = this.rowToY[trackId][voiceId][rowId];
        // const rowHeight = this.heightOfRow[trackId][voiceId][rowId];
        if (Settings.vexFlowIsActive) {
          rowYPos += this.VEXFLOW_HEIGHT;
        }
        if (currentPagePerRow[rowId] !== pageId) {
          // Move row to new page
          const actualTabGroup = this.svgPagesCompleteTrack[trackId][voiceId][pageId].inner.querySelector('#actualTabGroup');
          if (actualTabGroup != null) {
            actualTabGroup.appendChild(this.svgRows[rowId]);
            actualTabGroup.appendChild(this.vexFlowRows[rowId]);
          }
          // TODO create new page if necessary, remove page if necessary
        }
        // console.log("CREATE ROW", rowId, rowXPos, rowYPos, pageId);
        this.svgRows[rowId].setAttribute('transform', `translate(${0},${rowYPos})`);

        if (Settings.vexFlowIsActive && classicalNotation.getMarginTop(rowId) > 0) {
          for (let blockId = tab.blocksPerRow[trackId][voiceId][rowId].start;
            blockId < tab.blocksPerRow[trackId][voiceId][rowId].end; blockId += 1) {
            const overBarGroupDom = this.svgBlocks[trackId][blockId][voiceId].overBarGroup;
            if (overBarGroupDom != null) {
              overBarGroupDom.setAttribute(
                'transform', `translate(${0},${-classicalNotation.getMarginTop(rowId)})`,
              );
            }
          }
        }

        if (Settings.vexFlowIsActive) {
          rowYPos -= this.VEXFLOW_HEIGHT;
          this.vexFlowRows[rowId].setAttribute('transform', `translate(${0},${rowYPos})`);
        }
      }
    }
    let numPagesChanged = false;
    if (numPagesBefore < this.numPages) {
      console.log('NUM PAGES INCREASED');
      const lastPageId = this.numPages - 1;
      const firstRow = this.rowsPerPage[trackId][voiceId][lastPageId].rowStart;
      const lastRow = this.rowsPerPage[trackId][voiceId][lastPageId].rowEnd;
      for (let i = firstRow; i < lastRow; i += 1) {
        // only the last row can reach the next page (but it works so as well)
        const svgRowParentNode = this.svgRows[i].parentNode;
        if (svgRowParentNode != null) {
          svgRowParentNode.removeChild(this.svgRows[i]);
        }
        const vexFlowRowsParentNode = this.vexFlowRows[i].parentNode;
        if (vexFlowRowsParentNode != null) {
          vexFlowRowsParentNode.removeChild(this.vexFlowRows[i]);
        }
      }
      for (let pageId = 0; pageId < numPagesBefore; pageId += 1) {
        const pageNumberDom = document.getElementById(`pageNumber${pageId}`);
        if (pageNumberDom != null) {
          pageNumberDom.textContent = `${pageId + 1}/${this.numPages}`;
        }
      }

      this.createBasicPage(trackId, voiceId, lastPageId);
      this.createPage(trackId, voiceId, lastPageId).then(() => {
        // console.log("INNER PROMISE WORKS " +i);
        this.drawPositionMarker(trackId, voiceId, lastPageId);
        this.drawClickMarker(trackId, voiceId, lastPageId);
        this.drawPlayBackBar(trackId, voiceId, lastPageId);
        this.setNewClickedPos(tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
          tab.markedNoteObj.voiceId, tab.markedNoteObj.beatId, tab.markedNoteObj.string);
        document.getElementById('svgTestArea')!.appendChild(this.svgPagesCompleteTrack[trackId][voiceId][lastPageId].capsule);
        document.getElementById('svgTestArea')!.appendChild(this.svgPagesPlayBackBar[trackId][voiceId][lastPageId]);
        overlayHandler.redrawOverlays();
      });
      numPagesChanged = true;
    } else if (numPagesBefore > this.numPages) {
      const lastPageId = numPagesBefore - 1;
      this.setNewClickedPos(tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
        tab.markedNoteObj.voiceId, tab.markedNoteObj.beatId, tab.markedNoteObj.string);
      // delete last page
      document.getElementById('svgTestArea')!.removeChild(this.svgPagesCompleteTrack[trackId][voiceId][lastPageId].capsule);
      document.getElementById('svgTestArea')!.removeChild(this.svgPagesPlayBackBar[trackId][voiceId][lastPageId]);
    } else {
      this.setNewClickedPos(tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
        tab.markedNoteObj.voiceId, tab.markedNoteObj.beatId, tab.markedNoteObj.string);
    }
    overlayHandler.redrawOverlays();
    this.moveMarkerToPosition(tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
      tab.markedNoteObj.voiceId, tab.markedNoteObj.beatId, tab.markedNoteObj.string,
      this.blockToPage[tab.markedNoteObj.blockId]);

    return numPagesChanged;
  }

  computeYPositionOfRows(trackId: number, voiceId: number) {
    this.rowsPerPage[trackId][voiceId] = [];
    const tabGroupHeight = this.pageHeight - 2 * this.paddingTop;
    let pageId = 0;
    let availableSpaceInPage = tabGroupHeight - this.tabInformationHeight
        - this.getChordDiagramRowHeight(trackId) - this.FOOTER_HEIGHT; // on first page
    let firstRowOnPage = 0;

    // compute which rows to place on which page
    this.rowToY[trackId][voiceId] = [];
    for (let rowId = 0; rowId < this.numRows; rowId += 1) {
      let rowHeight = this.heightOfRow[trackId][voiceId][rowId];
      // console.log(rowId, classicalNotation.getMarginTop(rowId));
      if (Settings.vexFlowIsActive) {
        rowHeight += classicalNotation.getMarginTop(rowId) + this.VEXFLOW_HEIGHT;
      }
      if (!Settings.pageMode || availableSpaceInPage - rowHeight > 0) {
        availableSpaceInPage -= rowHeight;
      } else {
        // page finished
        // var restSpacePerRow = availableSpaceInPage / (Math.max(1,rowId-firstRowOnPage));
        let rowYPos = 0;
        for (let i = firstRowOnPage; i < rowId; i = 1) {
          let cHeight = this.heightOfRow[trackId][voiceId][i];
          if (Settings.vexFlowIsActive) {
            cHeight += classicalNotation.getMarginTop(i) + this.VEXFLOW_HEIGHT;
          }

          this.rowToY[trackId][voiceId][i] = rowYPos + this.getOverBarHeight(trackId, voiceId, i)
            + classicalNotation.getMarginTop(i);
          rowYPos += cHeight;
          // rowYPos += restSpacePerRow;
        }
        this.rowsPerPage[trackId][voiceId][pageId] = { rowStart: firstRowOnPage, rowEnd: rowId };
        firstRowOnPage = rowId;
        availableSpaceInPage = tabGroupHeight - rowHeight;
        pageId += 1;
      }
    }
    // draw last row, when it is on new page
    let rowYPos = 0;
    for (let rowId = firstRowOnPage; rowId < this.numRows; rowId += 1) {
      let cHeight = this.heightOfRow[trackId][voiceId][rowId];
      if (Settings.vexFlowIsActive) {
        cHeight += classicalNotation.getMarginTop(rowId) + this.VEXFLOW_HEIGHT;
      }
      this.rowToY[trackId][voiceId][rowId] = rowYPos
        + this.getOverBarHeight(trackId, voiceId, rowId)
        + classicalNotation.getMarginTop(rowId);
      rowYPos += cHeight;
      // rowYPos += restSpacePerRow;
    }
    this.rowsPerPage[trackId][voiceId][pageId] = { rowStart: firstRowOnPage, rowEnd: this.numRows };
    pageId += 1;
    // console.log(rowToY);
    this.numPages = pageId;
  }

  getBlockHeight(trackId: number) {
    const BOTTOM_BEAM_BAR_HEIGHT = 50;
    return BOTTOM_BEAM_BAR_HEIGHT + this.heightPerString * Song.tracks[trackId].numStrings;
  }

  getOverBarHeight(trackId: number, voiceId: number, rowId: number) {
    return this.heightOfRow[trackId][voiceId][rowId] - this.getBlockHeight(trackId);
  }

  getYPosOfPage(pageId: number) {
    return ((this.pageHeight + this.distanceBetweenPages) * pageId);
  }

  createBasicPage(trackId: number, voiceId: number, pageId: number) {
    const completeTrack = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const playBackBarSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    completeTrack.setAttribute('width', `${this.pageWidth}px`);
    playBackBarSvg.setAttribute('width', `${this.pageWidth - this.paddingLeft}px`);
    playBackBarSvg.setAttribute('id', 'playBackBarSvg');
    completeTrack.setAttribute('id', `mainSvg${pageId}`);
    completeTrack.setAttribute('class', 'svgPage');
    this.svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    completeTrack.appendChild(this.svgDefs);
    if (pageId === 0) {
      completeTrack.appendChild(this.createTabInformationGroup(trackId));
      completeTrack.appendChild(this.createChordInformationGroup(trackId));
    }

    playBackBarSvg.style.top = `${this.getYPosOfPage(pageId)}px`;

    completeTrack.setAttribute('height', `${this.pageHeight}px`);
    playBackBarSvg.setAttribute('height', `${this.pageHeight}px`);
    // TODO necessary to remove old event listeners +  page as parameter
    completeTrack.addEventListener('mousemove', (e) => { this.moveOnArea(e, pageId); });
    completeTrack.addEventListener('mousedown', (e) => { this.clickOnArea(e, pageId); });

    const completeTrackCapsule = document.createElement('div');
    completeTrackCapsule.setAttribute('class', 'svgTrackWrapper');
    completeTrackCapsule.style.top = `${this.getYPosOfPage(pageId)}px`;
    completeTrackCapsule.style.width = `${this.pageWidth}px`;
    completeTrackCapsule.style.height = `${this.pageHeight}px`;
    completeTrackCapsule.appendChild(completeTrack);

    this.svgPagesCompleteTrack[trackId][voiceId][pageId] = {
      inner: completeTrack,
      capsule: completeTrackCapsule,
    };
    this.svgPagesPlayBackBar[trackId][voiceId][pageId] = playBackBarSvg;

    // document.getElementById("svgTestArea").appendChild(completeTrackCapsule);
    // document.getElementById("svgTestArea").appendChild(playBackBarSvg);
  }

  createPage(trackId: number, voiceId: number, pageId: number) {
    // createBasicPage(trackId, voiceId, pageId);
    const actualTabGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    actualTabGroup.setAttribute('id', 'actualTabGroup');
    let startYPos = this.paddingTop;
    if (pageId === 0) {
      startYPos += this.tabInformationHeight;
      startYPos += this.getChordDiagramRowHeight(trackId);
    }
    actualTabGroup.setAttribute('transform', `translate(${this.paddingLeft},${startYPos})`);
    this.svgPagesPlayBackBar[trackId][voiceId][pageId].setAttribute('transform', `translate(${this.paddingLeft},${startYPos})`);
    this.svgPagesCompleteTrack[trackId][voiceId][pageId].inner.appendChild(actualTabGroup);

    const rowXPos = 0;
    const firstRow = this.rowsPerPage[trackId][voiceId][pageId].rowStart;
    const lastRow = this.rowsPerPage[trackId][voiceId][pageId].rowEnd;

    this.createFooter(trackId, voiceId, pageId);
    // create rows
    this.vexFlowRows.length = 0;
    this.svgRows.length = 0;
    const promises: Promise<void>[] = [];
    console.log('Create Page', this.rowsPerPage[trackId][voiceId][pageId], firstRow, lastRow);
    for (let rowId = firstRow; rowId < lastRow; rowId += 1) {
      promises.push(new Promise((resolve) => {
        setTimeout(() => {
          let rowYPos = this.rowToY[trackId][voiceId][rowId];
          const rowHeight = this.heightOfRow[trackId][voiceId][rowId];
          if (Settings.vexFlowIsActive) {
            rowYPos += this.VEXFLOW_HEIGHT;
          }
          // console.log("CREATE ROW", rowId, rowXPos, rowYPos, pageId);
          this.createRow(trackId, voiceId, rowId, rowXPos, rowYPos,
            this.tabGroupWidth, rowHeight, actualTabGroup, pageId);
          if (Settings.vexFlowIsActive) {
            rowYPos -= this.VEXFLOW_HEIGHT;
            const vexFlowRow = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            // var vexFlowRow = document.createElement("canvas");
            vexFlowRow.setAttribute('id', `vexFlowRow${rowId}`);
            vexFlowRow.setAttribute('class', 'vexFlowRow');
            /* vexFlowRow.setAttribute("width", "1000px");
                        vexFlowRow.setAttribute("height", "200px");
                        vexFlowRow.style.top = "20px";
                        vexFlowRow.style.left = "20px"; */
            vexFlowRow.setAttribute('transform', `translate(${rowXPos},${rowYPos})`);
            actualTabGroup.appendChild(vexFlowRow);
            // document.getElementById("tabAreas").appendChild(vexFlowRow);
            this.vexFlowRows[rowId] = vexFlowRow;

            classicalNotation.drawVexFlowRow(
              trackId, voiceId, rowId, vexFlowRow as unknown as HTMLElement,
            );
          }
          resolve();
        }, 0);
      }));
    }

    return new Promise<void>((resolve) => {
      Promise.all(promises).then(() => {
        // console.log("ALL ROWS PROMISED");
        resolve();
      });
    });
  }

  rerenderRow(trackId: number, voiceId: number, rowId: number) {
    Helper.removeAllChildren(this.svgRows[rowId]);
    let startPosX = 0;
    const startPosY = 0;
    this.createStrings(trackId, voiceId, this.svgRows[rowId], rowId,
      startPosX, startPosY, this.tabGroupWidth);

    const blockStart = tab.blocksPerRow[trackId][voiceId][rowId].start;
    const blockEnd = tab.blocksPerRow[trackId][voiceId][rowId].end;
    for (let blockId = blockStart; blockId < blockEnd; blockId += 1) {
      if (blockId === 0) { // TABBLOCK
        startPosX = this.START_OFFSET_WIDTH;
        this.createTabString(this.svgRows[rowId], Song.tracks[trackId].numStrings);
      }
      const groupings = Helper.groupMeasureBeats(trackId, blockId, voiceId);
      this.createBlock(trackId, voiceId, blockId, this.svgRows[rowId], startPosX, startPosY);
      this.createNoteLengthRow(trackId, blockId, voiceId, groupings);
      this.renderOverBar(trackId, blockId, voiceId, true);
      this.blockToX[trackId][blockId][voiceId] = startPosX;
      startPosX += tab.finalBlockWidths[trackId][voiceId][blockId];
    }
  }

  createFooter(trackId: number, voiceId: number, pageId: number) {
    const startY = this.pageHeight - this.paddingTop - this.FOOTER_HEIGHT;
    const startX = this.pageWidth - this.paddingLeft;
    const pageNumber = `${pageId + 1}/${this.numPages}`;
    const pNum = SvgDrawer.createText(startX, startY, pageNumber, '13px', this.generalColor, 'Source Sans Pro');
    pNum.setAttribute('id', `pageNumber${pageId}`);
    pNum.setAttribute('text-anchor', 'right');
    this.svgPagesCompleteTrack[trackId][voiceId][pageId].inner.appendChild(pNum);
  }

  createRow(
    trackId: number, voiceId: number, rowId: number, xPos: number, yPos: number,
    width: number, height: number, actualTabGroup: SVGGElement, pageId: number,
  ) {
    const row = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    row.setAttribute('id', `row${rowId}`);
    row.setAttribute('transform', `translate(${xPos},${yPos})`);
    actualTabGroup.appendChild(row);
    this.svgRows[rowId] = row;

    let startPosX = 0;
    const startPosY = 0;
    this.createStrings(trackId, voiceId, row, rowId, startPosX, startPosY, width);

    const blockStart = tab.blocksPerRow[trackId][voiceId][rowId].start;
    const blockEnd = tab.blocksPerRow[trackId][voiceId][rowId].end;
    console.log('Create Row: ', blockStart, blockEnd);
    for (let blockId = blockStart; blockId < blockEnd; blockId += 1) {
      if (blockId === 0) { // TABBLOCK
        startPosX = this.START_OFFSET_WIDTH;
        this.createTabString(row, Song.tracks[trackId].numStrings);
      }
      const groupings = Helper.groupMeasureBeats(trackId, blockId, voiceId);
      this.createBlock(trackId, voiceId, blockId, row, startPosX, startPosY);
      this.createNoteLengthRow(trackId, blockId, voiceId, groupings);
      this.renderOverBar(trackId, blockId, voiceId, true);

      this.blockToPage[blockId] = pageId;
      this.blockToX[trackId][blockId][voiceId] = startPosX;
      startPosX += tab.finalBlockWidths[trackId][voiceId][blockId];
    }
  }

  static createRect(
    x: number, y: number, width: number, height: number, stroke: string,
    strokeWidth: string, fill: string,
  ) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x.toString());
    rect.setAttribute('y', y.toString());
    rect.style.width = width.toString();
    rect.style.height = height.toString();
    rect.style.stroke = stroke;
    rect.style.strokeWidth = strokeWidth;
    rect.style.fill = fill;
    return rect;
  }

  static createText(x: number, y: number, text: string, fontSize: string, fill: string, fontFamily = 'Source Sans Pro') {
    const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElem.setAttribute('x', x.toString());
    textElem.setAttribute('y', y.toString());
    textElem.textContent = text;
    textElem.style.fontSize = fontSize;
    textElem.style.fill = fill;
    textElem.setAttribute('font-family', fontFamily);
    return textElem;
  }

  static createPath(path: string, stroke: string, strokeWidth: string, fill: string) {
    const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElem.setAttribute('d', path);
    pathElem.setAttribute('stroke', stroke);
    pathElem.setAttribute('stroke-width', strokeWidth);
    pathElem.setAttribute('fill', fill);
    return pathElem;
  }

  static createCircle(
    cx: number, cy: number, radius: number, stroke: string, strokeWidth: string,
    fill: string,
  ) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx.toString());
    circle.setAttribute('cy', cy.toString());
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('stroke', stroke);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('fill', fill);
    return circle;
  }

  createTabString(row: SVGGElement, numStrings: number) {
    const midHeight = (numStrings * this.heightPerString) / 2 - this.heightPerString;
    const tabLabel = SvgDrawer.createText(15, midHeight - this.heightPerString, 'T', '16px', this.generalColor, 'Source Sans Pro');
    tabLabel.setAttribute('dominant-baseline', 'hanging');
    const tabLabel1 = SvgDrawer.createText(15, midHeight, 'A', '16px', this.generalColor, 'Source Sans Pro');
    tabLabel1.setAttribute('dominant-baseline', 'hanging');
    const tabLabel2 = SvgDrawer.createText(15, midHeight + this.heightPerString, 'B', '16px', this.generalColor, 'Source Sans Pro');
    tabLabel2.setAttribute('dominant-baseline', 'hanging');
    row.appendChild(tabLabel);
    row.appendChild(tabLabel1);
    row.appendChild(tabLabel2);
  }

  setDurationsOfBlock(trackId: number, blockId: number, voiceId: number) {
    // TODO better blocking if not created
    if (this.svgBlocks[trackId] == null || this.svgBlocks[trackId][blockId] == null
      || this.svgBlocks[trackId][blockId][voiceId] == null) {
      return;
    }
    const blockDurationGroup = this.svgBlocks[trackId][blockId][voiceId].durationGroup;
    if (blockDurationGroup != null) {
      Helper.removeAllChildren(blockDurationGroup);
      const groupings = Helper.groupMeasureBeats(trackId, blockId, voiceId);
      this.createNoteLengthRow(trackId, blockId, voiceId, groupings);
    }
  }

  disablePageMode() {
    this.recomputeWidth();
    if (this.lastWidth !== this.completeWidth) {
      this.lastWidth = this.completeWidth;
      Settings.pageMode = false;
    } else {
      Settings.pageMode = !Settings.pageMode;
    }
    if (!Settings.pageMode) {
      document.getElementById('completeTab')!.style.width = `${this.completeWidth}px`;
      document.getElementById('svgTestArea')!.style.transform = 'none';
      document.getElementById('svgTestArea')!.classList.add('svgMainFullscreen');
      // document.getElementById("mainContent").style.background = "white";
    } else {
      document.getElementById('completeTab')!.style.width = '31.5cm';
      this.completeWidth = 31.5 * 37.795276;
      document.getElementById('svgTestArea')!.style.transform = 'none';
      document.getElementById('svgTestArea')!.classList.remove('svgMainFullscreen');
      // document.getElementById("mainContent").style.background = "#f5f5f5";
    }

    tab.drawTrackMain(Song.currentTrackId, Song.currentVoiceId, true,
      this.completeWidth, this.completeHeight, () => {});
  }

  recomputeWidth() {
    this.completeWidth = document.getElementById('mainContent')!.clientWidth;// offsetWidth;
    console.log(this.completeWidth);
    Settings.currentZoom = 1.0;
  }

  resetPageHeight() {
    const TAB_INFO_HEIGHT = 111;
    let cHeight = this.heightOfRow[Song.currentTrackId][Song.currentVoiceId][this.numRows - 1];
    if (Settings.vexFlowIsActive) {
      cHeight += classicalNotation.getMarginTop(this.numRows - 1) + this.VEXFLOW_HEIGHT;
    }
    // height of last row + height of other rows + margins on top and bottom + infobar
    cHeight += this.rowToY[Song.currentTrackId][Song.currentVoiceId][this.numRows - 1]
      + 2 * this.PAGE_MARGIN_TOP + TAB_INFO_HEIGHT;

    console.log(this.rowToY, cHeight,
      this.rowToY[Song.currentTrackId][Song.currentVoiceId][this.numRows - 1],
      2 * this.PAGE_MARGIN_TOP, TAB_INFO_HEIGHT);
    document.getElementById('mainSvg0')!.setAttribute('height', `${this.completeHeight}px`);
    document.getElementById('playBackBarSvg')!.setAttribute('height', `${this.completeHeight}px`);

    const pageNumPos = this.completeHeight - this.paddingTop - this.FOOTER_HEIGHT;
    document.getElementById('pageNumber0')!.setAttribute('y', pageNumPos.toString());
  }

  createBlock(
    trackId: number, voiceId: number, blockId: number, row: SVGGElement,
    startPosX: number, startPosY: number,
  ) {
    const block = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    block.setAttribute('id', `block${trackId}_${blockId}_${voiceId}`);
    block.setAttribute('transform', `translate(${startPosX},${startPosY})`);
    // create block number
    const blockNumber = SvgDrawer.createText(0, -5, blockId.toString(), '', '', 'Source Sans Pro');
    blockNumber.setAttribute('class', 'blockNumber');
    block.appendChild(blockNumber);

    // set group for notes
    const notesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    notesGroup.setAttribute('id', `blockNoteGroup${trackId}_${blockId}_${voiceId}`);
    block.appendChild(notesGroup);
    // set group for note lengths
    const durationGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    durationGroup.setAttribute('id', `blockDurationGroup${trackId}_${blockId}_${voiceId}`);
    block.appendChild(durationGroup);
    // set group for note effects
    const effectGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    effectGroup.setAttribute('id', `effectGroup${trackId}_${blockId}_${voiceId}`);
    block.appendChild(effectGroup);
    // set group for effects that are overbar (potentially over the classical notation)
    const overBarGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overBarGroup.setAttribute('id', `overBarGroup${trackId}_${blockId}_${voiceId}`);
    block.appendChild(overBarGroup);

    this.svgBlocks[trackId][blockId][voiceId] = {
      block, notesGroup, durationGroup, effectGroup, overBarGroup,
    };

    const n = Song.measures[trackId][blockId][voiceId].length;
    for (let beatId = 0; beatId < n; beatId += 1) {
      this.createBeat(trackId, voiceId, block, blockId, beatId);
    }
    row.appendChild(block);
  }

  createBeat(trackId: number, voiceId: number, row: SVGGElement, blockId: number, beatId: number) {
    const { numStrings } = Song.tracks[trackId];
    for (let string = 0; string < numStrings; string += 1) {
      const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
      if (note != null) {
        note.noteDrawn = this.createNote(trackId, blockId, voiceId, beatId, string, note);
      }
    }
  }

  createNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, note: Note,
  ) {
    if (!note.tied && this.svgBlocks[trackId][blockId][voiceId] != null) {
      let yPos = (Song.tracks[trackId].numStrings - 1 - string) * this.heightPerString + 6;
      let xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId)
        + this.DISTANCE_TO_BEAT_MIDDLE / 2;
      // console.log(xPos);
      let noteString = `${note.fret}`;
      if (note.dead) {
        noteString = 'x';
      }
      if (note.ghost) {
        noteString = `(${noteString})`;
      }
      // if(usedNotes[noteString] == null){
      const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textNode.setAttribute('class', 'svgNote');
      if (noteString.length > 3) {
        textNode.style.fontSize = '12px';
        yPos -= 3;
      } else if (noteString.length > 1 || note.ghost) {
        textNode.style.fontSize = '14px';
        yPos -= 2;
        xPos -= 2;
      }
      textNode.textContent = noteString;
      textNode.setAttribute('id', noteString);
      // svgDefs.appendChild(textNode);
      this.usedNotes.set(noteString, textNode);
      /* }
            const drawnNote = document.createElementNS("http://www.w3.org/2000/svg", "use");
            drawnNote.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#'+noteString); */
      textNode.setAttribute('x', xPos.toString());
      textNode.setAttribute('y', yPos.toString());

      this.svgBlocks[trackId][blockId][voiceId].notesGroup?.appendChild(textNode);
      return textNode;
    }
    return null;
  }

  markCurrentNotes(currentNote: (Note | null)[]) {
    this.unmarkCurrentNotes();
    for (const note of currentNote) {
      if (note != null && note.noteDrawn != null) {
        note.noteDrawn.style.fill = '#df1f1f';
        this.lastNotes.push(note.noteDrawn);
      }
    }
  }

  unmarkCurrentNotes() {
    for (const noteDrawn of this.lastNotes) {
      noteDrawn.style.fill = 'black';
    }
    this.lastNotes.length = 0;
  }

  createStrings(
    trackId: number, voiceId: number, row: SVGGElement, rowId: number,
    startPosX: number, startPosY: number, width: number,
  ) {
    // var strings = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const { numStrings } = Song.tracks[trackId];
    // create strings
    let svgPath = '';
    for (let i = 0; i < numStrings; i += 1) {
      const yPos = startPosY + i * this.heightPerString;
      svgPath += `M ${startPosX},${yPos} H${width} `;
    }
    const strings = SvgDrawer.createPath(svgPath, '#cccccc', '1', 'none');

    // start and end lines
    const height = startPosY + this.heightPerString * (numStrings - 1);
    let limiterPath = `M ${width - 1},${startPosY} V${height} `;
    let xPos = 0;
    const blockStart = tab.blocksPerRow[trackId][voiceId][rowId].start;
    const blockEnd = tab.blocksPerRow[trackId][voiceId][rowId].end;
    for (let blockId = blockStart; blockId < blockEnd; blockId += 1) {
      limiterPath += `M ${xPos},${startPosY} V${height} `;
      xPos += tab.finalBlockWidths[trackId][voiceId][blockId];
      if (blockId === 0) {
        xPos += this.START_OFFSET_WIDTH;
      }
    }
    const limiter = SvgDrawer.createPath(limiterPath, '#333333', '1', 'none');
    row.appendChild(strings);
    row.appendChild(limiter);
  }

  createNoteLengthRow(trackId: number, blockId: number, voiceId: number, groupings: Measure[][]) {
    let beatId = 0;
    for (let i = 0; i < groupings.length; i += 1) {
      this.buildBeam(trackId, blockId, voiceId, beatId, groupings[i]);
      beatId += groupings[i].length;
    }
  }

  buildBeam(
    trackId: number, blockId: number, voiceId: number, beatStartPos: number,
    groupNotes: Measure[],
  ) {
    let currentX = Helper.getBeatPosX(trackId, blockId, voiceId, beatStartPos)
      + this.DISTANCE_TO_BEAT_MIDDLE;
    const startX = currentX;
    const { numStrings } = Song.tracks[trackId];
    const startY = this.heightPerString * numStrings + 11;
    const offsetBetweenNotes = tab.measureOffset[trackId][blockId][voiceId];

    if (groupNotes.length === 1) {
      this.drawSingleNoteLength(trackId, blockId, voiceId, groupNotes[0], currentX, startY);
    } else {
      for (let k = 0; k < groupNotes.length - 1; k += 1) {
        const durationSize = Duration.getDurationOfType(groupNotes[k].duration);
        const durationSizeNext = Duration.getDurationOfType(groupNotes[k + 1].duration);
        const durationWidth = Duration.getDurationWidth(groupNotes[k])
          * offsetBetweenNotes;
        const dotted = [groupNotes[k].dotted, groupNotes[k + 1].dotted
          && k + 1 === groupNotes.length - 1];
        const doubleDotted = [groupNotes[k].doubleDotted, groupNotes[k + 1].doubleDotted
          && k + 1 === groupNotes.length - 1];
        // DOTTED TOO (and do not differ between rests and normal notes)
        if (groupNotes[k + 1].duration.charAt(0) === groupNotes[k].duration.charAt(0)) {
          this.createSeam(trackId, blockId, voiceId, currentX, durationWidth,
            [durationSize, durationSize], dotted, doubleDotted, groupNotes, startY, k);
        } else if (durationSize > durationSizeNext) {
          // check if next one is last one
          if (k + 2 >= groupNotes.length) {
            this.createSeam(trackId, blockId, voiceId, currentX, durationWidth,
              [durationSize, durationSizeNext], dotted, doubleDotted, groupNotes, startY, k);
          } else {
            this.createSeam(trackId, blockId, voiceId, currentX, durationWidth,
              [durationSize, durationSize], dotted, doubleDotted, groupNotes, startY, k);
          }
        } else if (durationSize < durationSizeNext) {
          // check if shorter note was connected before
          if (k === 0 || groupNotes[k].duration.charAt(0)
            !== groupNotes[k - 1].duration.charAt(0)) {
            this.createSeam(trackId, blockId, voiceId, currentX, durationWidth,
              [durationSize, durationSizeNext], dotted, doubleDotted, groupNotes, startY, k);
          } else {
            this.createSeam(trackId, blockId, voiceId, currentX, durationWidth,
              [durationSizeNext, durationSizeNext], dotted, doubleDotted, groupNotes, startY, k);
          }
        }
        currentX += durationWidth;
      }
      if (groupNotes[0].tuplet != null) {
        this.drawTupletOutline(trackId, blockId, voiceId, startX, currentX, groupNotes[0].tuplet);
      }
    }
  }

  drawTupletOutline(
    trackId: number, blockId: number, voiceId: number, startX: number, endX: number,
    tupletNumber: number,
  ) {
    const xPos = (endX - startX) / 2 + startX;
    const yPos = this.heightPerString * Song.tracks[trackId].numStrings + 29;
    const tupletText = SvgDrawer.createText(xPos, yPos + 4, tupletNumber.toString(), '15px', this.generalColor, 'Source Sans Pro');
    tupletText.setAttribute('text-anchor', 'middle');

    const tupletOutline = `M${startX - 5} ${yPos - 5}V${yPos}H${xPos - 6}M${xPos + 6} ${yPos}H${endX + 5}V${yPos - 5}`;
    const tupletPath = SvgDrawer.createPath(tupletOutline, this.generalColor, '1.3', 'none');
    const { durationGroup } = this.svgBlocks[trackId][blockId][voiceId];
    if (durationGroup != null) {
      durationGroup.appendChild(tupletPath);
      durationGroup.appendChild(tupletText);
    }
  }

  createDot(
    trackId: number, blockId: number, voiceId: number, xPos: number, type: string,
    parent: SVGGElement,
  ) {
    const yPos = this.heightPerString * Song.tracks[trackId].numStrings + 3;
    let x = xPos;
    if (type.length === 1) x += 3;
    const circle = SvgDrawer.createCircle(x, yPos, 2, this.generalColor, '0', this.generalColor);
    parent.appendChild(circle);
  }

  drawSingleNoteLength(
    trackId: number, blockId: number, voiceId: number, note: Measure, xPos: number,
    yPos: number,
  ) {
    if (this.svgBlocks[trackId] == null || this.svgBlocks[trackId][blockId] == null) {
      return;
    }
    const { duration } = note;
    const { durationGroup } = this.svgBlocks[trackId][blockId][voiceId];
    if (durationGroup != null) {
      let fontSize = '20px';
      if (this.durationToRest[duration] >= 'i') {
        fontSize = '30px';
      }
      let rest;
      let x = xPos;
      let y = yPos;
      if (duration.length === 2) {
        x += 2;
        const durationToYPadding: {[a: string]: number} = {
          er: -15, sr: -8, tr: 0, zr: 8, qr: -5, hr: -7, wr: -10,
        };
        y += durationToYPadding[duration] + 2;
        rest = SvgDrawer.createText(
          x, y, this.durationToRest[duration], fontSize, this.generalColor, 'notesFont',
        );
      } else {
        x += 3;
        y += 12;
        rest = SvgDrawer.createText(
          x, y, this.durationToRest[duration], fontSize, this.generalColor, 'musicFont',
        );
      }

      rest.setAttribute('y', yPos.toString());
      rest.setAttribute('text-anchor', 'middle');
      rest.style.textAlign = 'right';
      durationGroup.appendChild(rest);

      if (note.dotted) {
        this.createDot(trackId, blockId, voiceId, xPos + 7, duration, durationGroup);
      }
      if (note.doubleDotted) {
        this.createDot(trackId, blockId, voiceId, xPos + 7, duration, durationGroup);
        this.createDot(trackId, blockId, voiceId, xPos + 13, duration, durationGroup);
      }
    }
  }

  static lengthToUnit(le: number) {
    return Math.round(Math.log2(Duration.getDurationOfType('e')) - Math.log2(le));
  }

  createSeam(
    trackId: number, blockId: number, voiceId: number, x: number, width: number,
    typeParam: [a: number, b: number], dotStyle: boolean[], doubleDotStyle: boolean[],
    groupNotes: Measure[], startY: number, groupId: number,
  ) {
    const type = typeParam;
    let xPos = x;
    if (this.svgBlocks[trackId][blockId][voiceId] == null) {
      return;
    }
    // const { tuplet } = groupNotes[0];
    const { durationGroup } = this.svgBlocks[trackId][blockId][voiceId];
    if (durationGroup != null) {
      const { numStrings } = Song.tracks[trackId];
      const yPos = this.heightPerString * numStrings - 7;

      // only for testing
      const seamGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      seamGroup.setAttribute('transform', `translate(${xPos}, ${yPos})`);

      const widthOfBeam = width;
      const heightOfBeam = 20;

      // draw no path for notes too long
      if (type[0] < Duration.getDurationOfType('q')) {
        const pathString = `M0 0L0 ${heightOfBeam}L${widthOfBeam} ${heightOfBeam}L${widthOfBeam} 0`;
        const seam = SvgDrawer.createPath(pathString, this.generalColor, '1', 'none');
        seam.setAttribute('id', `seamDiv${this.seamCounter}`);
        this.seamCounter += 1;
        seamGroup.appendChild(seam);

        // eigth stamp
        type[0] = SvgDrawer.lengthToUnit(type[0]) + 1;
        type[1] = SvgDrawer.lengthToUnit(type[1]) + 1;
        // TODO 32th and so on in for-loop
        for (let j = 0; j < Math.min(type[0], type[1]); j += 1) {
          const middlePath = SvgDrawer.drawMiddleBeam(0, heightOfBeam - 6 * j, widthOfBeam, 2);
          seamGroup.appendChild(SvgDrawer.createPath(middlePath, this.generalColor, '1', this.generalColor));
        }
        // draw right half beams
        for (let j = Math.min(type[0], type[1]); j < type[0]; j += 1) {
          const middlePath = SvgDrawer.drawMiddleBeam(0, heightOfBeam - 6 * j, widthOfBeam / 2, 2);
          seamGroup.appendChild(SvgDrawer.createPath(middlePath, this.generalColor, '1', this.generalColor));
        }
        // draw left half beams
        for (let j = Math.min(type[0], type[1]); j < type[1]; j += 1) {
          const middlePath = SvgDrawer.drawMiddleBeam(0 + widthOfBeam / 2,
            heightOfBeam - 6 * j, widthOfBeam / 2, 2);
          seamGroup.appendChild(SvgDrawer.createPath(middlePath, this.generalColor, '1', this.generalColor));
        }

        xPos += 9;
        if (dotStyle[0] || doubleDotStyle[0]) {
          const circle = SvgDrawer.createCircle(6, 6, 2, this.generalColor, '0', this.generalColor);
          seamGroup.appendChild(circle);
        }
        if (dotStyle[1] || doubleDotStyle[1]) {
          const circle = SvgDrawer.createCircle(widthOfBeam - 6, 6, 2, this.generalColor, '0', this.generalColor);
          seamGroup.appendChild(circle);
        }
        if (doubleDotStyle[0]) {
          const circle = SvgDrawer.createCircle(12, 6, 2, this.generalColor, '0', this.generalColor);
          seamGroup.appendChild(circle);
        }
        if (doubleDotStyle[1]) {
          const circle = SvgDrawer.createCircle(widthOfBeam - 12, 6, 2, this.generalColor, '0', this.generalColor);
          seamGroup.appendChild(circle);
        }
        durationGroup.appendChild(seamGroup);
      } else {
        this.drawSingleNoteLength(trackId, blockId, voiceId, groupNotes[groupId], xPos, startY);
        // draw last note in same fashion
        if (groupNotes.length === groupId + 2) {
          this.drawSingleNoteLength(trackId, blockId, voiceId, groupNotes[groupId + 1],
            xPos + widthOfBeam, startY);
        }
      }
    }
  }

  static drawMiddleBeam(beginX: number, beginY: number, width: number, height: number) {
    return `M${beginX} ${beginY}L${beginX + width} ${beginY}L${beginX + width} ${beginY + height}L${beginX} ${beginY + height}`;
  }

  drawNoteEffects(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteIn: Note,
  ) {
    const note = noteIn;
    if (note.tremoloPicking) {
      this.drawTremoloPicking(trackId, blockId, voiceId, beatId, note.tremoloPickingLength);
    }
    if (note.gracePresent && note.graceObj != null) {
      this.drawGrace(trackId, blockId, voiceId, beatId, string, note.graceObj);
    }
    if (note.slide) {
      this.drawSlide(trackId, blockId, voiceId, beatId, string);
    }
    if (note.pullDown) {
      this.drawBowBeat(trackId, blockId, voiceId, beatId, beatId + 1, string, 'top');
    }
    if (note.bendPresent && note.bendObj != null) {
      this.drawBend(trackId, blockId, voiceId, beatId, string, note.bendObj);
    }
    if (note.noteDrawn != null) {
      Helper.deleteDOMObject(note.noteDrawn);
    }
    note.noteDrawn = this.createNote(trackId, blockId, voiceId, beatId, string, note);
    if (note.tied) {
      // draw bow
      if (beatId > 0) {
        this.drawBowBeat(trackId, blockId, voiceId, beatId - 1, beatId, string, 'bottom');
      } else if (blockId > 0) {
        // draw bow in last block
        // const noteLast = Song.measures[trackId][blockId - 1][voiceId].length - 1;
        // draw only second bow (blocks should be able to be redrawn indepedently)
        this.drawBowBeat(trackId, blockId, voiceId, -1, 0, string, 'bottom');
      }
    }
    if ((note.tied || note.tieBegin)
      && beatId === Song.measures[trackId][blockId][voiceId].length - 1) {
      // console.log("OUTER", trackId, blockId, voiceId, beatId);
      // check of next note is tied
      if (blockId + 1 < Song.measures[trackId].length
        && Song.measures[trackId][blockId + 1][voiceId][0].notes[string] != null
        && Song.measures[trackId][blockId + 1][voiceId][0].notes[string]!.tied) {
        // console.log("INNER", trackId, blockId, voiceId, beatId);
        // first bow to the end of the bar
        this.drawBowBeat(trackId, blockId, voiceId, beatId, -1, string, 'bottom');
      }
    }
  }

  drawBowBeat(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    beatEnd: number, string: number, type: string,
  ) {
    // bow across blocks
    let width = 0;
    if (beatEnd === -1 || beatEnd >= Song.measures[trackId][blockId][voiceId].length) {
      // console.log("HERE3");
      // draw to the end of the block
      const startPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId);
      // THIS line executes a reflow and is evil
      if (tab.finalBlockWidths[trackId] != null
        && tab.finalBlockWidths[trackId][voiceId] != null) {
        // console.log(tab.finalBlockWidths[trackId][voiceId][blockId]);
        width = tab.finalBlockWidths[trackId][voiceId][blockId] - startPos - 12;
      } else {
        width = 10;
      }
    } else if (beatId === -1) {
      width = Helper.getBeatPosX(trackId, blockId, voiceId, beatEnd) + 10;
    } else {
      // console.log("HERE2");
      width = Helper.getBeatPosX(trackId, blockId, voiceId, beatEnd)
        - Helper.getBeatPosX(trackId, blockId, voiceId, beatId);
      if (width < 0) {
        // console.log("WUT");
        width = 0;
      }
    }
    if (Number.isNaN(width)) {
      // console.log(trackId, blockId, voiceId, beatId, beatEnd, string, type);
      // console.trace("No way");
      // console.log("No way");
      return;
    }
    this.drawBow(trackId, blockId, voiceId, beatId, string, width, type);
  }

  stringToY(trackId: number, string: number) {
    return this.heightPerString * (Song.tracks[trackId].numStrings - 1 - string);
  }

  drawBow(
    trackId: number, blockId: number, voiceId: number, beatIdIn: number,
    string: number, width: number, type: string,
  ) {
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (effectGroup != null) {
        let beatId = beatIdIn;
        const id = `bow_${blockId}_${string}_${beatId}`;

        let xPos = 0;
        if (beatId !== -1) {
          xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 12;
        }
        let yPos = this.stringToY(trackId, string);

        let bow;
        if (type === 'top') {
          yPos -= 10;
          bow = SvgDrawer.createPath(`M${xPos} ${yPos + 5}C${xPos} ${yPos}, ${width + xPos} ${yPos},${xPos + width} ${yPos + 5}`, '#111', '1', 'none');
        } else {
          yPos += 6;
          // console.log("M"+xPos+" "+yPos+"C"+xPos+" "+(yPos+5)+", "+(width+xPos)+" "+yPos);
          bow = SvgDrawer.createPath(`M${xPos} ${yPos}C${xPos} ${yPos + 5}, ${width + xPos} ${yPos + 5}, ${width + xPos} ${yPos}`, '#111', '1', 'none');
        }
        bow.setAttribute('id', id);
        // svg.style.width = width+"px";
        if (beatId === -1) {
          // TODO delete
          bow.setAttribute('x', (-width + 10).toString());
          beatId = 0;
        }
        effectGroup.appendChild(bow);
      }
    }
  }

  drawBend(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, bendObjs: Bend,
  ) {
    const startXPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 15;
    const bendYPos = this.stringToY(trackId, string);
    const startYPos = bendYPos - 40;
    // max width value = 60 60/3 = 20
    // const bendWidth = 20;
    const bendHeight = 43; // 300/7
    let svgPath = '';
    let xPos = 0;
    let yPos = 0;
    for (let i = 0; i < bendObjs.length; i += 1) {
      let { bendPosition } = bendObjs[i];
      if (bendPosition == null) {
        bendPosition = 0;
      }
      xPos = startXPos + bendPosition / 3;
      yPos = startYPos + bendHeight - bendObjs[i].bendValue / 7;
      if (i === 0) {
        svgPath += `M${xPos} ${yPos}`;
      } else {
        const lastY = startYPos + bendHeight - bendObjs[i - 1].bendValue / 7;
        if (lastY === yPos) {
          svgPath += `L${xPos} ${yPos}`;
        } else {
          svgPath += `Q${xPos} ${lastY} ${xPos} ${yPos}`;
        }
      }
    }
    const bend = SvgDrawer.createPath(svgPath, '#111', '1', 'none');

    // arrowhead
    let arrow = null;
    if (bendObjs.length > 1) {
      const secondLastY = bendHeight - bendObjs[bendObjs.length - 2].bendValue / 7;
      // console.log(yPos+" "+secondLastY);
      let arrowPath = `M${xPos} ${yPos}`;
      if (yPos > secondLastY) {
        // arrowhead shows north; place points in the south
        arrowPath += `L${xPos - 2} ${yPos - 3}`;
        arrowPath += `L${xPos + 2} ${yPos - 3}Z`;
      } else if (yPos < secondLastY) {
        // arrowhead shows south; place points in the north
        arrowPath += `L${xPos - 2} ${yPos + 3}`;
        arrowPath += `L${xPos + 2} ${yPos + 3}Z`;
      } else {
        // arrowhead shows east; place points in the west
        arrowPath = `M${xPos + 3} ${yPos}`;
        arrowPath += `L${xPos} ${yPos + 2}`;
        arrowPath += `L${xPos} ${yPos - 2}Z`;
      }
      arrow = SvgDrawer.createPath(arrowPath, '#111', '1', '#000');
    }

    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (effectGroup != null) {
        // console.log(svgBlocks[trackId][blockId][voiceId]);
        effectGroup.appendChild(bend);
        if (arrow != null) {
          effectGroup.appendChild(arrow);
        }
      }
    }
  }

  drawSlide(trackId: number, blockId: number, voiceId: number, beatId: number, string: number) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const firstNote = beat.notes;
    const noteLength = Duration.getDurationWidth(beat)
      * tab.measureOffset[trackId][blockId][voiceId] - 8;
    const left = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 14;
    const startXPos = left;
    const startYPos = this.stringToY(trackId, string);

    let drawnSlide;
    if (firstNote[string] == null) {
      console.error('First note is null!');
      return;
    }
    const thisFret = firstNote[string]!.fret;
    const nextNoteFret = Helper.findNextNote(trackId, blockId, voiceId, beatId, string);
    if (nextNoteFret == null) {
      // straight line
      drawnSlide = `M${startXPos + 1} ${startYPos + 4}L${1 + noteLength + startXPos} ${startYPos + 4}`;
    } else if (thisFret < nextNoteFret) {
      // line up
      drawnSlide = `M${startXPos + 1} ${startYPos + 6}L${1 + noteLength + startXPos} ${startYPos + 1}`;
    } else if (thisFret > nextNoteFret) {
      // line down
      drawnSlide = `M${startXPos + 1} ${startYPos + 1}L${1 + noteLength + startXPos} ${startYPos + 6}`;
    } else {
      // straight line
      drawnSlide = `M${startXPos + 1} ${startYPos + 4}L${1 + noteLength + startXPos} ${startYPos + 4}`;
    }
    const slide = SvgDrawer.createPath(drawnSlide, '#4f7cbb', '1', 'none');
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
      // console.log(svgBlocks[trackId][blockId][voiceId]);
      if (effectGroup != null) {
        effectGroup.appendChild(slide);
      }
    }
  }

  drawGrace(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, graceObj: Grace,
  ) {
    const xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId);
    const yPos = this.stringToY(trackId, string) + 8;
    const grace = SvgDrawer.createText(xPos, yPos, graceObj.fret.toString(), '11px', this.generalColor, 'Source Sans Pro');
    grace.setAttribute('text-anchor', 'middle');

    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      // console.log(svgBlocks[trackId][blockId][voiceId]);
      const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (effectGroup != null) {
        effectGroup.appendChild(grace);
      }
    }
  }

  drawTremoloPicking(
    trackId: number, blockId: number, voiceId: number, beatId: number, tremoloPickingLength: string,
  ) {
    const xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 6;
    const { numStrings } = Song.tracks[trackId];
    const yPos = this.heightPerString * numStrings + 3;

    if (this.svgBlocks[trackId][blockId][voiceId] == null) {
      return;
    }
    // NO DUPLICATES TODO
    const tremoloPickingGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tremoloPickingGroup.setAttribute('transform', `translate(${xPos},${yPos})`);
    tremoloPickingGroup.setAttribute('id', `tremoloPickingGroup${trackId}_${blockId}_${voiceId}_${beatId}`);
    const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
    if (effectGroup != null) {
      effectGroup.appendChild(tremoloPickingGroup);

      tremoloPickingGroup.appendChild(SvgDrawer.createPath('M2 4L12 2', '#111', '2', 'none'));
      if (tremoloPickingLength === 's' || tremoloPickingLength === 't') {
        tremoloPickingGroup.appendChild(SvgDrawer.createPath('M2 8L12 6', '#111', '2', 'none'));
      }
      if (tremoloPickingLength === 't') {
        tremoloPickingGroup.appendChild(SvgDrawer.createPath('M2 12L12 10', '#111', '2', 'none'));
      }
    }
  }

  rerenderBlocks(trackId: number, blocks: number[], voiceId: number) {
    let redrawAll = false;
    for (const blockId of blocks) {
      if (tab.trackRerenderNecessary(trackId, blockId, voiceId)) {
        redrawAll = true;
        break;
      }
    }
    if (redrawAll) {
      tab.drawTrack(trackId, voiceId, true, null);
    } else {
      for (const blockId of blocks) {
        this.rerenderRow(trackId, voiceId, tab.blockToRow[trackId][voiceId][blockId].rowId);
        if (Settings.vexFlowIsActive) {
          classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);
        }
        this.renderOverBar(trackId, blockId, voiceId, false);
      }
    }
  }

  rerenderBlock(trackId: number, blockId: number, voiceId: number) {
    if (tab.trackRerenderNecessary(trackId, blockId, voiceId)) {
      console.log('RERENDER SCALE ');
      tab.drawTrack(trackId, voiceId, true, null);
    } else {
      this.rerenderRow(trackId, voiceId, tab.blockToRow[trackId][voiceId][blockId].rowId);
      if (Settings.vexFlowIsActive) {
        classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);
      }
      this.renderOverBar(trackId, blockId, voiceId, false);
    }
  }

  renderOverBar(trackId: number, blockId: number, voiceId: number, doNotAdaptYPos: boolean) {
    if (!doNotAdaptYPos) {
      if (this.adaptYPosOfRows(trackId, voiceId)) {
        return true;
      }
    }

    Helper.removeAllChildren(this.svgBlocks[trackId][blockId][voiceId].effectGroup);
    Helper.removeAllChildren(this.svgBlocks[trackId][blockId][voiceId].overBarGroup);
    /* heightOfBlock[trackId][voiceId][blockId] = maxHeight;
        if(tab.markedNoteObj.trackId == trackId && tab.markedNoteObj.blockId == blockId
          && tab.markedNoteObj.voiceId == voiceId){
            overlayHandler.resetTrianglePointer(trackId, voiceId, blockId);
        }
        return maxHeight; */
    let startHeight = 20; // is used negatively - 10 from top of notebar is first effect
    if (Settings.vexFlowIsActive) {
      const { rowId } = tab.blockToRow[trackId][voiceId][blockId];
      startHeight = this.VEXFLOW_HEIGHT + classicalNotation.getMarginTop(rowId);
    }
    let maxHeight = startHeight
      + this.applyBeatAndNoteEffects(trackId, blockId, voiceId, startHeight);
    // draw bpmMeter
    if (Song.measureMeta[blockId].bpmPresent) {
      if (this.svgBlocks[trackId][blockId][voiceId] != null) {
        const group = this.createBpmMeter(trackId, blockId);
        group.addEventListener('click', () => { modalManager.getHandler(MODALS.TEMPO.id).openModal({ trackId, blockId, voiceId }); });
        const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
        if (effectGroup != null) {
          effectGroup.appendChild(group);
        }
      }
      if (!Settings.vexFlowIsActive) {
        // for effects aligned to the left: do not intersect with bpm info
        maxHeight = Math.max(startHeight + Settings.OVERBAR_ROW_HEIGHT, maxHeight);
      }
    }
    if (Song.measureMeta[blockId].repeatAlternativePresent
      && Song.measureMeta[blockId].repeatAlternative != null) {
      this.drawRepeatAlternative(trackId, blockId, voiceId, maxHeight);
      maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (Song.measureMeta[blockId].markerPresent && Song.measureMeta[blockId].marker != null) {
      this.createMarker(trackId, blockId, voiceId, maxHeight);
    }
    if (Song.measureMeta[blockId].repeatClosePresent) {
      this.drawRepeat(trackId, blockId, 'close');
    }
    if (Song.measureMeta[blockId].repeatOpen) {
      this.drawRepeat(trackId, blockId, 'open');
    }
    if (Song.measureMeta[blockId].timeMeterPresent) {
      this.createTimeMeter(trackId, blockId, voiceId);
    }
    return false;
  }

  drawRepeatAlternative(trackId: number, blockId: number, voiceId: number, maxHeight: number) {
    const number = Song.measureMeta[blockId].repeatAlternative;
    const yPos = -maxHeight;
    let xPos = 0;
    // Zerlege Nummern 256 0000000 = 8 Bit
    let numberString = '';
    for (let u = 0; u < 8; u += 1) {
      if (((number >> u) & 1) === 1) {
        if (numberString === '') numberString += (u + 1);
        else numberString += `, ${u + 1}`;
      }
    }
    const raHeight = 10;

    if (Song.measureMeta[blockId].bpmPresent) {
      xPos += 50;
    }
    const repeatAlternativeText = SvgDrawer.createText(xPos + 10, yPos, numberString, '10px', this.generalColor, 'Source Sans Pro');
    const width = tab.finalBlockWidths[trackId][voiceId][blockId];

    let pathString = `M${xPos} ${yPos}, V${yPos - raHeight}H${width}`;
    if (blockId > 0 && Song.measureMeta[blockId - 1].repeatAlternative === number) {
      pathString = `M${xPos} ${yPos - raHeight}H${width}`;
    }

    const repeatAlternativePath = SvgDrawer.createPath(pathString, this.generalColor, '1', 'none');
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (overBarGroup != null) {
        overBarGroup.appendChild(repeatAlternativeText);
        overBarGroup.appendChild(repeatAlternativePath);
      }
    }
  }

  createMarker(trackId: number, blockId: number, voiceId: number, height: number) {
    const { red, green, blue } = Song.measureMeta[blockId].marker.color;
    const colorString = `rgb(${red},${green},${blue})`;
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const marker = SvgDrawer.createText(0, -height, Song.measureMeta[blockId].marker.text, '14px', colorString, 'Source Sans Pro');
      const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (overBarGroup != null) {
        overBarGroup.appendChild(marker);
      }

      if (tinycolor(colorString).isLight()) {
        const bbox = marker.getBBox(); // TODO this is expensive
        const markerPath = `M${bbox.x - 1} ${bbox.y}V${bbox.y + bbox.height}H${bbox.x + bbox.width + 2}V${bbox.y}Z`;
        const markerBackground = SvgDrawer.createPath(markerPath, 'none', '0', 'rgba(10, 10, 10, 0.6)');
        if (overBarGroup != null) {
          overBarGroup.insertBefore(markerBackground, marker);
        }
      }
    }
  }

  drawRepeat(trackId: number, blockId: number, type: string) {
    const voiceId = Song.currentVoiceId;
    const height = (Song.tracks[trackId].numStrings - 1) * this.heightPerString;
    const blockWidth = tab.finalBlockWidths[trackId][voiceId][blockId];

    if (this.svgBlocks[trackId][blockId][voiceId] == null) return;
    const svgB = this.svgBlocks[trackId][blockId][voiceId].effectGroup;

    const yPos1 = height / 3;
    const yPos2 = (height / 3) * 2;

    const radius = 2.5;

    if (svgB != null) {
      if (type === 'open') {
        svgB.appendChild(SvgDrawer.createPath(`M2 0V${height}`, this.generalColor, '4', 'none'));
        svgB.appendChild(SvgDrawer.createPath(`M6 0V${height}`, this.generalColor, '1', 'none'));

        svgB.appendChild(SvgDrawer.createCircle(10, yPos1, radius, this.generalColor, '0', this.generalColor));
        svgB.appendChild(SvgDrawer.createCircle(10, yPos2, radius, this.generalColor, '0', this.generalColor));
      } else {
        svgB.appendChild(SvgDrawer.createPath(`M${blockWidth - 2} 0V${height}`, this.generalColor, '4', 'none'));
        svgB.appendChild(SvgDrawer.createPath(`M${blockWidth - 6} 0V${height}`, this.generalColor, '1', 'none'));

        svgB.appendChild(SvgDrawer.createCircle(blockWidth - 10, yPos1, radius, this.generalColor, '0', this.generalColor));
        svgB.appendChild(SvgDrawer.createCircle(blockWidth - 10, yPos2, radius, this.generalColor, '0', this.generalColor));

        // add number of repititions
        svgB.appendChild(SvgDrawer.createText(blockWidth - 12, -10, `x${Song.measureMeta[blockId].repeatClose}`, '10px', this.generalColor, 'Source Sans Pro'));
      }
    }
  }

  createTimeMeter(trackId: number, blockId: number, voiceId: number) {
    let xPos = 5;
    if (Song.measureMeta[blockId].repeatOpen) xPos += 17;
    const fontSize = '26px';
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const yPosDenomi = ((Song.tracks[trackId].numStrings - 1) * this.heightPerString * 2) / 3;
      const yPosNom = ((Song.tracks[trackId].numStrings - 1) * this.heightPerString) / 3;
      const numerator = SvgDrawer.createText(xPos, yPosNom, Song.measureMeta[blockId].numerator.toString(), fontSize, this.generalColor, 'notesFont');
      const denomi = SvgDrawer.createText(xPos, yPosDenomi, Song.measureMeta[blockId].denominator.toString(), fontSize, this.generalColor, 'notesFont');
      const { effectGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (effectGroup != null) {
        effectGroup.appendChild(numerator);
        effectGroup.appendChild(denomi);
      }
    }
  }

  static createImage(x: number, y: number, height: number, width: number, path: string) {
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttributeNS(null, 'height', height.toString());
    img.setAttributeNS(null, 'width', width.toString());
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', path);
    img.setAttributeNS(null, 'x', x.toString());
    img.setAttributeNS(null, 'y', y.toString());
    img.setAttributeNS(null, 'visibility', 'visible');
    return img;
  }

  createBpmMeter(trackId: number, blockId: number) {
    const xPos = 22;
    const yPos = -10;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'bpmMeter');
    const bpmNum = SvgDrawer.createPath('m 42.11001,-14.243169 c 3.23818,-1.690251 4.94183,-4.532498 4.93488,-7.025993 l -1.2e-4,-36.5862794 -1.698,'
            + '-4.03e-5 0.025,33.5966367 c 3e-5,0.05175 -0.006,0.106707 -0.0247,0.0939 -2.0256,-1.489897 -5.52413,-1.650647 -8.86091,-0.191149 -4.30619,1.883513'
            + '-6.72038,5.75579 -5.38883,8.64344 1.33155,2.88766 5.9071,3.702606 10.21329,1.819091 0.26913,-0.117718 0.54538,-0.217085 0.7993,-0.349611 z', 'none', '0', '#000');
    bpmNum.style.transform = 'scale(0.4)';
    const bpmText = SvgDrawer.createText(xPos, yPos, `= ${Song.measureMeta[blockId].bpm}`, '12px', this.generalColor, 'Source Sans Pro');
    group.appendChild(bpmNum);
    group.appendChild(bpmText);
    return group;
  }

  applyBeatAndNoteEffects(trackId: number, blockId: number, voiceId: number, startHeight: number) {
    // first apply all note effects
    const voiceBlock = Song.measures[trackId][blockId][voiceId];
    for (let beatId = 0, n = voiceBlock.length; beatId < n; beatId += 1) {
      for (let o = 0; o < Song.tracks[trackId].numStrings; o += 1) {
        if (voiceBlock[beatId].notes[o] != null) {
          this.drawNoteEffects(trackId, blockId, voiceId, beatId, o, voiceBlock[beatId].notes[o]!);
        }
      }
      this.applyOverBarNoteEffects(trackId, blockId, voiceId, beatId, startHeight);
    }
    let rowHeight = {
      numberOfOverbarRows: 0, textRowHeight: 0, dynamicRowHeight: 0, chordRowHeight: 0,
    };
    if (tab.blockToRow != null && tab.blockToRow[trackId] != null) {
      rowHeight = Helper.getNumberOfOverbarRows(trackId, voiceId,
        tab.blockToRow[trackId][voiceId][blockId].rowId);
      rowHeight.textRowHeight = rowHeight.textRowHeight * Settings.OVERBAR_ROW_HEIGHT + startHeight;
      rowHeight.dynamicRowHeight = rowHeight.dynamicRowHeight
        * Settings.OVERBAR_ROW_HEIGHT + startHeight;
      rowHeight.chordRowHeight = rowHeight.chordRowHeight
        * Settings.OVERBAR_ROW_HEIGHT + startHeight;
    }
    const rowCompleteOverbarHeight = rowHeight.numberOfOverbarRows * Settings.OVERBAR_ROW_HEIGHT;
    // then position beat effects over them
    for (let beatId = 0, n = voiceBlock.length; beatId < n; beatId += 1) {
      this.applyBeatEffects(trackId, blockId, voiceId, beatId, rowHeight);
    }

    return rowCompleteOverbarHeight;
  }

  applyBeatEffects(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    rowHeight: {textRowHeight: number, chordRowHeight: number, dynamicRowHeight: number},
  ) {
    const beatObj = Song.measures[trackId][blockId][voiceId][beatId];
    if (beatObj.textPresent && beatObj.text != null) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, beatObj.text, 'text', rowHeight.textRowHeight);
      // console.log("Text Length", textElem.getComputedTextLength());
    }
    if (beatObj.chordPresent && beatObj.chord != null) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, beatObj.chord.name, 'chord', rowHeight.chordRowHeight);
    }
    if (beatObj.dynamicPresent && beatObj.dynamic != null) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, beatObj.dynamic, 'dynamic', rowHeight.dynamicRowHeight);
    }

    const beatEffects = beatObj.effects;
    if (beatEffects != null) {
      if (beatEffects.strokePresent && beatEffects.stroke != null) {
        this.drawStroke(trackId, blockId, voiceId, beatId, beatEffects.stroke.strokeType);
      }
      if (beatEffects.tremoloBarPresent && beatEffects.tremoloBar != null) {
        this.drawTremoloBar(trackId, blockId, voiceId, beatId, beatEffects.tremoloBar,
          rowHeight.textRowHeight - Settings.OVERBAR_ROW_HEIGHT);
      }
    }
  }

  placeTextAboveBeat(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    text: string, type: string, heightParam: number | null,
  ) {
    const height = heightParam == null ? 0 : heightParam;
    if (this.svgBlocks[trackId][blockId][voiceId] == null) {
      return null;
    }

    let xPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 7;
    if (type === 'hammer') {
      // setting this later at left is slow
      xPos += (Helper.getBeatPosX(trackId, blockId, voiceId, beatId + 1)
        - Helper.getBeatPosX(trackId, blockId, voiceId, beatId)) / 2 - 2;
    }
    const yPos = -height;// -35-OVERBAR_ROW_HEIGHT*height;
    let fontSize = '16px';
    if (this.typeToFont[type] != null) {
      fontSize = this.typeToFont[type];
    }

    let textAbove = SvgDrawer.createText(xPos, yPos, text, fontSize, this.generalColor, 'Source Sans Pro');

    if (type === 'trill') {
      textAbove = SvgDrawer.createText(xPos, yPos, 'Ù', '26px', this.generalColor, 'notesFont');
    } else if (type === 'dynamic') {
      if (text === 'pp') {
        textAbove = SvgDrawer.createText(xPos, yPos, this.dynamicsToSymbol.p, '19px', this.generalColor, 'notesFont');
        const textAbove2 = SvgDrawer.createText(xPos + 10, yPos, this.dynamicsToSymbol.p, '19px', this.generalColor, 'notesFont');
        const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
        if (overBarGroup != null) {
          overBarGroup.appendChild(textAbove2);
        }
      } else {
        textAbove = SvgDrawer.createText(xPos, yPos, this.dynamicsToSymbol[text], '19px', this.generalColor, 'notesFont');
      }
    }
    const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
    if (overBarGroup != null) {
      overBarGroup.appendChild(textAbove);
    }
    return textAbove;
  }

  drawStroke(trackId: number, blockId: number, voiceId: number, beatId: number, type: string) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const { notes } = beat;
    let minY = 10;
    let maxY = -10;
    for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
      if (notes[i] != null && !notes[i]!.tied) {
        minY = Math.min(minY, i);
        maxY = Math.max(maxY, i);
      }
    }
    let noteStartY = this.stringToY(trackId, maxY);
    const noteEndY = this.stringToY(trackId, minY);
    // if(noteStartY == noteEndY)
    noteStartY -= 5;

    let left = -4;
    let hasGrace = false;
    if (beat.notes != null) {
      for (let i = 0, n = Song.tracks[trackId].numStrings; i < n; i += 1) {
        if (beat.notes[i] != null) {
          if (beat.notes[i]!.gracePresent) {
            hasGrace = true;
            break;
          }
        }
      }
    }
    if (hasGrace) {
      left = -10;
    }
    // const lineWidth = 2;
    // console.log(trackId, blockId, voiceId, beatId, noteStartY, noteEndY, minY, maxY);
    const xPos = left + Helper.getBeatPosX(trackId, blockId, voiceId, beatId);
    const yPos = noteStartY;
    // const padding = 2;
    const heightOfBeam = Math.abs(noteStartY - noteEndY) + 5;

    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const svg = this.svgBlocks[trackId][blockId][voiceId].effectGroup;
      if (svg != null) {
        if (type === 'up') {
          svg.appendChild(SvgDrawer.createPath(`M${xPos + 3} ${yPos}V${yPos + heightOfBeam}`, '#111', '1', 'none'));
          svg.appendChild(SvgDrawer.createPath(`M${xPos + 1} ${yPos + heightOfBeam - 5}L${xPos + 3} ${yPos + heightOfBeam} L${xPos + 5} ${yPos + heightOfBeam - 5}Z`, '#111', '1', '#111')); // triangle part
        } else {
          svg.appendChild(SvgDrawer.createPath(`M${xPos + 3} ${yPos + 7}V${yPos + heightOfBeam}`, '#111', '1', 'none'));
          svg.appendChild(SvgDrawer.createPath(`M${xPos + 1} ${yPos + 6}L${xPos + 3} ${yPos}L${xPos + 5} ${yPos + 6}Z`, '#111', '1', '#111')); // triangle part
        }
      } else {
        console.error('Effect Group null!');
      }
    }
  }

  drawTremoloBar(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    tremoloBarObjs: TremoloBar, height: number,
  ) {
    const yStartPos = -10 - height;
    const xStartPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 7;
    // max width value = 60 60/3 = 20
    const padding = 3;
    const tremoloBarHeight = 20; // 1200/28, 800 negative, 400 positive

    let svgPath = '';
    for (let i = 0; i < tremoloBarObjs.length; i += 1) {
      const tValue = Math.max(0, tremoloBarObjs[i].value + 300);
      const xPos = tremoloBarObjs[i].position / 3;
      const yPos = tremoloBarHeight - (tValue) / 30 - padding;

      if (i === 0) {
        svgPath += `M${xPos + xStartPos} ${yPos + yStartPos}`;
      } else {
        svgPath += `L${xPos + xStartPos} ${yPos + yStartPos}`;
      }
    }

    const tremoloBar = SvgDrawer.createPath(svgPath, '#111', '1', 'none');
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (overBarGroup != null) {
        overBarGroup.appendChild(tremoloBar);
      }
    }
  }

  applyOverBarNoteEffects(
    trackId: number, blockId: number, voiceId: number, beatId: number, sHeight: number,
  ) {
    let startHeight = sHeight;
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (beat.notes == null) {
      return;
    }

    let palmMute = false; let stacatto = false; let tap = false; let fadeIn = false;
    let pop = false; let slap = false; let letRing = false;
    let accentuated = false; let heavyAccentuated = false; let artificial = false;
    let vibrato = false; let trill = false; let pullDown = false;
    let artificialStyle = '';
    let pullDownStyle = '';

    for (let i = 0, n = beat.notes.length; i < n; i += 1) {
      const note = beat.notes[i];
      if (note != null) {
        if (note.palmMute) { palmMute = true; }
        if (note.stacatto) { stacatto = true; }
        if (note.tap) { tap = true; }
        if (note.letRing) { letRing = true; }
        if (note.fadeIn) { fadeIn = true; }
        if (note.pop) { pop = true; }
        if (note.slap) { slap = true; }
        if (note.accentuated) { accentuated = true; }
        if (note.heavyAccentuated) { heavyAccentuated = true; }
        if (note.vibrato) { vibrato = true; }
        if (note.trillPresent) { trill = true; }
        if (note.artificialPresent && note.artificialStyle != null) {
          artificial = true;
          // artificialStyle += note.artificialStyle;
          artificialStyle = note.artificialStyle;
        }
        if (note.pullDown) {
          if (beatId + 1 < Song.measures[trackId][blockId][voiceId].length
            && Song.measures[trackId][blockId][voiceId][beatId + 1].notes != null
            && Song.measures[trackId][blockId][voiceId][beatId + 1].notes[i] != null) {
            pullDown = true;
            if (note.fret > Song.measures[trackId][blockId][voiceId][beatId + 1].notes[i]!.fret) {
              pullDownStyle += 'P';
            } else {
              pullDownStyle += 'H';
            }
          }
        }
      }
    }
    if (pullDown) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, pullDownStyle, 'hammer', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (palmMute) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'P.M.', 'palmMute', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (stacatto) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, '•', 'stacatto', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (tap) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'T', 'tap', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (fadeIn) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, '≺', 'fadeIn', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (pop) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'P', 'pop', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (slap) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'S', 'slap', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (accentuated) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, '>', 'accentuated', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (heavyAccentuated) {
      this.drawHeavyAccentuated(trackId, blockId, voiceId, beatId, startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (artificial) {
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, artificialStyle, 'artificial', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (vibrato) {
      this.drawVibrato(trackId, blockId, voiceId, beatId, 'vibrato', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (trill) {
      this.drawVibrato(trackId, blockId, voiceId, beatId, 'trill', startHeight);
      this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'Tr', 'trill', startHeight);
      startHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (letRing) {
      this.drawLetRing(trackId, blockId, voiceId, beatId, startHeight);
    }
  }

  drawVibrato(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    type: string, height: number,
  ) {
    const leftOffset = type === 'trill' ? 17 : 0;
    const yStartPos = -height - 6;
    const xStartPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 7 + leftOffset;
    const vibratoWidth = tab.measureOffset[trackId][blockId][voiceId]
      * Duration.getDurationWidth(Song.measures[trackId][blockId][voiceId][beatId])
      - leftOffset;
    let vibratoPath = `M${xStartPos} ${yStartPos + 3}`;
    for (let i = 3; i < vibratoWidth; i += 3) {
      if (i % 6 === 0) vibratoPath += `L${xStartPos + i} ${yStartPos + 5}`;
      else vibratoPath += `L${xStartPos + i} ${yStartPos + 1}`;
    }
    // Hard beacause you have to change the vibrato if the beatLength changes
    const vibrato = SvgDrawer.createPath(vibratoPath, '#111', '1', 'none');
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (overBarGroup != null) {
        overBarGroup.appendChild(vibrato);
      }
    }
  }

  drawHeavyAccentuated(
    trackId: number, blockId: number, voiceId: number, beatId: number, height: number,
  ) {
    const yStartPos = -height - 6;
    const xStartPos = Helper.getBeatPosX(trackId, blockId, voiceId, beatId) + 7;
    const accPath = `M${xStartPos} ${yStartPos + 6}L${xStartPos + 3} ${yStartPos}L${xStartPos + 6} ${yStartPos + 6}`;
    const heavyAccentuated = SvgDrawer.createPath(accPath, '#111', '1', 'none');
    if (this.svgBlocks[trackId][blockId][voiceId] != null) {
      const { overBarGroup } = this.svgBlocks[trackId][blockId][voiceId];
      if (overBarGroup != null) {
        overBarGroup.appendChild(heavyAccentuated);
      }
    }
  }

  drawLetRing(trackId: number, blockId: number, voiceId: number, beatId: number, height: number) {
    /* const yStartPos = -height - 2;
      const xStartPos = Helper.getBeatPosX(trackId, blockId,
      voiceId, beatId) + 7;
      var letRingWidth = tab.measureOffset[trackId][blockId][voiceId]*
      Duration.getDurationWidth(Song.measures[trackId][blockId][voiceId][beatId],
        trackId, blockId)-5;
      var line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("stroke-dasharray", "5,5");
      line.setAttribute("x1", xStartPos);
      line.setAttribute("y1", yStartPos+3);
      line.setAttribute("x2", xStartPos+letRingWidth);
      line.setAttribute("y2", yStartPos+3);

      line.setAttribute("stroke", "black");
      line.setAttribute("stroke-width", 1); */

    this.placeTextAboveBeat(trackId, blockId, voiceId, beatId, 'ring', 'letRing', height + 5);
    /* if(svgBlocks[trackId][blockId][voiceId] != null){
        svgBlocks[trackId][blockId][voiceId].overBarGroup.appendChild(line);
      } */
  }

  drawOverlayRow(
    trackId: number, voiceId: number, rowId: number, xPosStart: number, xPosEnd: number,
  ) {
    const firstBlockId = tab.blocksPerRow[trackId][voiceId][rowId].start;
    const staveBegin = classicalNotation.getYForStaveBegin(firstBlockId);
    let height = this.getPositionMarkerHeight(trackId);
    let yPos = this.rowToY[trackId][voiceId][rowId];
    if (Settings.vexFlowIsActive) {
      yPos += staveBegin;
      height -= staveBegin;
    }
    const width = xPosEnd - xPosStart;
    const overlay = SvgDrawer.createRect(xPosStart, yPos, width, height, 'white', '0', 'rgba(62, 173, 255, 0.19)');
    const pageId = this.blockToPage[tab.blocksPerRow[trackId][voiceId][rowId].start];
    this.svgPagesPlayBackBar[trackId][voiceId][pageId].appendChild(overlay);
    return overlay;
  }

  static drawPoint(
    xPos: number, yPos: number, paddingTop: number, paddingLeft: number,
    radius: number, svgParent: SVGElement, text: string,
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svgParent.appendChild(group);
    const pointElem = SvgDrawer.createCircle(xPos + paddingLeft, yPos + paddingTop, radius, 'none', '1', '#123e74');
    group.appendChild(pointElem);
    if (text != null) {
      group.appendChild(SvgDrawer.createText(xPos - 3, yPos + paddingTop + 4, text, '13px', '#fff', 'Source Sans Pro'));
    }
    return group;
  }

  static connectPoints(
    pointA: SVGElement, pointB: SVGElement, svgElem: SVGElement,
  ) {
    const pathStr = `M${pointA.getAttribute('cx')} ${pointA.getAttribute('cy')}L${pointB.getAttribute('cx')} ${pointB.getAttribute('cy')}`;
    const pathEl = SvgDrawer.createPath(pathStr, '#123e74', '2', 'none');
    pathEl.setAttribute('class', 'pointConnectionLine');
    svgElem.appendChild(pathEl);
    return pathEl;
  }
}

const svgDrawer = new SvgDrawer();
export { svgDrawer, SvgDrawer };

export default SvgDrawer;
