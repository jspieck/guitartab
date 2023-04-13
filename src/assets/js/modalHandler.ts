import Picker from 'vanilla-picker';
import interact from 'interactjs';
import fastdom from 'fastdom';
import Song, {
  Measure, Note, Marker, SongDescription, Chord, TremoloBar, Stroke, Grace,
} from './songData';
import { sequencer, Sequencer } from './sequencer';
import { audioEngine } from './audioEngine';
import knobFactory from './knob';
import { menuHandler, MenuHandler } from './menuHandler';
import Settings from './settingManager';
import { tab } from './tab';
import Helper from './helper';
import AppManager from './appManager';
import { revertHandler } from './revertHandler';
import { svgDrawer, SvgDrawer } from './svgDrawer';
import { classicalNotation } from './vexflowClassical';

interface InteractEvent {
  target: HTMLElement,
  dx: number,
  dy: number
}

interface SongDescriptionModal extends SongDescription { bound: boolean }
interface ChordModal extends Chord { bound: boolean }
interface GraceModal extends Grace { bound: boolean }

class ModalHandler {
  windows: Map<string, number>;

  infoModalData: SongDescriptionModal;

  artificialModalData: { artificial: string };

  tremoloPickingModalData: { tremoloPickingLength: string };

  strokeModalData: Stroke;

  textModalData: { text: string };

  markerModalData: Marker;

  chordModalData: ChordModal;

  graceModalData: GraceModal;

  tremoloBarModalData: { bound: boolean };

  tremoloPointsOnLine: ([SVGElement, number, number] | null)[];

  NUM_ROWS_TREMOLO: number;

  NUM_COLUMNS_TREMOLO: number;

  pointsOnLine: ([SVGElement, number, number] | null)[];

  VERTICAL_STEPS: number;

  HORIZONTAL_STEPS: number;

  bendModalData: { bound: boolean };

  chordProperties: {
    paddingRight: number,
    paddingLeft: number,
    width: number,
    height: number,
    stringPadding: number,
    horizontalSteps: number,
    numStrings: number,
    currentNotes: number[],
    capo: number,
    name: string,
    fingers: number[]
  };

  allChords: {
    [chordName: string]: {
      [chordType: string]: {
        capo: number,
        notes: number[],
        fingers: (number | null)[]
      }
    }
  };

  chordDisplayObjects: SVGGElement[];

  bendPointsArr: SVGPathElement[];

  tremoloPointsArr: SVGPathElement[];

  instrumentSettingData: {
    name: string,
    color: {red: number, green: number, blue: number},
    numStrings: number,
    capo: number,
    letItRing: boolean
  };

  defaultStringConfiguration: {
    [a: number]: string[],
  };

  lastColumnClicked: HTMLElement | null;

  mixerVolumeContexts: CanvasRenderingContext2D[];

  artificialDefault: string;

  repititionModalData: { numRepititions: number };

  timeMeterData: {denominator: number, numerator: number};

  bpmData: number;

  initYPosModal: number;

  oldBpm: number;

  mouseOffsetX: number;

  mouseOffsetY: number;

  tremoloEditorClientWidth: number;

  tempoFuncBinded: (e: MouseEvent) => void;

  remTempoBinded: (e: MouseEvent) => void;

