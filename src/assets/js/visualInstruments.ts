import fastdom from 'fastdom';
import interact from 'interactjs';
import midiEngine from './midiReceiver';
import { Song, Note } from './songData';
import tuning from './tuning';

class VisualInstruments {
  clickedKeyOnPiano: number;

  fretPercentage: number[];

  previousDrawnGuitarValues: {numStrings: number, numFrets: number};

  drawnGuitarElements: HTMLElement[];

  lastNoteDrawn: ({nH: number, string: number, fretWithCapo: number} | null)[];

  constructor() {
    this.clickedKeyOnPiano = -1;
    // for guitar
    this.fretPercentage = [];
    this.previousDrawnGuitarValues = { numStrings: -1, numFrets: -1 };
    this.drawnGuitarElements = [];
    this.lastNoteDrawn = [];
    this.clickedKeyOnPiano = 0;
  }

  createPiano(numTasten: number) {
    const pianoList = document.getElementById('pianoList');
    let keyNumber = 0;
    for (let i = 0; i < numTasten; i += 1) {
      const startKeyNumber = keyNumber;
      const listEntry = document.createElement('li');
      const key = document.createElement('div');
      key.setAttribute('class', 'key');
      key.setAttribute('id', `key${keyNumber}`);
      keyNumber += 1;
      const upperKey = document.createElement('div');
      upperKey.setAttribute('class', 'upper-key');
      const hasUpperKey = i % 7 !== 2 && i % 7 !== 6;
      if (hasUpperKey) {
        upperKey.setAttribute('id', `key${keyNumber}`);
        keyNumber += 1;
      }

      // (function (listEntry, key, upperKey, keyNumber, hasUpperKey) {
      fastdom.mutate(() => {
        listEntry.appendChild(key);
        if (hasUpperKey) {
          listEntry.appendChild(upperKey);
        }
        if (pianoList != null) {
          pianoList.appendChild(listEntry);
        }
      });
      key.addEventListener('mousedown', () => {
        midiEngine.noteOn(startKeyNumber, 80);
        this.clickedKeyOnPiano = startKeyNumber;
      });
      if (hasUpperKey) {
        upperKey.addEventListener('mousedown', () => {
          midiEngine.noteOn(startKeyNumber + 1, 80);
          this.clickedKeyOnPiano = startKeyNumber + 1;
        });
      }
      // }(listEntry, key, upperKey, startKeyNumber, hasUpperKey));
    }
  }

  setCapo(capo: number) {
    const capoDom = document.getElementById('capo');
    if (capoDom != null) {
      if (capo > 0) {
        capoDom.style.display = 'block';
        capoDom.style.right = `${this.fretPercentage[capo - 1] - 1.3}%`;
      } else {
        capoDom.style.display = 'none';
      }
    }
  }