  constructor() {
    this.tempoFuncBinded = () => {};
    this.remTempoBinded = () => {};
    this.windows = new Map();
    this.infoModalData = {
      title: '', subtitle: '', author: '', artist: '', album: '', music: '', copyright: '', writer: '', instructions: '', comments: [], bound: false, wordsAndMusic: '',
    };
    this.artificialModalData = { artificial: '' };
    this.tremoloPickingModalData = { tremoloPickingLength: 'e' };
    this.strokeModalData = { strokeLength: 0, strokeType: 'down' };
    this.textModalData = { text: '' };
    this.markerModalData = { text: '', color: { red: 255, green: 255, blue: 255 } };
    this.chordModalData = {
      name: '', capo: 0, frets: [], chordRoot: '', chordType: '', fingers: [], display: false, bound: false,
    };
    this.graceModalData = {
      duration: 'e',
      setOnBeat: 'before',
      dynamic: 'mf',
      transition: '',
      fret: -1,
      bound: false,
      string: 0,
      height: 0,
      dead: false,
    };

    this.tremoloBarModalData = { bound: false };
    this.tremoloPointsOnLine = [];
    this.NUM_ROWS_TREMOLO = 24;
    this.NUM_COLUMNS_TREMOLO = 12;

    this.pointsOnLine = [];
    this.VERTICAL_STEPS = 12;
    this.HORIZONTAL_STEPS = 12;
    this.bendModalData = { bound: false };

    this.chordProperties = {
      paddingRight: 20,
      paddingLeft: 25,
      width: 240,
      height: 140,
      stringPadding: 10,
      horizontalSteps: 5,
      numStrings: 6,
      currentNotes: [-1, -1, -1, -1, -1, -1],
      capo: 0,
      name: 'Cmaj',
      fingers: [],
    };

    this.allChords = {
      C: {
        maj: { capo: 0, notes: [-1, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] },
        min: { capo: 8, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      'C#': {
        maj: { capo: 9, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 9, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      D: {
        maj: { capo: 0, notes: [-1, -1, 0, 2, 3, 2], fingers: [null, null, null, 1, 2, 3] },
        min: { capo: 0, notes: [-1, -1, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1] },
      },
      'D#': {
        maj: { capo: 11, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 11, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      E: {
        maj: { capo: 0, notes: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null] },
        min: { capo: 0, notes: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null] },
      },
      F: {
        maj: { capo: 1, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 1, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      'F#': {
        maj: { capo: 2, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 2, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      G: {
        maj: { capo: 0, notes: [3, 2, 0, 0, 0, 3], fingers: [3, 2, null, null, null, 4] },
        min: { capo: 3, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      'G#': {
        maj: { capo: 4, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 4, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      A: {
        maj: { capo: 0, notes: [0, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null] },
        min: { capo: 0, notes: [0, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null] },
      },
      'A#': {
        maj: { capo: 6, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 6, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
      },
      H: {
        maj: { capo: 2, notes: [-1, 0, 2, 2, 2, 0], fingers: [null, 1, 3, 3, 3, 1] },
        min: { capo: 2, notes: [-1, 1, 2, 2, 1, 0], fingers: [null, 1, 3, 4, 1, 1] },
      },
    };

    this.chordDisplayObjects = [];
    this.bendPointsArr = [];
    this.tremoloPointsArr = [];

    this.instrumentSettingData = {
      name: '',
      color: { red: 255, green: 0, blue: 0 },
      numStrings: 0,
      capo: 0,
      letItRing: false,
    };
    this.defaultStringConfiguration = {
      4: ['E2', 'A2', 'D3', 'G3'],
      5: ['B1', 'E2', 'A2', 'D3', 'G3'],
      6: ['E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
      7: ['B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
      8: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
      9: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5', 'B5'],
    };
    this.lastColumnClicked = null;
    this.mixerVolumeContexts = [];
    this.artificialDefault = 'N.H.';
    this.repititionModalData = { numRepititions: 0 };
    this.timeMeterData = { denominator: 4, numerator: 4 };
    this.bpmData = -1;
    this.initYPosModal = 0;
    this.oldBpm = 0;
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.tremoloEditorClientWidth = 0;

    let hideTopBarElems = document.querySelectorAll('.hideTopBar');
    hideTopBarElems.forEach(elem => {
      elem.addEventListener('click', (e) => {
        let target = e.currentTarget as HTMLElement;
        if (target != null
          && target.parentNode != null
          && target.parentNode.parentNode != null
        ) {
          const modal = target.parentNode.parentNode;
          ModalHandler.toggleTopBar(modal as HTMLElement);
        }
      });
    });
    
    let eyeToggleElems = document.querySelectorAll('.eyeToggle');
    eyeToggleElems.forEach(elem => {
      elem.addEventListener('click', (e) => {
        let target = e.currentTarget as HTMLElement;
        if (target != null
          && target.parentNode != null
          && target.parentNode.parentNode != null
        ) {
          const modal = target.parentNode.parentNode;
          ModalHandler.toggleTopBar(modal as HTMLElement);
        }
      });
    });
  }

  closeModal(id: string) {
    console.log('Close the modal called!');
    fastdom.mutate(() => {
      this.windows.delete(id);
      ModalHandler.removeWindowMarker(id);
      document.getElementById(id)?.removeEventListener('mousedown',
        () => { this.moveToFront(id); });
      document.getElementById(id)?.classList.remove('active');
    });
  }

  closeAllModals() {
    for (const key of this.windows.keys()) {
      this.closeModal(key);
    }
  }

  toggleModal(id: string, name: string) {
    if (this.windows.has(id)) {
      this.closeModal(id);
    } else {
      this.displayModal(id, name);
    }
  }

  isDisplayed(id: string) {
    return this.windows.has(id);
  }

  drawBendEditor(
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
        beat: Measure}[]
    },
    paddingTop: number,
    paddingLeft: number,
    width: number,
    height: number,
  ) {
    fastdom.mutate(() => {
      const bendEditor = document.getElementById('bendEditor')!;
      Helper.removeAllChildren(bendEditor);
      this.bendPointsArr.length = 0;
      const rect = SvgDrawer.createRect(paddingLeft, paddingTop, width, height, '', '1', '');
      bendEditor.appendChild(rect);
      // axis
      bendEditor.appendChild(SvgDrawer.createText(0, height + paddingTop, '0', '12px', ''));
      bendEditor.appendChild(SvgDrawer.createText(0, (height * 2) / 3 + paddingTop, 'Half', '12px', ''));
      bendEditor.appendChild(SvgDrawer.createText(0, paddingTop + height / 3, 'Full', '12px', ''));
      bendEditor.appendChild(SvgDrawer.createText(0, paddingTop, '1.5', '12px', ''));

      // Draw vertical lines
      for (let i = 0; i < this.HORIZONTAL_STEPS - 1; i += 1) {
        const xPos = (width / this.HORIZONTAL_STEPS) * (i + 1) + paddingLeft;
        const pathStr = `M${xPos} ${paddingTop}L${xPos} ${height + paddingTop}`;
        let stroke = '#4a4a4a';
        if ((i + 1) % 3 !== 0) stroke = '#d6d6d6';
        const pathEl = SvgDrawer.createPath(pathStr, stroke, '1', 'none');
        if ((i + 1) % 3 !== 0) {
          pathEl.setAttribute('class', 'gridLine');
        } else {
          pathEl.setAttribute('class', 'strongGridLine');
        }
        bendEditor?.appendChild(pathEl);
      }
      // draw horizontal lines
      for (let i = 0; i < this.VERTICAL_STEPS - 1; i += 1) {
        const yPos = (height / this.VERTICAL_STEPS) * (i + 1) + paddingTop;
        const pathStr = `M${paddingLeft} ${yPos}L${width + paddingLeft} ${yPos}`;
        let stroke = '#4a4a4a';
        if ((i + 1) % 4 !== 0) {
          stroke = '#d6d6d6';
        }
        const pathEl = SvgDrawer.createPath(pathStr, stroke, '1', 'none');
        if ((i + 1) % 4 !== 0) {
          pathEl.setAttribute('strokeDasharray', '5, 5');
          pathEl.setAttribute('class', 'gridLine');
        } else {
          pathEl.setAttribute('class', 'strongGridLine');
        }
        bendEditor?.appendChild(pathEl);
      }
      // draw blue points
      this.pointsOnLine.length = 0;
      for (let i = 0; i <= this.HORIZONTAL_STEPS; i += 1) {
        this.pointsOnLine[i] = null;
      }
      const { note } = arr.notes[0];
      if (note.bendObj == null) {
        this.applyBendPreset(0, paddingTop, paddingLeft, width, height, []);
      } else {
        const preset = [];
        for (let i = 0; i < note.bendObj.length; i += 1) {
          if (note.bendObj[i] != null) {
            preset.push({ x: note.bendObj[i].bendPosition / 5, y: note.bendObj[i].bendValue / 25 });
          }
        }
        this.applyBendPreset(0, paddingTop, paddingLeft, width, height, preset);
      }
      // connect Points
      this.connectAllBendPoints(bendEditor);
    });
  }

  openBendModal(
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
        beat: Measure}[]
    },
    isVariableSet: boolean,
  ) {
    const bendPresentBefore: {[a: string]: boolean} = {};
    for (const no of arr.notes) {
      const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      bendPresentBefore[noteStr] = no.note.bendPresent;
    }
    const paddingTop = 20;
    const paddingLeft = 25;
    const bendEditorClientWidth = 501;
    const width = bendEditorClientWidth - 2 * paddingLeft;
    const height = 200 - 2 * paddingTop;
    this.drawBendEditor(arr, paddingTop, paddingLeft, width, height);
    if (!this.bendModalData.bound) {
      const bendEditor = document.getElementById('bendEditor')!;
      bendEditor.addEventListener('mousedown', (e) => {
        fastdom.measure(() => {
          const t = document.getElementById('bendEditor')!.getBoundingClientRect();
          this.mouseOffsetX = e.clientX - t.left;
          this.mouseOffsetY = e.clientY - t.top;
        });
        fastdom.mutate(() => {
          const xPos = Math.min(Math.max(this.mouseOffsetX - paddingLeft, 0), width);
          const yPos = Math.min(Math.max(this.mouseOffsetY - paddingTop, 0), height);
          const oneXPort = width / this.HORIZONTAL_STEPS;
          const oneYPort = height / this.VERTICAL_STEPS;
          const xIndex = Math.round(xPos / oneXPort);
          const yIndex = Math.round(yPos / oneYPort);
          const xNearest = xIndex * oneXPort;
          const yNearest = yIndex * oneYPort;

          let samePoint = false;
          const currentPoint = this.pointsOnLine[xIndex];
          if (currentPoint != null) {
            if (currentPoint[0].parentNode != null) {
              currentPoint[0].parentNode.removeChild(currentPoint[0]);
            }
            samePoint = (this.VERTICAL_STEPS - yIndex === currentPoint[1]);
            this.pointsOnLine[xIndex] = null;
          }
          if (!samePoint) {
            const point = ModalHandler.drawPoint(xNearest, yNearest, paddingTop,
              paddingLeft, 7, bendEditor, '');
            this.pointsOnLine[xIndex] = [point, this.VERTICAL_STEPS - yIndex, xIndex];
          }
          this.connectAllBendPoints(bendEditor);
        });
      });

      const bendSelectionDom = document.getElementById('bendSelection') as HTMLSelectElement;
      bendSelectionDom.onchange = () => {
        fastdom.mutate(() => {
          const val = bendSelectionDom.options[bendSelectionDom.selectedIndex].value;
          this.applyBendPreset(parseInt(val, 10), paddingTop, paddingLeft, width, height, []);
        });
      };
    }
    document.getElementById('selectButton')!.onclick = null;
    document.getElementById('selectButton')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('modalEditor');
        const bendObjs = [];
        for (let i = 0; i < this.pointsOnLine.length; i += 1) {
          const currentPoint = this.pointsOnLine[i];
          if (currentPoint != null) {
            bendObjs.push({
              bendPosition: currentPoint[2] * 5,
              bendValue: currentPoint[1] * 25,
              vibrato: 0,
            });
          }
        }
        const notesBefore = menuHandler.handleEffectGroupCollision(arr.notes, 'bend', isVariableSet);
        for (const no of arr.notes) {
          const {
            trackId, blockId, voiceId, beatId, string,
          } = no;
          const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
          if (note == null) {
            console.error('Note is null');
            return;
          }
          const bendBefore = note.bendObj;
          if (!note.bendPresent) {
            note.bendPresent = true;
            if (tab.markedNoteObj.blockId === blockId && tab.markedNoteObj.beatId === beatId) {
              menuHandler.activateEffectsForNote(note);
            }
          }
          note.bendObj = bendObjs;
          const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
          revertHandler.addBend(trackId, blockId, voiceId, beatId, string,
            bendBefore, note.bendObj, bendPresentBefore[noteStr], note.bendPresent,
            notesBefore[noteStr]);
        }
        svgDrawer.rerenderBlocks(arr.notes[0].trackId, arr.blocks, arr.notes[0].voiceId);
      });
    };
    this.bendModalData.bound = true;
    this.displayModal('modalEditor', 'Bend');
  }

  openAddTrack() {
    this.displayModal('addTrackModal', 'Add Track');
  }

  static dragMoveListener(event: InteractEvent) {
    const target = event.target as HTMLElement;
    if (target != null) {
      // keep the dragged position in the data-x/data-y attributes
      const x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
      const y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;

      /* x = Math.max(0, Math.min(x, document.body.scrollWidth - 100));
          y = Math.max(21, Math.min(y, document.body.scrollHeight - 100)); */

      target.style.left = `${x}px`;
      target.style.top = `${y}px`;

      // update the posiion attributes
      target.setAttribute('data-x', x.toString());
      target.setAttribute('data-y', y.toString());
    }
  }

  static addDragging(id: string) {
    interact(`#${id}`)
      .draggable({
        allowFrom: '.modalTopBar',
        onmove: ModalHandler.dragMoveListener,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            elementRect: {
              top: 0, left: 0, bottom: 1, right: 1,
            },
          }),
        ],
      }).pointerEvents({
        allowFrom: '.modalTopBar',
      });
    if (id === 'mixerModal' || id === 'trackInfoModal' || id === 'chordManagerModal' || id === 'pianoModal') {
      ModalHandler.addResizable(id, {
        left: true, right: true, bottom: false, top: false,
      });
    } else if (id === 'guitarModal') {
      ModalHandler.addResizable(id, {
        left: true, right: true, bottom: true, top: false,
      });
    }
  }

  static addResizable(
    id: string,
    edges: { left: boolean, right: boolean, bottom: boolean, top: boolean },
  ) {
    interact(`#${id}`).resizable({
      margin: 20,
      // resize from all edges and corners
      edges,
      // keep the edges inside the parent
      // restrictEdges: {
      //  outer: 'parent',
      //  endOnly: true,
      // },
      // minimum size
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: 185, height: 50 },
        }),
      ],
      inertia: true,
    }).on('resizemove', (event) => {
      const { target } = event;
      const x = (parseFloat(target.getAttribute('data-x')) || 0);
      const y = (parseFloat(target.getAttribute('data-y')) || 0);

      // update the element's style
      target.style.width = `${event.rect.width}px`;
      if (edges.bottom) target.style.height = `${event.rect.height}px`;

      target.style.left = `${x}px`;
      target.style.top = `${y}px`;

      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
    });
  }

  isAModalOpen() {
    return this.windows.size !== 0;
  }

  orderWindows() {
    const sortFunc = (a: [string, number], b: [string, number]) => {
      if (a[1] > b[1]) {
        return 1;
      }
      if (a[1] < b[1]) {
        return -1;
      }
      return 0;
    };
    const windowOrder = new Map([...this.windows.entries()].sort(sortFunc));
    let zIndex = 200;
    for (const key of windowOrder.keys()) {
      document.getElementById(key)!.style.zIndex = zIndex.toString();
      zIndex += 1;
    }
  }

  moveToFront(id: string) {
    this.windows.set(id, new Date().getTime());
    this.orderWindows();
  }

  displayModal(id: string, name: string) {
    if (this.windows.has(id)) {
      console.log('Already open!');
      return;
    }
    this.windows.set(id, new Date().getTime());

    document.getElementById('content')?.classList.add('blurFilter');
    document.getElementById(id)?.classList.add('active');

    const target = document.getElementById(id);
    if (target != null) {
      const positionInfo = target.getBoundingClientRect();
      const { height } = positionInfo;
      const { width } = positionInfo;
      // console.log(window.innerWidth, window.innerHeight, width, height);
      const x = window.innerWidth / 2 - width / 2;
      const y = window.innerHeight / 2 - height / 2;

      target.style.left = `${x}px`;
      target.style.top = `${y}px`;
      target.setAttribute('data-x', x.toString());
      target.setAttribute('data-y', y.toString());

      target.querySelector('.modal_close')?.addEventListener('click', () => {
        this.closeModal(id);
      });
      ModalHandler.addDragging(id);

      this.orderWindows();
      target.addEventListener('mousedown', () => {
        // e.preventDefault();
        this.moveToFront(id);
        // setActiveWindow(id);
      });
      this.addWindowMarker(id, name);
    }
  }

  addWindowMarker(id: string, name: string) {
    const area = document.getElementById('openWindowArea')!;
    const footerBlock = document.createElement('div');
    footerBlock.setAttribute('id', `${id}Marker`);
    footerBlock.setAttribute('class', 'footerBlock');
    const openWindow = document.createElement('div');
    openWindow.setAttribute('class', 'openWindows');
    openWindow.setAttribute('draggable', 'false');
    openWindow.textContent = name;
    footerBlock.appendChild(openWindow);
    area.appendChild(footerBlock);
    footerBlock.addEventListener('mousedown', () => { this.moveToFront(id); });
  }

  static removeWindowMarker(id: string) {
    const block = document.getElementById(`${id}Marker`);
    if (block != null && block.parentNode != null) {
      block.parentNode.removeChild(block);
    } else {
      console.error('Window Marker not existent!');
    }
  }

  constructTuningArea(trackId: number, hasStringNumberChanged: boolean) {
    // TODO 8 or 9 strings!!!
    const tuningArea = document.getElementById('tuningAreaModal')!;
    Helper.removeAllChildren(tuningArea);
    for (let i = 0; i < this.instrumentSettingData.numStrings; i += 1) {
      // construct selects
      const tuningSelectBox = document.createElement('div');
      tuningSelectBox.setAttribute('class', 'select');
      const tuningSelect = document.createElement('select');
      tuningSelect.setAttribute('id', `tuningSelect${i}`);
      // construct options
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      for (let j = 0; j <= 9; j += 1) {
        for (let k = 0; k < notes.length; k += 1) {
          const tuningOption = document.createElement('option');
          const noteString = `${notes[k]}${j}`;
          const numericalNoteValue = notes.length * j + k;
          tuningOption.setAttribute('value', numericalNoteValue.toString());
          tuningOption.textContent = noteString;
          tuningSelect.appendChild(tuningOption);
          const { numStrings } = this.instrumentSettingData;
          if (hasStringNumberChanged
            && noteString === this.defaultStringConfiguration[numStrings][i]) {
            tuningSelect.options.selectedIndex = numericalNoteValue;
          }
        }
      }
      if (!hasStringNumberChanged) {
        tuningSelect.options.selectedIndex = Song.tracks[trackId].strings[i];
      }

      tuningSelectBox.appendChild(tuningSelect);

      const selectArrow = document.createElement('div');
      selectArrow.setAttribute('class', 'select__arrow');
      tuningSelectBox.appendChild(selectArrow);
      tuningArea.appendChild(tuningSelectBox);
    }
  }

  setInstrumentSettingsState(trackId: number) {
    this.instrumentSettingData.name = Song.tracks[trackId].name;
    this.instrumentSettingData.color = Song.tracks[trackId].color;
    this.instrumentSettingData.numStrings = Song.tracks[trackId].numStrings;
    this.instrumentSettingData.capo = Song.tracks[trackId].capo;
    this.instrumentSettingData.letItRing = Song.tracks[trackId].letItRing;

    const ringCheckboxDom = document.getElementById('ringCheckbox') as HTMLInputElement;
    const stringCountSelectDom = document.getElementById('stringCountSelect') as HTMLInputElement;
    const instrumentNameInputDom = document.getElementById('instrumentNameInput') as HTMLInputElement;
    const capoSelectDom = document.getElementById('capoSelect') as HTMLInputElement;

    ringCheckboxDom.checked = this.instrumentSettingData.letItRing;
    instrumentNameInputDom.value = this.instrumentSettingData.name;
    stringCountSelectDom.value = this.instrumentSettingData.numStrings.toString();
    capoSelectDom.value = this.instrumentSettingData.capo.toString();
    const pickerParent = document.getElementById('instrumentColorPicker');
    const picker = new Picker({
      parent: pickerParent!,
      color: `rgb(${this.instrumentSettingData.color.red},${this.instrumentSettingData.color.green},${this.instrumentSettingData.color.blue})`,
      popup: 'bottom',
    });
    picker.onChange = (color: {rgba: number[]}) => {
      pickerParent!.style.backgroundColor = `rgb(${color.rgba[0]},${color.rgba[1]},${color.rgba[2]})`;
      this.instrumentSettingData.color = {
        red: color.rgba[0],
        green: color.rgba[1],
        blue: color.rgba[2],
      };
    };

    this.constructTuningArea(trackId, false);
  }

  openInstrumentSettings(trackId: number) {
    this.setInstrumentSettingsState(trackId);

    const instrumentNameInput = document.getElementById('instrumentNameInput') as HTMLInputElement;
    instrumentNameInput.onchange = null;
    instrumentNameInput.onchange = () => {
      this.instrumentSettingData.name = instrumentNameInput.value;
    };

    const stringCountSelect = document.getElementById('stringCountSelect') as HTMLInputElement;
    stringCountSelect.onchange = null;
    stringCountSelect.onchange = () => {
      this.instrumentSettingData.numStrings = parseInt(stringCountSelect.value, 10);
      this.constructTuningArea(trackId, true);
    };

    const capoSelect = document.getElementById('capoSelect') as HTMLInputElement;
    capoSelect.onchange = null;
    capoSelect.onchange = () => {
      this.instrumentSettingData.capo = parseInt(capoSelect.value, 10);
    };

    const instSelectBtn = document.getElementById('instrumentSettingsSelectButton') as HTMLButtonElement;
    instSelectBtn.onclick = null;
    instSelectBtn.onclick = () => {
      const trackBefore = JSON.parse(JSON.stringify(Song.tracks[trackId]));
      const numStringsBefore = Song.tracks[trackId].numStrings;
      Song.tracks[trackId].name = this.instrumentSettingData.name;
      Song.tracks[trackId].color = this.instrumentSettingData.color;
      Song.tracks[trackId].numStrings = this.instrumentSettingData.numStrings;
      Song.tracks[trackId].capo = this.instrumentSettingData.capo;
      Song.tracks[trackId].letItRing = (document.getElementById('ringCheckbox') as HTMLInputElement).checked;

      // set strings
      // var tuningString = "";
      Song.tracks[trackId].strings.length = 0;
      const { numStrings } = Song.tracks[trackId];
      for (let i = 0; i < numStrings; i += 1) {
        const selectEl = document.getElementById(`tuningSelect${i}`) as HTMLInputElement | null;
        if (selectEl != null) {
          Song.tracks[trackId].strings[i] = parseInt(selectEl.value, 10);
          // tuningString += selectEl.options[selectEl.selectedIndex].textContent.slice(0, -1);
        }
      }
      // document.getElementById("tuningTitle").textContent = tuningString;
      if (Settings.sequencerTrackColor) {
        const { red, green, blue } = Song.tracks[trackId].color;
        document.getElementById(`labelImg${trackId}`)!.style.borderLeft = `3px solid rgb(${red}, ${green}, ${blue})`;
      }
      document.getElementById(`instrumentLabel${trackId}`)!.textContent = Song.tracks[trackId].name;
      revertHandler.addInstrumentSettings(trackId, trackBefore, Song.tracks[trackId]);

      if (numStringsBefore !== Song.tracks[trackId].numStrings) {
        tab.redrawCompleteTrack(trackId);
      }
      AppManager.setCapo(this.instrumentSettingData.capo);
      if (trackId === Song.currentTrackId) {
        tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, () => {
          AppManager.setTrackInstrument(trackId);
        });
      }
      this.closeModal('instrumentSettingsModal');
    };
    this.displayModal('instrumentSettingsModal', 'Settings');
  }

  createChordManager(trackId: number) {
    const container = document.getElementById('chordsContainer')!;
    Helper.removeAllChildren(container);
    let chordCounter = 0;
    for (const [chordName, chord] of Song.chordsMap[trackId]) {
      // Object.keys(Song.chordsMap[trackId]).forEach((chord) => {
      const chordBox = document.createElement('div');
      chordBox.setAttribute('class', 'chordBox');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', `chordOverview${chordCounter}`);
      if (!chord.display) {
        svg.classList.add('hideChord');
      }
      const chordDia = svgDrawer.createChordDiagram(chord);
      chordDia.setAttribute('transform', 'translate(20, 40)');
      svg.appendChild(chordDia);
      chordBox.appendChild(svg);
      const removeChord = document.createElement('div');
      const removeImg = document.createElement('img');
      removeImg.setAttribute('src', './images/trashCan.svg');
      removeChord.appendChild(removeImg);
      removeChord.setAttribute('class', 'removeChord');
      const displayChord = document.createElement('div');
      displayChord.textContent = 'Hide';
      displayChord.setAttribute('class', 'displayChord');
      chordBox.appendChild(displayChord);
      chordBox.appendChild(removeChord);
      container.appendChild(chordBox);

      const chordOvDom = document.getElementById(`chordOverview${chordCounter}`);
      displayChord.addEventListener('click', () => {
        if (!chord.display) {
          displayChord.textContent = 'Hide';
          chord.display = true;
        } else {
          displayChord.textContent = 'Show';
          chord.display = false;
        }
        // console.log(`chordOverview${chordCounter}`);
        chordOvDom?.classList.toggle('hideChord');
      });

      removeChord.addEventListener('click', () => {
        Song.chordsMap[trackId].delete(chordName);
        this.createChordManager(trackId);
      });
      chordCounter += 1;
    }
    document.getElementById('addChordDiagram')?.addEventListener('click', () => {
      this.openChordModalGlobal(trackId);
    });
  }

  openChordManager(trackId: number) {
    this.createChordManager(trackId);
    document.getElementById('chordDiagramSelectButton')!.onclick = null;
    document.getElementById('chordDiagramSelectButton')!.onclick = () => {
      svgDrawer.redrawChordDiagrams();
      this.closeModal('chordManagerModal');
    };
    this.displayModal('chordManagerModal', 'Chord Manager');
  }