  createGuitar(numStrings: number, numFrets: number) {
    fastdom.mutate(() => {
      interact('#guitar').resizable({
        preserveAspectRatio: false,
        edges: {
          left: false, right: false, bottom: false, top: true,
        },
      }).on('resizemove', (event) => {
        const { target } = event;
        // const x = (parseFloat(target.getAttribute('data-x')) || 0);
        // const y = (parseFloat(target.getAttribute('data-y')) || 0);
        // update the element's style
        target.style.width = `${event.rect.width}px`;
        target.style.height = `${event.rect.height}px`;
        /* translate when resizing from top or left edges
                x += event.deltaRect.left;
                y += event.deltaRect.top;

                target.style.webkitTransform = target.style.transform =
                    'translate(' + x + 'px,' + y + 'px)'; */
      });

      if (this.previousDrawnGuitarValues.numStrings !== numStrings
        || this.previousDrawnGuitarValues.numFrets !== numFrets) {
        this.previousDrawnGuitarValues.numStrings = numStrings;
        this.previousDrawnGuitarValues.numFrets = numFrets;
        // delete old guitar
        for (let i = 0, n = this.drawnGuitarElements.length; i < n; i += 1) {
          if (this.drawnGuitarElements[i].parentNode != null) {
            this.drawnGuitarElements[i].parentNode?.removeChild(this.drawnGuitarElements[i]);
          }
        }
        this.drawnGuitarElements.length = 0;

        // create frets
        const fC = document.getElementById('fretContainer');
        if (fC != null) {
          for (let i = 0; i < numFrets; i += 1) {
            const frD = document.createElement('div'); // <div class="fret"></div>
            frD.setAttribute('class', 'fret');
            this.fretPercentage[i] = (((i + 1) / (numFrets + 1)) * 100);
            frD.style.left = `${((i + 1) / (numFrets + 1)) * 100}%`;
            fC.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
        }
        // create strings TODO
        const sC = document.getElementById('stringsList');
        if (sC != null) {
          for (let i = 0; i < numStrings; i += 1) {
            const frD = document.createElement('li'); // <div class="fret"></div>
            frD.setAttribute('class', 'string');
            frD.setAttribute('id', `string${i}`);
            frD.style.top = `${(i / (numStrings - 1)) * 100}%`;
            sC.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
        }
        // create strings at back
        const half = Math.ceil(numStrings / 2);
        const sbt = document.getElementById('stringsListBackTop');
        const sbb = document.getElementById('stringsListBackBottom');
        if (sbt != null) {
          for (let i = 0; i < half; i += 1) {
            const frD = document.createElement('li'); // <div class="fret"></div>
            frD.setAttribute('class', 'string');
            frD.setAttribute('id', `stringBack${i}`);
            frD.style.top = `${(i / (numStrings - 1)) * 100}%`;
            sbt.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
        }
        if (sbb != null) {
          for (let i = half; i < numStrings; i += 1) {
            const frD = document.createElement('li'); // <div class="fret"></div>
            frD.setAttribute('class', 'string');
            frD.setAttribute('id', `stringBack${i}`);
            frD.style.top = `${(i / (numStrings - 1)) * 100}%`;
            sbb.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
        }

        // create dots TODO
        const dC = document.getElementById('dots');
        const dotPositions = [3, 5, 7, 9, 15, 17, 19, 21]; // 12 is double special
        if (dC != null) {
          for (let i = 0; i < dotPositions.length; i += 1) {
            const frD = document.createElement('li');
            frD.setAttribute('class', 'dot');
            frD.style.right = `${((dotPositions[i] - 0.5) / (numFrets + 1)) * 100}%`;
            dC.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
          // create 12er dots
          for (let i = 0; i < 2; i += 1) {
            const frD = document.createElement('li');
            frD.setAttribute('class', 'dots');
            frD.style.right = `${((12 - 0.5) / (numFrets + 1)) * 100}%`;
            if (i === 0) {
              frD.style.top = 'calc((100% - 10px) * 0.2 + 3px)';
            } else {
              frD.style.top = 'calc((100% - 10px) * 0.8 - 3px)';
            }
            dC.appendChild(frD);
            this.drawnGuitarElements.push(frD);
          }
        }

        // create marker
        const mC = document.getElementById('guitarMarkerContainer');
        if (mC != null) {
          for (let i = 0; i < numStrings; i += 1) {
            for (let j = 0; j < numFrets; j += 1) {
              const frD = document.createElement('div');
              frD.setAttribute('class', 'guitarNoteMarker');
              frD.setAttribute('id', `gnm${i}_${j}`);
              // frD.style.left = "calc("+((j+1)/(numFrets+1)*100)+"% + 8px)";
              frD.style.right = `calc(${((j + 1) / (numFrets + 1)) * 100}% - 12px)`;
              frD.style.top = `${(i / (numStrings - 1)) * 100}%`;
              mC.appendChild(frD);
              this.drawnGuitarElements.push(frD);
            }
          }
        }
      }
    });
  }

  unmarkVisualInstruments(): void {
    for (let j = 0; j < this.lastNoteDrawn.length; j += 1) {
      const lNote = this.lastNoteDrawn[j];
      if (lNote != null) {
        const keyDom = document.getElementById(`key${lNote.nH}`);
        if (keyDom != null) {
          keyDom.classList.remove('activeKey');
          VisualInstruments.unmarkNoteOnGuitar(lNote.string, lNote.fretWithCapo);
        }
      }
    }
  }

  updatePianoAndGuitar(currentNote: (Note | null)[]) {
    // clear all notes
    for (let j = 0; j < this.lastNoteDrawn.length; j += 1) {
      const lNote = this.lastNoteDrawn[j];
      if (lNote != null && !(currentNote[j] != null && currentNote[j]!.tied)) {
        const keyDom = document.getElementById(`key${lNote.nH}`);
        if (keyDom != null) {
          keyDom.classList.remove('activeKey');
        }
        VisualInstruments.unmarkNoteOnGuitar(lNote.string, lNote.fretWithCapo);
      }
    }
    const { capo } = Song.tracks[Song.currentTrackId];
    // add new notes
    for (let j = 0; j < Song.tracks[Song.currentTrackId].numStrings; j += 1) {
      if (currentNote[j] != null && !currentNote[j]!.tied) {
        const noteHeight = tuning.getNoteHeight(Song.currentTrackId, j, currentNote[j]!.fret);
        const keyDom = document.getElementById(`key${noteHeight}`);
        if (keyDom != null) {
          keyDom.classList.add('activeKey');
        }
        const fretWithCapo = currentNote[j]!.fret + capo;
        VisualInstruments.markNoteOnGuitar(j, fretWithCapo);
        this.lastNoteDrawn[j] = {
          nH: noteHeight,
          string: j,
          fretWithCapo,
        };
      }
      if (currentNote[j] == null) {
        this.lastNoteDrawn[j] = null;
      }
    }
  }

  static markNoteOnGuitar(string: number, fretWithCapo: number) {
    const { capo } = Song.tracks[Song.currentTrackId];
    if (fretWithCapo !== capo) {
      const gnm = document.getElementById(`gnm${string}_${fretWithCapo - 1}`);
      if (gnm != null) {
        gnm.style.display = 'block';
      }
    }
    const guitarString = document.getElementById(`string${string}`);
    if (guitarString != null) {
      guitarString.style.borderBottom = '3px solid #cfbf89';
    }
  }

  static unmarkNoteOnGuitar(string: number, fretWithCapo: number) {
    document.getElementById(`gnm${string}_${fretWithCapo - 1}`)!.style.display = "none";
    const stringDom = document.getElementById(`string${string}`);
    if (stringDom != null) {
      stringDom.style.borderBottom = '2px solid #958963';
    }
  }
}

const visualInstruments = new VisualInstruments();
export { visualInstruments, VisualInstruments };
export default visualInstruments;