  openDeleteTrack(trackId: number) {
    document.getElementById('yesDelete')!.onclick = null;
    document.getElementById('yesDelete')!.onclick = () => {
      this.closeModal('reallyDeleteModal');
      // set measures
      Song.measures.splice(trackId, 1);
      Song.tracks.splice(trackId, 1);
      Song.playBackInstrument.splice(trackId, 1);
      revertHandler.adaptStackToTrackRemove(trackId);
      svgDrawer.deleteTrack(trackId);
      // redraw sequencer
      sequencer.drawBeat();
      if (tab.markedNoteObj.trackId >= trackId) {
        tab.markedNoteObj.trackId = Math.max(0, tab.markedNoteObj.trackId - 1);
      }

      if (Song.currentTrackId === trackId) {
        AppManager.changeTrack(Math.max(0, trackId - 1), 0, true, null);
      }
      if (Song.currentTrackId > trackId) {
        Song.currentTrackId -= 1;
      }
    };
    document.getElementById('noDelete')!.onclick = null;
    document.getElementById('noDelete')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('reallyDeleteModal');
      });
    };
    this.displayModal('reallyDeleteModal', 'Delete');
  }

  openInfoModal() {
    if (this.infoModalData.bound == null) {
      const songTitleInputDom = document.getElementById('songTitleInput') as HTMLInputElement;
      const songSubtitleInputDom = document.getElementById('songSubtitleInput') as HTMLInputElement;
      const songArtistInputDom = document.getElementById('songArtistInput') as HTMLInputElement;
      const songAlbumInputDom = document.getElementById('songAlbumInput') as HTMLInputElement;
      const songAuthorInputDom = document.getElementById('songAuthorInput') as HTMLInputElement;
      const songMusicInputDom = document.getElementById('songMusicInput') as HTMLInputElement;
      const songCopyrightInputDom = document.getElementById('songCopyrightInput') as HTMLInputElement;
      const songWriterInputDom = document.getElementById('songWriterInput') as HTMLInputElement;
      const songInstructionInputDom = document.getElementById('songInstructionInput') as HTMLInputElement;
      const songCommentsInputDom = document.getElementById('songCommentsInput') as HTMLInputElement;
      songTitleInputDom.oninput = () => {
        this.infoModalData.title = songTitleInputDom.value;
      };
      songSubtitleInputDom.oninput = () => {
        this.infoModalData.subtitle = songSubtitleInputDom.value;
      };
      songArtistInputDom.oninput = () => {
        this.infoModalData.artist = songArtistInputDom.value;
      };
      songAlbumInputDom.oninput = () => {
        this.infoModalData.album = songAlbumInputDom.value;
      };
      songAuthorInputDom.oninput = () => {
        this.infoModalData.author = songAuthorInputDom.value;
      };
      songMusicInputDom.oninput = () => {
        this.infoModalData.music = songMusicInputDom.value;
      };
      songCopyrightInputDom.oninput = () => {
        this.infoModalData.copyright = songCopyrightInputDom.value;
      };
      songWriterInputDom.oninput = () => {
        this.infoModalData.writer = songWriterInputDom.value;
      };
      songInstructionInputDom.oninput = () => {
        this.infoModalData.instructions = songInstructionInputDom.value;
      };
      songCommentsInputDom.oninput = () => {
        this.infoModalData.comments = [];
        this.infoModalData.comments[0] = songCommentsInputDom.value;
      };

      document.getElementById('infoSelectButton')!.onclick = () => {
        this.closeModal('trackInfoModal');
        if (this.infoModalData.title != null) {
          Song.songDescription.title = this.infoModalData.title;
        }
        if (this.infoModalData.subtitle != null) {
          Song.songDescription.subtitle = this.infoModalData.subtitle;
        }
        if (this.infoModalData.artist != null) {
          Song.songDescription.artist = this.infoModalData.artist;
        }
        if (this.infoModalData.album != null) {
          Song.songDescription.album = this.infoModalData.album;
        }
        if (this.infoModalData.author != null) {
          Song.songDescription.author = this.infoModalData.author;
        }
        if (this.infoModalData.music != null) {
          Song.songDescription.music = this.infoModalData.music;
        }
        if (this.infoModalData.copyright != null) {
          Song.songDescription.copyright = this.infoModalData.copyright;
        }
        if (this.infoModalData.writer != null) {
          Song.songDescription.writer = this.infoModalData.writer;
        }
        if (this.infoModalData.instructions != null) {
          Song.songDescription.instructions = this.infoModalData.instructions;
        }
        if (this.infoModalData.comments != null) {
          // eslint-disable-next-line prefer-destructuring
          Song.songDescription.comments[0] = this.infoModalData.comments[0];
        }
        fastdom.mutate(() => {
          // last set info in tab
          document.getElementById('tabTitle')!.textContent = Song.songDescription.title;
          document.getElementById('tabAuthor')!.textContent = Song.songDescription.author;
        });
      };
      this.infoModalData.bound = true;
    }
    this.displayModal('trackInfoModal', 'Info');
  }

  setArtificialState(note: Note) {
    this.artificialModalData.artificial = this.artificialDefault;
    if (note.artificialStyle != null) {
      this.artificialModalData.artificial = note.artificialStyle;
    }
    const harmonicSelection = document.getElementById('harmonicSelection') as HTMLInputElement;
    harmonicSelection.value = this.artificialModalData.artificial;
  }

  openArtificialModal(
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
        beat: Measure}[]
    },
  ) {
    const { note, trackId, voiceId } = arr.notes[0];
    const articialPresentBefore: {[n: string]: boolean} = {};
    for (const no of arr.notes) {
      const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      articialPresentBefore[noteStr] = no.note.artificialPresent;
    }
    this.setArtificialState(note);

    const harmonicSelectionDom = document.getElementById('harmonicSelection') as HTMLInputElement;
    harmonicSelectionDom.onchange = null;
    harmonicSelectionDom.onchange = () => {
      // .options[this.selectedIndex]
      this.artificialModalData.artificial = harmonicSelectionDom.value;
    };

    document.getElementById('harmonicSelectButton')!.onclick = null;
    document.getElementById('harmonicSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        console.log('harmonicSelectButtonInner', arr.notes);
        this.closeModal('addHarmonicModal');
        for (const no of arr.notes) {
          const noteInArr = no.note;
          const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
          const artificialBefore = noteInArr.artificialStyle;
          if (!noteInArr.artificialPresent) {
            noteInArr.artificialPresent = true;
            menuHandler.activateEffectsForNote(noteInArr);
          }
          console.log('AT', this.artificialModalData.artificial);
          noteInArr.artificialStyle = this.artificialModalData.artificial;
          revertHandler.addArtificial(no.trackId, no.blockId, no.voiceId, no.beatId, no.string,
            artificialBefore, noteInArr.artificialStyle, articialPresentBefore[noteStr],
            noteInArr.artificialPresent);
        }
        svgDrawer.rerenderBlocks(trackId, arr.blocks, voiceId);
      });
    };
    this.displayModal('addHarmonicModal', 'Artificial');
  }

  static setRepeatAlternativeState(blockId: number) {
    let number = 0;
    if (Song.measureMeta[blockId].repeatAlternative != null) {
      number = Song.measureMeta[blockId].repeatAlternative;
    }
    for (let u = 0; u < 8; u += 1) {
      const checkBoxDom = document.getElementById(`styled-checkbox-${u + 1}`) as HTMLInputElement;
      if (((number >> u) & 1) === 1) {
        checkBoxDom.checked = true;
      } else {
        checkBoxDom.checked = false;
      }
    }
  }

  openRepeatAlternativeModal(trackId: number, blockId: number, voiceId: number) {
    ModalHandler.setRepeatAlternativeState(blockId);

    document.getElementById('repeatAlternativeSelectButton')!.onclick = null;
    document.getElementById('repeatAlternativeSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('addRepeatAlternativeModal');
        const repeatAlternativePresentBefore = Song.measureMeta[blockId].repeatAlternativePresent;
        const repeatAlternativeBefore = Song.measureMeta[blockId].repeatAlternative;
        if (!Song.measureMeta[blockId].repeatAlternativePresent) {
          Song.measureMeta[blockId].repeatAlternativePresent = true;
          menuHandler.activateEffectsForMarkedPos();
        }
        let raChecked = 0;
        for (let i = 0; i < 7; i += 1) {
          const checkBoxDom = document.getElementById(`styled-checkbox-${i + 1}`) as HTMLInputElement;
          if (checkBoxDom.checked) {
            raChecked += 2 ** i;
          }
        }
        if (raChecked === 0) {
          Song.measureMeta[blockId].repeatAlternative = -1;
        } else {
          Song.measureMeta[blockId].repeatAlternative = raChecked;
        }
        if (repeatAlternativeBefore !== Song.measureMeta[blockId].repeatAlternative) {
          revertHandler.addRepeatAlternative(trackId, blockId, repeatAlternativeBefore,
            Song.measureMeta[blockId].repeatAlternative, repeatAlternativePresentBefore,
            Song.measureMeta[blockId].repeatAlternativePresent);
        }
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
      });
    };
    this.displayModal('addRepeatAlternativeModal', 'Repeat Alt');
  }

  setTremoloPickingState(note: Note) {
    this.tremoloPickingModalData.tremoloPickingLength = 'e'; // default
    if (note.tremoloPickingLength != null) {
      this.tremoloPickingModalData.tremoloPickingLength = note.tremoloPickingLength;
    }
    const tremoloPickingSelectionDom = document.getElementById('tremoloPickingSelection') as HTMLInputElement;
    tremoloPickingSelectionDom.value = this.tremoloPickingModalData.tremoloPickingLength;
  }

  openTremoloPickingModal(arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
  }, isVariableSet: boolean) {
    const noteFirst = arr.notes[0].note;
    const tremoloPickingPresentBefore: {[a: string]: boolean} = {};
    for (const no of arr.notes) {
      const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      tremoloPickingPresentBefore[noteStr] = no.note.tremoloPicking;
    }
    this.setTremoloPickingState(noteFirst);

    document.getElementById('tremoloPickingSelection')!.onchange = null;
    document.getElementById('tremoloPickingSelection')!.onchange = () => {
      this.tremoloPickingModalData.tremoloPickingLength = (document.getElementById('tremoloPickingSelection') as HTMLInputElement).value;
    };

    document.getElementById('tremoloPickingSelectButton')!.onclick = null;
    document.getElementById('tremoloPickingSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('addTremoloPickingModal');
        const notesBefore = menuHandler.handleEffectGroupCollision(arr.notes, 'tremoloPicking', isVariableSet);
        for (const no of arr.notes) {
          const { note } = no;
          const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
          if (!note.tremoloPicking) {
            note.tremoloPicking = true;
            if (no.blockId === tab.markedNoteObj.blockId
              && no.beatId === tab.markedNoteObj.beatId) {
              menuHandler.activateEffectsForNote(note);
            }
          }
          const pickingLengthBefore = note.tremoloPickingLength;
          note.tremoloPickingLength = this.tremoloPickingModalData.tremoloPickingLength;
          revertHandler.addTremoloPicking(no.trackId, no.blockId, no.voiceId, no.beatId,
            no.string, pickingLengthBefore, note.tremoloPickingLength,
            tremoloPickingPresentBefore[noteStr], note.tremoloPicking, notesBefore[noteStr]);
        }
        const { trackId, voiceId } = arr.notes[0];
        svgDrawer.rerenderBlocks(trackId, arr.blocks, voiceId);
      });
    };
    this.displayModal('addTremoloPickingModal', 'Tremolo Picking');
  }

  setStrokeState(beat: Measure) {
    this.strokeModalData.strokeLength = 8;
    this.strokeModalData.strokeType = 'up';

    if (beat.effects.stroke.strokeLength != null) {
      this.strokeModalData.strokeLength = beat.effects.stroke.strokeLength;
    }
    if (beat.effects.stroke.strokeType != null) {
      this.strokeModalData.strokeType = beat.effects.stroke.strokeType;
    }
    const strokeDirectionSelectionDom = document.getElementById('strokeDirectionSelection') as HTMLSelectElement;
    const strokeLengthSelectionDom = document.getElementById('strokeLengthSelection') as HTMLSelectElement;
    strokeDirectionSelectionDom.value = this.strokeModalData.strokeType;
    console.log('Setting length', this.strokeModalData.strokeLength.toString());
    strokeLengthSelectionDom.value = this.strokeModalData.strokeLength.toString();
  }

  openStrokeModal(arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
  }) {
    const beatFirst = arr.beats[0].beat;
    const strokePresentBefore: {[a: string]: boolean} = {};
    const { beats } = arr;
    for (const be of beats) {
      const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
      strokePresentBefore[beatStr] = be.beat.effects.strokePresent;
    }
    this.setStrokeState(beatFirst);

    const strokeDirectionSelectionDom = document.getElementById('strokeDirectionSelection') as HTMLSelectElement;
    const strokeLengthSelectionDom = document.getElementById('strokeLengthSelection') as HTMLSelectElement;
    strokeDirectionSelectionDom.onchange = null;
    strokeDirectionSelectionDom.onchange = () => {
      this.strokeModalData.strokeType = strokeDirectionSelectionDom.options[strokeDirectionSelectionDom.selectedIndex].value as 'up' | 'down';
    };
    strokeLengthSelectionDom.onchange = null;
    strokeLengthSelectionDom.onchange = () => {
      this.strokeModalData.strokeLength = parseInt(
        strokeLengthSelectionDom.options[strokeLengthSelectionDom.selectedIndex].value,
        10,
      );
    };
    document.getElementById('strokeSelectButton')!.onclick = null;
    document.getElementById('strokeSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('addStrokeModal');
        for (const be of arr.beats) {
          const { beat } = be;
          const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
          const strokeBefore = beat.effects.stroke;
          beat.effects.stroke = {
            strokeType: this.strokeModalData.strokeType,
            strokeLength: this.strokeModalData.strokeLength,
          };

          if (!beat.effects.strokePresent) {
            beat.effects.strokePresent = true;
            MenuHandler.activateEffectsForBeat(beat);
          }
          revertHandler.addStroke(be.trackId, be.blockId, be.voiceId, be.beatId, strokeBefore,
            beat.effects.stroke, strokePresentBefore[beatStr], beat.effects.strokePresent);
        }
        const { trackId } = arr.beats[0];
        const { voiceId } = arr.beats[0];
        svgDrawer.rerenderBlocks(trackId, arr.blocks, voiceId);
      });
    };
    this.displayModal('addStrokeModal', 'Stroke');
  }

  setTextState(beat: Measure) {
    this.textModalData.text = '';
    if (beat.text != null) {
      this.textModalData.text = beat.text;
    }
    const textSelectionDom = document.getElementById('textSelection') as HTMLInputElement;
    textSelectionDom.value = this.textModalData.text;
  }

  openTextModal(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    this.setTextState(beat);

    const textSelectionDom = document.getElementById('textSelection') as HTMLInputElement;
    textSelectionDom.onchange = null;
    textSelectionDom.onchange = () => {
      this.textModalData.text = textSelectionDom.value;
    };
    document.getElementById('textSelectButton')!.onclick = null;
    document.getElementById('textSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        const textPresentBefore = beat.textPresent;
        const textBefore = beat.text;
        if (!beat.textPresent) {
          beat.textPresent = true;
          MenuHandler.activateEffectsForBeat(beat);
        }

        this.closeModal('addTextModal');

        beat.text = this.textModalData.text;
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
        revertHandler.addText(trackId, blockId, voiceId, beatId,
          textBefore, beat.text, textPresentBefore, beat.textPresent);
      });
    };
    this.displayModal('addTextModal', 'Text');
  }

  setRepititionState(blockId: number) {
    this.repititionModalData.numRepititions = 1;

    const { repeatClose } = Song.measureMeta[blockId];
    if (repeatClose != null) {
      this.repititionModalData.numRepititions = repeatClose;
    }
    const numberOfRepititionsInputDom = document.getElementById('numberOfRepititionsInput') as HTMLInputElement;
    numberOfRepititionsInputDom.value = this.repititionModalData.numRepititions.toString();
  }

  openRepititionNumberModal(trackId: number, blockId: number, voiceId: number) {
    this.setRepititionState(blockId);

    const numberOfRepititionsInputDom = document.getElementById('numberOfRepititionsInput') as HTMLInputElement;
    numberOfRepititionsInputDom.onchange = null;
    numberOfRepititionsInputDom.onchange = () => {
      this.repititionModalData.numRepititions = parseInt(numberOfRepititionsInputDom.value, 10);
    };
    document.getElementById('repititionSelectButton')!.onclick = null;
    document.getElementById('repititionSelectButton')!.onclick = () => {
      const repeatClosePresentBefore = Song.measureMeta[blockId].repeatClosePresent;
      if (!repeatClosePresentBefore) {
        Song.measureMeta[blockId].repeatClosePresent = true;
        MenuHandler.activateEffectsForBlock();
      }
      this.closeModal('numberOfRepititionsModal');
      const repeatCloseBefore = Song.measureMeta[blockId].repeatClose;
      Song.measureMeta[blockId].repeatClose = this.repititionModalData.numRepititions;
      revertHandler.addRepeatClose(trackId, blockId, repeatCloseBefore,
        Song.measureMeta[blockId].repeatClose, repeatClosePresentBefore,
        Song.measureMeta[blockId].repeatClosePresent);
      svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    };
    this.displayModal('numberOfRepititionsModal', 'Repitition');
  }

  setTimeMeterState(blockId: number) {
    this.timeMeterData.denominator = 4;
    this.timeMeterData.numerator = 4;
    if (Song.measureMeta[blockId].denominator != null) {
      this.timeMeterData.denominator = Song.measureMeta[blockId].denominator;
    }
    if (Song.measureMeta[blockId].numerator != null) {
      this.timeMeterData.numerator = Song.measureMeta[blockId].numerator;
    }
    const denominatorSelectionDom = document.getElementById('denominatorSelection') as HTMLInputElement;
    const numeratorSelectionDom = document.getElementById('numeratorSelection') as HTMLInputElement;
    denominatorSelectionDom.value = this.timeMeterData.denominator.toString();
    numeratorSelectionDom.value = this.timeMeterData.numerator.toString();
  }

  openTimeMeterModal(trackId: number, blockId: number, voiceId: number) {
    this.setTimeMeterState(blockId);

    const denominatorSelectionDom = document.getElementById('denominatorSelection') as HTMLInputElement;
    const numeratorSelectionDom = document.getElementById('numeratorSelection') as HTMLInputElement;
    numeratorSelectionDom.onchange = null;
    numeratorSelectionDom.onchange = () => {
      this.timeMeterData.numerator = parseInt(numeratorSelectionDom.value, 10);
    };
    denominatorSelectionDom.onchange = null;
    denominatorSelectionDom.onchange = () => {
      this.timeMeterData.denominator = parseInt(denominatorSelectionDom.value, 10);
    };

    document.getElementById('timeMeterSelectButton')!.onclick = null;
    document.getElementById('timeMeterSelectButton')!.onclick = () => {
      Song.measureMeta[blockId].timeMeterPresent = true;
      this.closeModal('timeMeterModal');
      // TODO arrays
      const numeratorBefore = Song.measureMeta[blockId].numerator;
      const denominatorBefore = Song.measureMeta[blockId].denominator;

      Song.measureMeta[blockId].numerator = this.timeMeterData.numerator;
      Song.measureMeta[blockId].denominator = this.timeMeterData.denominator;

      const notesBefore = AppManager.checkAndAdaptTimeMeter(blockId);
      if (notesBefore == null) {
        Song.measureMeta[blockId].numerator = numeratorBefore;
        Song.measureMeta[blockId].denominator = denominatorBefore;
        Song.measureMeta[blockId].timeMeterPresent = false;
        return;
      }
      // Set until the end of track/ next timeMeter
      for (let bId = blockId + 1; bId < Song.measureMeta.length; bId += 1) {
        if (Song.measureMeta[bId].timeMeterPresent) break;
        Song.measureMeta[bId].numerator = Song.measureMeta[blockId].numerator;
        Song.measureMeta[bId].denominator = Song.measureMeta[blockId].denominator;
      }

      const { numerator, denominator } = Song.measureMeta[blockId];
      revertHandler.addTimeMeter(trackId, blockId, voiceId, numeratorBefore,
        numerator, denominatorBefore, denominator, false, true, notesBefore);

      tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    };
    this.displayModal('timeMeterModal', 'Time Meter');
  }

  removeEventListenersTempo() {
    document.body.classList.remove('disableMouseEffects');
    document.removeEventListener('mousemove', this.tempoFuncBinded);
    document.removeEventListener('mouseup', this.remTempoBinded);
  }

  changeTempoFunc(event: MouseEvent) {
    const tempoMeter = document.getElementById('tempoMeterModal')!;
    console.log('Second');
    const mouseYnew = event.pageY;

    this.bpmData = this.oldBpm + this.initYPosModal - mouseYnew;
    this.bpmData = Math.max(this.bpmData, 10);
    this.bpmData = Math.min(this.bpmData, 180);

    tempoMeter.textContent = this.bpmData.toString();
  }

  openBpmModal(trackId: number, blockId: number, voiceId: number) {
    this.bpmData = 90;
    document.getElementById('tempoMeterModal')!.textContent = this.bpmData.toString();
    document.getElementById('tempoMeterModal')!.onmousedown = null;
    document.getElementById('tempoMeterModal')!.onmousedown = (e) => {
      console.log('First');
      this.initYPosModal = e.pageY;
      this.oldBpm = this.bpmData;

      document.querySelector('body')!.classList.add('disableMouseEffects');
      this.tempoFuncBinded = this.changeTempoFunc.bind(this);
      this.remTempoBinded = this.removeEventListenersTempo.bind(this);
      document.addEventListener('mousemove', this.tempoFuncBinded);
      document.addEventListener('mouseup', this.remTempoBinded);
    };

    document.getElementById('bpmSelectButton')!.onclick = null;
    document.getElementById('bpmSelectButton')!.onclick = () => {
      const { bpmPresent } = Song.measureMeta[blockId];
      if (!bpmPresent) {
        Song.measureMeta[blockId].bpmPresent = true;
        MenuHandler.activateEffectsForBlock();
      }
      this.closeModal('bpmModal');
      const bpmBefore = Song.measureMeta[blockId].bpm;
      Song.measureMeta[blockId].bpm = this.bpmData;

      revertHandler.addBpmMeter(trackId, blockId, voiceId, bpmPresent,
        Song.measureMeta[blockId].bpmPresent, bpmBefore, Song.measureMeta[blockId].bpm);

      if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
      }
    };
    this.displayModal('bpmModal', 'BPM');
  }

  setMarkerState(blockId: number) {
    this.markerModalData.text = '';
    this.markerModalData.color = { red: 255, blue: 0, green: 0 };
    const { marker } = Song.measureMeta[blockId];
    if (marker != null) {
      this.markerModalData.text = marker.text;
      this.markerModalData.color = marker.color;
    }
    (document.getElementById('markerSelection') as HTMLInputElement).value = this.markerModalData.text;
    const pickerParent = document.getElementById('markerColorPicker');
    const picker = new Picker({
      parent: pickerParent!,
      color: `rgb(${this.markerModalData.color.red},${this.markerModalData.color.green},${this.markerModalData.color.blue})`,
      popup: false,
    });
    picker.onChange = (color: {rgba: number[]}) => {
      this.markerModalData.color = {
        red: color.rgba[0],
        green: color.rgba[1],
        blue: color.rgba[2],
      };
    };
  }

  openMarkerModal(trackId: number, blockId: number, voiceId: number) {
    this.setMarkerState(blockId);
    const markerSelection = document.getElementById('markerSelection') as HTMLInputElement;
    markerSelection.onchange = null;
    markerSelection.onchange = () => {
      this.markerModalData.text = markerSelection.value;
    };
    document.getElementById('markerSelectButton')!.onclick = null;
    document.getElementById('markerSelectButton')!.onclick = () => {
      const markerPresentBefore = Song.measureMeta[blockId].markerPresent != null
        && Song.measureMeta[blockId].markerPresent;
      if (!Song.measureMeta[blockId].markerPresent) {
        Song.measureMeta[blockId].markerPresent = true;
        MenuHandler.activateEffectsForBlock();
      }
      this.closeModal('addMarkerModal');
      const markerBefore = Song.measureMeta[blockId].marker;
      Song.measureMeta[blockId].marker = {
        text: this.markerModalData.text,
        color: this.markerModalData.color,
      };
      revertHandler.addMarker(trackId, blockId, markerBefore, Song.measureMeta[blockId].marker,
        markerPresentBefore, Song.measureMeta[blockId].markerPresent);
      Sequencer.setMarker(blockId);
      svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    };
    this.displayModal('addMarkerModal', 'Marker');
  }

  setChordState(chord: Chord | null) {
    // default values
    const chordRoot = 'C';
    const chordType = 'maj';
    this.chordModalData.chordRoot = chordRoot;
    this.chordModalData.chordType = chordType;
    this.chordProperties.name = 'Cmaj';
    this.chordProperties.currentNotes = this.allChords[chordRoot][chordType].notes;
    this.chordProperties.capo = 1;
    // already set values
    this.chordProperties.fingers = [];
    if (chord != null) {
      this.chordModalData.chordRoot = chord.chordRoot;
      this.chordModalData.chordType = chord.chordType;
      this.chordProperties.name = chord.name;
      for (let i = 0; i < 6; i += 1) {
        this.chordProperties.currentNotes[i] = chord.frets[i];
        if (chord.frets[i] > 0) {
          this.chordProperties.currentNotes[i] -= (chord.capo - 1);
          // console.log(this.chordProperties.currentNotes[i]);
        }
      }
      this.chordProperties.capo = chord.capo;
    }
    (document.getElementById('chordRootSelection') as HTMLSelectElement).value = this.chordModalData.chordRoot;
    (document.getElementById('chordTypeSelection') as HTMLSelectElement).value = this.chordModalData.chordType;
    (document.getElementById('chordNameInput') as HTMLInputElement).value = this.chordProperties.name;

    this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
      this.chordProperties.fingers);
  }

  fillChordsPresets(trackId: number) {
    const usedChordSelection = document.getElementById('usedChordSelection') as HTMLSelectElement;
    Helper.removeAllChildren(usedChordSelection);
    for (const chord of Song.chordsMap[trackId].values()) {
      const chordOption = document.createElement('option');
      chordOption.setAttribute('value', chord.name);
      chordOption.textContent = chord.name;
      usedChordSelection.appendChild(chordOption);
    }
    usedChordSelection.onfocus = () => {
      usedChordSelection.selectedIndex = -1;
    };
    usedChordSelection.onchange = () => {
      const chordName = usedChordSelection.options[usedChordSelection.selectedIndex].value;
      const chord = Song.chordsMap[trackId].get(chordName);
      if (chord != null) {
        (document.getElementById('chordRootSelection') as HTMLInputElement).value = chord.chordRoot;
        (document.getElementById('chordTypeSelection') as HTMLInputElement).value = chord.chordType;
        (document.getElementById('chordNameInput') as HTMLInputElement).value = chord.name;
        this.chordModalData.chordRoot = chord.chordRoot;
        this.chordModalData.chordType = chord.chordType;
        this.chordProperties.name = chord.name;

        const notes = ModalHandler.computeNotesFromFretAndCapo(chord.frets, chord.capo);
        this.drawChord(chord.capo, notes, chord.fingers);
      }
    };
  }

  openChordModalGlobal(trackId: number) {
    if (this.chordModalData.bound == null) {
      const chordRootSelectionDom = document.getElementById('chordRootSelection') as HTMLSelectElement;
      const chordTypeSelectionDom = document.getElementById('chordTypeSelection') as HTMLSelectElement;
      const chordCapoInputDom = document.getElementById('chordCapoInput') as HTMLInputElement;
      const chordNameInputDom = document.getElementById('chordNameInput') as HTMLInputElement;
      chordRootSelectionDom.onchange = () => {
        this.chordModalData.chordRoot = chordRootSelectionDom.options[
          chordRootSelectionDom.selectedIndex].value;
        this.drawChordPreset(this.chordModalData.chordRoot, this.chordModalData.chordType);
      };
      chordTypeSelectionDom.onchange = () => {
        this.chordModalData.chordType = chordTypeSelectionDom.options[
          chordTypeSelectionDom.selectedIndex].value;
        this.drawChordPreset(this.chordModalData.chordRoot, this.chordModalData.chordType);
      };
      chordCapoInputDom.oninput = () => {
        this.chordProperties.capo = parseInt(chordCapoInputDom.value, 10) + 1;
        this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
          this.chordProperties.fingers);
      };
      chordNameInputDom.onkeyup = () => {
        this.chordProperties.name = chordNameInputDom.value;
      };
      this.drawChordEditor();
      this.chordModalData.bound = true;
    }
    this.fillChordsPresets(trackId);
    this.setChordState(null);
    document.getElementById('chordSelectButton')!.onclick = null;
    document.getElementById('chordSelectButton')!.onclick = () => {
      this.closeModal('addChordModal');
      const chordObj = {
        capo: this.chordProperties.capo,
        name: this.chordProperties.name,
        chordRoot: this.chordModalData.chordRoot,
        chordType: this.chordModalData.chordType,
        frets: [] as number[],
      };
      const notes = this.chordProperties.currentNotes;
      chordObj.frets = ModalHandler.computeFretsFromNotesAndCapo(notes, chordObj.capo);
      if (Song.chordsMap[trackId] == null) {
        Song.chordsMap[trackId] = new Map();
      }
      if (Song.chordsMap[trackId].has(chordObj.name)) {
        Song.chordsMap[trackId].set(chordObj.name, {
          ...chordObj,
          fingers: this.chordProperties.fingers,
          display: true,
        });
        this.fillChordsPresets(trackId);
        this.createChordManager(trackId);
        svgDrawer.redrawChordDiagrams();
      }
    };
    this.displayModal('addChordModal', 'Chord');
  }

  static computeNotesFromFretAndCapo(frets: number[], capo: number) {
    const notes = [];
    for (let i = 0; i < 6; i += 1) {
      notes[5 - i] = frets[i];
      if (frets[i] > 0) {
        notes[5 - i] -= (capo - 1);
      }
    }
    return notes;
  }

  static computeFretsFromNotesAndCapo(notes: number[], capo: number) {
    const frets = [];
    frets[6] = -1;
    for (let i = 0; i < 6; i += 1) {
      frets[5 - i] = notes[i];
      if (notes[i] >= 0) {
        frets[5 - i] += (capo - 1);
      }
    }
    return frets;
  }

  openChordModal(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (this.chordModalData.bound == null) {
      const chordRootSelectionDom = document.getElementById('chordRootSelection') as HTMLSelectElement;
      const chordTypeSelectionDom = document.getElementById('chordTypeSelection') as HTMLSelectElement;
      const chordCapoInputDom = document.getElementById('chordCapoInput') as HTMLInputElement;
      const chordNameInputDom = document.getElementById('chordNameInput') as HTMLInputElement;
      chordRootSelectionDom.onchange = () => {
        this.chordModalData.chordRoot = chordRootSelectionDom.options[
          chordRootSelectionDom.selectedIndex].value;
        this.drawChordPreset(this.chordModalData.chordRoot, this.chordModalData.chordType);
      };
      chordTypeSelectionDom.onchange = () => {
        this.chordModalData.chordType = chordTypeSelectionDom.options[
          chordTypeSelectionDom.selectedIndex].value;
        this.drawChordPreset(this.chordModalData.chordRoot, this.chordModalData.chordType);
      };
      chordCapoInputDom.oninput = () => {
        this.chordProperties.capo = parseInt(chordCapoInputDom.value, 10) + 1;
        this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
          this.chordProperties.fingers);
      };
      chordNameInputDom.onkeyup = () => {
        this.chordProperties.name = chordNameInputDom.value;
      };
      this.drawChordEditor();
      this.chordModalData.bound = true;
    }
    this.setChordState(beat.chord);

    document.getElementById('chordSelectButton')!.onclick = null;
    document.getElementById('chordSelectButton')!.onclick = () => {
      this.closeModal('addChordModal');
      const chordPresentBefore = beat.chordPresent;
      const chordObj = {
        capo: this.chordProperties.capo,
        name: this.chordProperties.name,
        chordRoot: this.chordModalData.chordRoot,
        chordType: this.chordModalData.chordType,
        frets: [] as number[],
        fingers: [],
        display: false,
      };

      if (!beat.chordPresent) {
        beat.chordPresent = true;
        MenuHandler.activateEffectsForBeat(beat);
      }
      // transfer
      chordObj.frets = ModalHandler.computeFretsFromNotesAndCapo(this.chordProperties.currentNotes,
        chordObj.capo);
      const previousChord = beat.chord;
      beat.chord = chordObj;

      let trackRerendered = false;
      if (Song.chordsMap[trackId] == null) {
        Song.chordsMap[trackId] = new Map();
      }
      if (Song.chordsMap[trackId].has(chordObj.name)) {
        Song.chordsMap[trackId].set(chordObj.name, {
          ...chordObj,
          fingers: this.chordProperties.fingers,
          display: true,
        });
        this.fillChordsPresets(trackId);
        this.createChordManager(trackId);
        trackRerendered = svgDrawer.redrawChordDiagrams();
      }
      if (!trackRerendered) {
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
      }
      if (previousChord != null) {
        revertHandler.addChord(trackId, blockId, voiceId, beatId, previousChord,
          chordObj, chordPresentBefore, beat.chordPresent);
      }
    };
    this.displayModal('addChordModal', 'Chord');
  }

  setGraceState(note: Note) {
    // standard values
    this.graceModalData.fret = 0;
    this.graceModalData.duration = 's';
    this.graceModalData.dynamic = 'f';
    this.graceModalData.transition = 'none';
    this.graceModalData.setOnBeat = 'before';

    const grace = note.graceObj;
    if (grace != null) {
      this.graceModalData.fret = grace.fret;
      this.graceModalData.duration = grace.duration;
      this.graceModalData.dynamic = grace.dynamic;
      this.graceModalData.transition = grace.transition;
      this.graceModalData.setOnBeat = grace.setOnBeat;
    }
    const graceLengthSelectionDom = document.getElementById('graceLengthSelection') as HTMLSelectElement;
    const graceTimeSelectionDom = document.getElementById('graceTimeSelection') as HTMLSelectElement;
    const graceDynamicSelectionDom = document.getElementById('graceDynamicSelection') as HTMLSelectElement;
    const graceTransitionSelectionDom = document.getElementById('graceTransitionSelection') as HTMLSelectElement;
    const graceFretInputDom = document.getElementById('graceFretInput') as HTMLSelectElement;
    graceLengthSelectionDom.value = this.graceModalData.duration;
    graceTimeSelectionDom.value = this.graceModalData.setOnBeat ? 'with' : 'before';
    graceDynamicSelectionDom.value = this.graceModalData.dynamic;
    graceTransitionSelectionDom.value = this.graceModalData.transition;
    graceFretInputDom.value = this.graceModalData.fret.toString();
  }

  openGraceModal(arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
      beat: Measure}[]
  }) {
    const { note } = arr.notes[0];
    const gracePresentBefore: {[n: string]: boolean} = {};
    for (const no of arr.notes) {
      const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      gracePresentBefore[noteStr] = no.note.gracePresent;
    }
    this.setGraceState(note);
    const graceLengthSelectionDom = document.getElementById('graceLengthSelection') as HTMLSelectElement;
    const graceTimeSelectionDom = document.getElementById('graceTimeSelection') as HTMLSelectElement;
    const graceDynamicSelectionDom = document.getElementById('graceDynamicSelection') as HTMLSelectElement;
    const graceTransitionSelectionDom = document.getElementById('graceTransitionSelection') as HTMLSelectElement;
    const graceFretInputDom = document.getElementById('graceFretInput') as HTMLInputElement;
    if (this.graceModalData.bound == null) {
      graceLengthSelectionDom.onchange = () => {
        this.graceModalData.duration = graceLengthSelectionDom.options[
          graceLengthSelectionDom.selectedIndex].value;
      };
      graceTimeSelectionDom.onchange = () => {
        this.graceModalData.setOnBeat = graceTimeSelectionDom.options[
          graceTimeSelectionDom.selectedIndex].value;
      };
      graceDynamicSelectionDom.onchange = () => {
        this.graceModalData.dynamic = graceDynamicSelectionDom.options[
          graceDynamicSelectionDom.selectedIndex].value;
      };
      graceTransitionSelectionDom.onchange = () => {
        this.graceModalData.transition = graceTransitionSelectionDom.options[
          graceTransitionSelectionDom.selectedIndex].value;
      };
      graceFretInputDom.onchange = () => {
        const fretIn = graceFretInputDom.value;
        if (Helper.isInt(fretIn)) {
          this.graceModalData.fret = parseInt(fretIn, 10);
        }
      };
      this.graceModalData.bound = true;
    }
    document.getElementById('graceSelectButton')!.onclick = null;
    document.getElementById('graceSelectButton')!.onclick = () => {
      fastdom.mutate(() => {
        this.closeModal('addGraceModal');
        for (const no of arr.notes) {
          const noteInArr = no.note;
          const graceObjBefore = noteInArr.graceObj;

          const graceObj = {
            duration: this.graceModalData.duration,
            setOnBeat: this.graceModalData.setOnBeat,
            dynamic: this.graceModalData.dynamic,
            transition: this.graceModalData.transition,
            fret: this.graceModalData.fret,
            string: 0,
            height: 0,
            dead: false,
          };
          noteInArr.graceObj = graceObj;

          if (!noteInArr.gracePresent) {
            noteInArr.gracePresent = true;
            menuHandler.activateEffectsForNote(noteInArr);
          }
          const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
          revertHandler.addGrace(no.trackId, no.blockId, no.voiceId, no.beatId, no.string,
            // TODO turned undefined grace into noteInArr.grace. Is that correct?
            graceObjBefore, noteInArr.graceObj, gracePresentBefore[noteStr],
            noteInArr.gracePresent);
        }
        const { trackId } = arr.notes[0];
        const { voiceId } = arr.notes[0];
        classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
        svgDrawer.rerenderBlocks(trackId, arr.blocks, voiceId);
      });
    };
    this.displayModal('addGraceModal', 'Grace');
  }

  openTremoloBarModal(arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
        beat: Measure}[]
    }, isVariableSet: boolean) {
    // Extract beats
    const { beat } = arr.beats[0];
    const tremoloBarPresentBefore: Map<string, boolean> = new Map();
    for (const be of arr.beats) {
      const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
      tremoloBarPresentBefore.set(beatStr, be.beat.effects.tremoloBarPresent);
    }
    fastdom.measure(() => {
      this.tremoloEditorClientWidth = document.getElementById('tremoloEditor')!.clientWidth;
      fastdom.mutate(() => {
        const tremoloEditor = document.getElementById('tremoloEditor')!;
        Helper.removeAllChildren(tremoloEditor);
        this.tremoloPointsArr.length = 0;
        const padding = 20;
        const width = this.tremoloEditorClientWidth - 2 * padding;
        console.log(this.tremoloEditorClientWidth);
        const height = 300 - 2 * padding; // px

        // 3px border around svg
        const rect = SvgDrawer.createRect(padding, padding, width, height, '', '1', '');
        tremoloEditor.appendChild(rect);

        // axis
        let counter = 4;
        for (let i = 0; i <= this.NUM_ROWS_TREMOLO / 2; i += 1) {
          const textNum = (counter > 0) ? `+${counter}` : counter.toString();
          const textHeight = padding + (i * height) / (this.NUM_ROWS_TREMOLO / 2);
          tremoloEditor.appendChild(SvgDrawer.createText(0, textHeight, textNum, '12px', ''));
          counter -= 1;
        }
        // Draw vertical lines
        for (let i = 0; i < this.NUM_COLUMNS_TREMOLO - 1; i += 1) {
          const xPos = (width / this.NUM_COLUMNS_TREMOLO) * (i + 1) + padding;
          const pathStr = `M${xPos} ${padding}L${xPos} ${height + padding}`;
          let stroke = 'rgb(60, 60, 60)';
          if ((i + 1) % 3 !== 0) stroke = 'rgb(185, 185, 185)';
          const pathEl = SvgDrawer.createPath(pathStr, stroke, '1', 'none');
          if ((i + 1) % 3 !== 0) {
            pathEl.setAttribute('class', 'gridLine');
          } else {
            pathEl.setAttribute('class', 'strongGridLine');
          }
          tremoloEditor.appendChild(pathEl);
        }

        // draw horizontal lines 2*6
        for (let i = 0; i < this.NUM_ROWS_TREMOLO - 1; i += 1) {
          const yPos = (height / this.NUM_ROWS_TREMOLO) * (i + 1) + padding;
          const pathStr = `M${padding} ${yPos}L${width + padding} ${yPos}`;
          const pathEl = (i + 1) % 2 !== 0
            ? SvgDrawer.createPath(pathStr, 'rgb(185, 185, 185)', '1', 'none')
            : SvgDrawer.createPath(pathStr, 'rgb(60, 60, 60)', '1', 'none');
          if ((i + 1) % 2 !== 0) {
            pathEl.setAttribute('strokeDasharray', '5, 5');
            pathEl.setAttribute('class', 'gridLine');
          } else {
            pathEl.setAttribute('class', 'strongGridLine');
          }
          tremoloEditor.appendChild(pathEl);
        }
        // draw blue points
        this.tremoloPointsOnLine.length = 0;
        for (let i = 0; i <= this.NUM_COLUMNS_TREMOLO; i += 1) {
          this.tremoloPointsOnLine[i] = null;
        }

        const { tremoloBar } = beat.effects;
        if (tremoloBar == null) {
          this.applyTremoloPreset(0, padding, width, height, []);
        } else {
          const preset: {x: number, y: number}[] = [];
          for (let i = 0; i < tremoloBar.length; i += 1) {
            if (tremoloBar[i] != null) {
              preset.push({
                x: tremoloBar[i].position / 5,
                y: (tremoloBar[i].value + 800) / 50,
              });
            }
          }
          this.applyTremoloPreset(0, padding, width, height, preset);
        }

        // connect Points
        this.connectAllTremoloPoints(tremoloEditor);

        if (!this.tremoloBarModalData.bound) {
          document.getElementById('tremoloEditor')!.onmousedown = (e) => {
            fastdom.measure(() => {
              const t = document.getElementById('tremoloEditor')!.getBoundingClientRect();
              this.mouseOffsetX = e.clientX - t.left;
              this.mouseOffsetY = e.clientY - t.top;
            });
            fastdom.mutate(() => {
              console.log(this.mouseOffsetX);
              console.log(this.mouseOffsetY);

              const xPos = Math.min(Math.max(this.mouseOffsetX - padding, 0), width);
              const yPos = Math.min(Math.max(this.mouseOffsetY - padding, 0), height);
              const oneXPort = width / this.NUM_COLUMNS_TREMOLO;
              const oneYPort = height / this.NUM_ROWS_TREMOLO;
              const xIndex = Math.round(xPos / oneXPort);
              const yIndex = Math.round(yPos / oneYPort);
              const xNearest = xIndex * oneXPort;
              const yNearest = yIndex * oneYPort;

              let samePoint = false;
              const pointToRemove = this.tremoloPointsOnLine[xIndex];
              if (pointToRemove != null) {
                if (pointToRemove[0].parentNode != null) {
                  pointToRemove[0].parentNode.removeChild(pointToRemove[0]);
                }
                samePoint = (this.NUM_ROWS_TREMOLO - yIndex === pointToRemove[1]);
                this.tremoloPointsOnLine[xIndex] = null;
              }
              if (!samePoint) {
                const point = ModalHandler.drawPoint(xNearest, yNearest, padding,
                  padding, 7, tremoloEditor, '');
                this.tremoloPointsOnLine[xIndex] = [point, this.NUM_ROWS_TREMOLO - yIndex, xIndex];
              }
              this.connectAllTremoloPoints(tremoloEditor);
            });
          };
          const tremoloSelectionDom = document.getElementById('tremoloSelection') as HTMLSelectElement;
          tremoloSelectionDom.onchange = () => {
            fastdom.mutate(() => {
              const val = tremoloSelectionDom.options[tremoloSelectionDom.selectedIndex].value;
              this.applyTremoloPreset(parseInt(val, 10), padding, width, height, []);
            });
          };
        }

        document.getElementById('tremoloSelectButton')!.onclick = null;
        document.getElementById('tremoloSelectButton')!.onclick = () => {
          fastdom.mutate(() => {
            this.closeModal('tremoloModalEditor');
            const beatsBefore = menuHandler.handleEffectGroupCollisionBeat(arr.beats, 'tremoloBar', isVariableSet);
            for (const be of arr.beats) {
              const beatInner = be.beat;
              const tremoloBarBefore = beatInner.effects.tremoloBar;
              const tremoloBarObjInner: TremoloBar = [];
              for (let i = 0; i < this.tremoloPointsOnLine.length; i += 1) {
                const currentPoint = this.tremoloPointsOnLine[i];
                if (currentPoint != null) {
                  tremoloBarObjInner.push({
                    position: currentPoint[2] * 5,
                    value: currentPoint[1] * 50 - 800,
                    vibrato: 0,
                  });
                }
              }
              beatInner.effects.tremoloBar = tremoloBarObjInner;

              if (!beatInner.effects.tremoloBarPresent) {
                beatInner.effects.tremoloBarPresent = true;
                MenuHandler.activateEffectsForBeat(beatInner);
              }
              const beatStrInner = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
              revertHandler.addTremoloBar(
                be.trackId, be.blockId, be.voiceId, be.beatId,
                tremoloBarBefore, beatInner.effects.tremoloBar,
                tremoloBarPresentBefore.get(beatStrInner) ?? false,
                beatInner.effects.tremoloBarPresent,
                beatsBefore[beatStrInner],
              );
            }
            svgDrawer.rerenderBlocks(arr.beats[0].trackId, arr.blocks, arr.beats[0].voiceId);
          });
        };
        this.tremoloBarModalData.bound = true;
      });
    });
    this.displayModal('tremoloModalEditor', 'Tremolo');
  }

  drawChordEditor() {
    const chordDisplay = document.getElementById('chordDisplay')!;
    const { paddingRight } = this.chordProperties;
    const { paddingLeft } = this.chordProperties;
    const { width } = this.chordProperties;
    const { height } = this.chordProperties;
    const { stringPadding } = this.chordProperties;

    const rect = SvgDrawer.createRect(paddingLeft, paddingRight, width, height, '', '1', '');
    chordDisplay.appendChild(rect);

    // draw left side
    const pathEl = SvgDrawer.createPath(`M${paddingLeft} ${paddingRight}V${height + paddingRight}`, 'rgb(0, 0, 0)', '3', 'none');
    chordDisplay.appendChild(pathEl);
    // Draw 5 frets
    const HOSTEPS = this.chordProperties.horizontalSteps;
    for (let i = 0; i < HOSTEPS; i += 1) {
      const xPos = (width / HOSTEPS) * (i + 1) + paddingLeft;
      const pathStr = `M${xPos} ${paddingRight}L${xPos} ${height + paddingRight}`;
      const fretEl = SvgDrawer.createPath(pathStr, 'rgb(180, 180, 180)', '1', 'none');
      fretEl.setAttribute('class', 'gridLine');
      chordDisplay.appendChild(fretEl);
    }
    // draw horizontal lines
    const NUMSTRINGS = this.chordProperties.numStrings;
    for (let i = 0; i < NUMSTRINGS; i += 1) {
      const yPos = ((height - 2 * stringPadding) / (NUMSTRINGS - 1)) * i
        + stringPadding + paddingRight;
      const pathStr = `M${paddingLeft} ${yPos}L${width + paddingLeft} ${yPos}`;
      const stringEl = SvgDrawer.createPath(pathStr, 'rgb(60, 60, 60)', '1', 'none');
      stringEl.setAttribute('class', 'strongGridLine');
      stringEl.style.pointerEvents = 'none';
      chordDisplay.appendChild(stringEl);
    }
    // name notes
    const noteNames = ['E', 'A', 'D', 'G', 'H', 'E'];
    for (let i = 0; i < NUMSTRINGS; i += 1) {
      const y = ((height - 2 * stringPadding) / (NUMSTRINGS - 1)) * i
        + stringPadding + paddingRight + 3;
      chordDisplay.appendChild(SvgDrawer.createText(0, y, noteNames[NUMSTRINGS - 1 - i], '12px', '', 'Source Sans Pro'));
    }
    rect.addEventListener('mousedown', (e: MouseEvent) => {
      const fret = (Math.floor((e.offsetX - paddingLeft) / width) * HOSTEPS) + 1;
      const string = (Math.round(((e.offsetY - paddingRight) - stringPadding)
        / (height - 2 * stringPadding)) * (NUMSTRINGS - 1));
      if (string >= 0 && string < NUMSTRINGS) {
        const { currentNotes } = this.chordProperties;
        currentNotes[NUMSTRINGS - string - 1] = fret;
        this.drawChord(this.chordProperties.capo, currentNotes, this.chordProperties.fingers);
      }
    });
    this.drawChordPreset('C', 'maj');
  }

  drawChordPreset(chordNoteName: string, chordType: string) {
    const chord = this.allChords[chordNoteName][chordType].notes;
    const { fingers } = this.allChords[chordNoteName][chordType];
    this.chordProperties.name = `${chordNoteName}${chordType}`;
    (document.getElementById('chordNameInput') as HTMLInputElement).value = `${chordNoteName}${chordType}`;
    if (chord == null) {
      return;
    }
    this.drawChord(this.allChords[chordNoteName][chordType].capo + 1, chord, fingers);
  }

  drawChord(capo: number, chord: number[], fingers: (number | null)[]) {
    const chordDisplay = document.getElementById('chordDisplay')!;
    for (let i = 0, n = this.chordDisplayObjects.length; i < n; i += 1) {
      const chordDisplayObjs = this.chordDisplayObjects[i];
      if (chordDisplayObjs != null && chordDisplayObjs.parentNode != null) {
        chordDisplayObjs.parentNode.removeChild(this.chordDisplayObjects[i]);
      }
    }
    this.chordProperties.capo = capo;
    this.chordProperties.currentNotes = chord;
    (document.getElementById('chordCapoInput') as HTMLInputElement).value = (capo - 1).toString();
    this.chordDisplayObjects.length = 0;
    const capoText = capo > 1 ? capo - 1 : capo;
    const capoNum = SvgDrawer.createText(46, 12, capoText.toString(), '12px', '', 'Source Sans Pro');
    chordDisplay.appendChild(capoNum);
    this.chordDisplayObjects.push(capoNum);

    const {
      height, numStrings, stringPadding, paddingRight,
    } = this.chordProperties;
    if (capo > 1) {
      const capoHeight = height + 2 * stringPadding - 10;
      const capoDrawn = SvgDrawer.createRect(46, 15, 7, capoHeight, '#000', '0', '#000');
      capoDrawn.setAttribute('rx', '4');
      capoDrawn.setAttribute('ry', '4');
      chordDisplay.appendChild(capoDrawn);
      this.chordDisplayObjects.push(capoDrawn);
    }
    for (let i = 0; i < 6; i += 1) {
      if (chord[i] === -1) {
        const yPos = (height - 2 * stringPadding) / ((numStrings - 1) * (numStrings - i - 1))
          + stringPadding + paddingRight;
        const cross = SvgDrawer.createPath(`M13 ${yPos - 3}L19 ${yPos + 3}M13 ${yPos + 3}L19 ${yPos - 3}`, '#333', '1', 'none');
        cross.setAttribute('class', 'chordCross');
        chordDisplay.appendChild(cross);
        this.chordDisplayObjects.push(cross);
        cross.onclick = () => {
          this.chordProperties.currentNotes[i] = 0;
          this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
            this.chordProperties.fingers);
        };
      } else if (chord[i] !== 0) {
        const fret = capo > 1
          ? chord[i] + 1
          : chord[i];
        const chordCircle = this.placeFingerOnChord(i, fret, fingers[i], chordDisplay);
        this.chordDisplayObjects.push(chordCircle);
        chordCircle.onclick = () => {
          this.chordProperties.currentNotes[i] = 0;
          this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
            this.chordProperties.fingers);
        };
      } else {
        const yPos = (height - 2 * stringPadding) / ((numStrings - 1)
          * (numStrings - i - 1)) + stringPadding + paddingRight;
        const circle = SvgDrawer.createCircle(16, yPos, 4, '#333333', '1', 'white');
        chordDisplay.appendChild(circle);
        this.chordDisplayObjects.push(circle);

        circle.onclick = () => {
          this.chordProperties.currentNotes[i] = -1;
          this.drawChord(this.chordProperties.capo, this.chordProperties.currentNotes,
            this.chordProperties.fingers);
        };
      }
    }
  }

  placeFingerOnChord(
    string: number, fret: number, finger: number | null, chordDisplay: HTMLElement,
  ) {
    const cP = this.chordProperties;
    const xPos = (cP.width / cP.horizontalSteps) * fret + cP.paddingLeft - 12;
    const yPos = ((cP.height - 2 * cP.stringPadding) / (cP.numStrings - 1))
      * (cP.numStrings - string - 1) + cP.stringPadding + cP.paddingRight;
    const fingerText = finger != null ? finger.toString() : '';
    return ModalHandler.drawPoint(xPos, yPos, 0, 0, 9, chordDisplay, fingerText);
  }

  applyBendPreset(
    index: number, paddingTop: number, paddingLeft: number, widthTotal: number,
    heightTotal: number, preset: {x: number, y: number}[],
  ) {
    const width = widthTotal / this.HORIZONTAL_STEPS;
    const height = heightTotal / this.VERTICAL_STEPS;
    for (let i = 0; i <= this.HORIZONTAL_STEPS; i += 1) {
      const currentPoint = this.pointsOnLine[i];
      if (currentPoint != null && currentPoint[0].parentNode != null) {
        currentPoint[0].parentNode.removeChild(currentPoint[0]);
        this.pointsOnLine[i] = null;
      }
    }
    // local to not waste RAM for an array not needed in most cases
    const bendPresets = [
      [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: 12, y: 4 }],
      [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 9, y: 0 }, { x: 12, y: 0 }],
      [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 6, y: 0 }, { x: 8, y: 0 },
        { x: 10, y: 4 }, { x: 12, y: 4 }],
      [{ x: 0, y: 4 }, { x: 12, y: 4 }],
      [{ x: 0, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 0 }, { x: 12, y: 0 }],
    ];
    const bendEditor = document.getElementById('bendEditor')!;

    let bendPreset = bendPresets[index];
    if (preset != null && preset.length > 0) {
      bendPreset = preset;
    }
    console.log('Bend Preset', bendPreset);
    for (let i = 0; i < bendPreset.length; i += 1) {
      const xVal = bendPreset[i].x;
      const yVal = bendPreset[i].y; // 0,0 is at the upper-left
      this.pointsOnLine[xVal] = [
        ModalHandler.drawPoint(
          width * xVal,
          height * (this.VERTICAL_STEPS - yVal),
          paddingTop,
          paddingLeft,
          7,
          bendEditor,
          '',
        ),
        yVal,
        xVal,
      ];
    }
    this.connectAllBendPoints(bendEditor);
  }

  applyTremoloPreset(
    index: number, padding: number, widthIn: number, heightIn: number,
    ownPreset: {x: number, y: number}[],
  ) {
    const width = widthIn / this.NUM_COLUMNS_TREMOLO;
    const height = heightIn / this.NUM_ROWS_TREMOLO;
    for (let i = 0; i <= this.NUM_COLUMNS_TREMOLO; i += 1) {
      const currentPoint = this.tremoloPointsOnLine[i];
      if (currentPoint != null && currentPoint[0] != null) {
        const { parentNode } = currentPoint[0];
        if (parentNode != null) {
          parentNode.removeChild(currentPoint[0]);
          this.tremoloPointsOnLine[i] = null;
        }
      }
    }
    // local to not waste RAM for an array not needed in most cases
    const tremoloPresets = [
      [{ x: 0, y: 16 }, { x: 9, y: 14 }, { x: 12, y: 14 }], // Dive
      [{ x: 0, y: 16 }, { x: 6, y: 14 }, { x: 12, y: 16 }], // DIP
      [{ x: 0, y: 14 }, { x: 9, y: 14 }, { x: 12, y: 16 }], // Release Up
      [{ x: 0, y: 16 }, { x: 6, y: 18 }, { x: 12, y: 16 }], // Inverted Dip
      [{ x: 0, y: 16 }, { x: 9, y: 18 }, { x: 12, y: 18 }], // return
      [{ x: 0, y: 18 }, { x: 9, y: 18 }, { x: 12, y: 16 }], // release Down
    ];
    const tremoloEditor = document.getElementById('tremoloEditor')!;
    let tremoloPreset = tremoloPresets[index];
    if (ownPreset != null && ownPreset.length > 0) {
      tremoloPreset = ownPreset;
    }
    for (let i = 0; i < tremoloPreset.length; i += 1) {
      const xVal = tremoloPreset[i].x;
      const yVal = tremoloPreset[i].y; // 0,0 is at the upper-left
      this.tremoloPointsOnLine[xVal] = [ModalHandler.drawPoint(width * xVal, height
        * (this.NUM_ROWS_TREMOLO - yVal), padding, padding, 7, tremoloEditor, ''), yVal, xVal];
    }
    this.connectAllTremoloPoints(tremoloEditor);
  }

  // draws point (xPos, yPos, padding) to given svgParent
  static drawPoint(
    xPos: number, yPos: number, paddingTop: number, paddingLeft: number,
    radius: number, svgParent: HTMLElement, text: string,
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

  connectAllBendPoints(svgElem: HTMLElement) {
    for (let i = 0; i < this.bendPointsArr.length; i += 1) {
      const bendPointDom = this.bendPointsArr[i];
      if (bendPointDom != null && bendPointDom.parentNode != null) {
        bendPointDom.parentNode.removeChild(bendPointDom);
      }
    }
    this.bendPointsArr.length = 0;
    let firstPoint = null;
    for (let i = 0; i < this.pointsOnLine.length; i += 1) {
      if (this.pointsOnLine[i] != null) {
        if (firstPoint == null) {
          firstPoint = this.pointsOnLine[i];
        } else {
          this.bendPointsArr.push(ModalHandler.connectPoints(
            firstPoint[0].childNodes[0] as HTMLElement,
            this.pointsOnLine[i]![0].childNodes[0] as HTMLElement,
            svgElem,
          ));
          firstPoint = this.pointsOnLine[i];
        }
      }
    }
  }

  connectAllTremoloPoints(svgElem: HTMLElement) {
    for (let i = 0; i < this.tremoloPointsArr.length; i += 1) {
      const { parentNode } = this.tremoloPointsArr[i];
      if (parentNode != null) {
        parentNode.removeChild(this.tremoloPointsArr[i]);
      }
    }
    this.tremoloPointsArr.length = 0;
    let firstPoint = null;
    for (let i = 0; i < this.tremoloPointsOnLine.length; i += 1) {
      const currentTremoloPoint = this.tremoloPointsOnLine[i];
      if (currentTremoloPoint != null) {
        if (firstPoint == null) {
          firstPoint = currentTremoloPoint;
        } else {
          this.tremoloPointsArr.push(
            ModalHandler.connectPoints(
              firstPoint[0].childNodes[0] as HTMLElement,
              currentTremoloPoint[0].childNodes[0] as HTMLElement, svgElem,
            ),
          );
          firstPoint = currentTremoloPoint;
        }
      }
    }
  }

  static connectPoints(
    pointA: HTMLElement, pointB: HTMLElement, svgElem: HTMLElement,
  ) {
    const pathStr = `M${pointA.getAttribute('cx')} ${pointA.getAttribute('cy')}L${pointB.getAttribute('cx')} ${pointB.getAttribute('cy')}`;
    const pathEl = SvgDrawer.createPath(pathStr, '#123e74', '2', 'none');
    pathEl.setAttribute('class', 'pointConnectionLine');
    svgElem.appendChild(pathEl);
    return pathEl;
  }

  static toggleTopBar(modalIn: HTMLElement) {
    const modal = modalIn;
    if (modal.classList.contains('hideBar')) {
      modal.classList.remove('hideBar');
    } else {
      modal.classList.add('hideBar');
    }
    const dataY = modal.getAttribute('data-y');
    if (dataY != null) {
      const yPos = parseInt(dataY, 10);
      modal.style.top = `${yPos + 22}px`;
      modal.setAttribute('data-y', (yPos + 22).toString());
    }
  }
}

const modalHandler = new ModalHandler();
export { modalHandler, ModalHandler };
export default modalHandler;
