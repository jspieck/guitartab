// Type declarations for WebMidi
declare global {
  namespace WebMidi {
    interface MIDIAccess {
      inputs: Map<string, MIDIInput>;
      outputs: Map<string, MIDIOutput>;
      onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    }

    interface MIDIPort {
      id: string;
      manufacturer: string;
      name: string;
      connection: string;
      state: string;
      type: string;
    }

    interface MIDIInput extends MIDIPort {
      onmidimessage: ((event: MIDIMessageEvent) => void) | null;
      close(): void;
    }

    interface MIDIOutput extends MIDIPort {
    }

    interface MIDIMessageEvent {
      data: Uint8Array;
      timeStamp: number;
    }

    interface MIDIConnectionEvent {
      port: MIDIInput | MIDIOutput;
    }
  }

  interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean }): Promise<WebMidi.MIDIAccess>;
  }
}

import fastdom from 'fastdom';
// import webmidi;
import Helper from './helper';
import Song, { Measure, Note } from './songData';
import Duration from './duration';
import { VisualInstruments } from './visualInstruments';
import Settings from './settingManager';
import { audioEngine } from './audioEngine';
import { GpxReader } from './GPXReader';
import playBackLogic from './playBackLogicNew';
import { svgDrawer } from './svgDrawer';
import { modalManager } from './modals/modalManager';
import { MODALS } from './modals/modalTypes';

class MidiEngine {
  midi: any;

  sourceArrs: (GainNode | null)[];

  midiInputs: number[];

  isRecording: boolean;

  usedStrings: Set<number>;

  arrangedNoteBuffer: ({ fret: number, string: number,
    note: {fret: number, string: number, height: number}, fretWithCapo: number}[] | null)[] | null;

  midiNoteBuffer: number[];

  constructor() {
    this.midi = null;
    this.sourceArrs = [];
    this.midiInputs = [];
    this.isRecording = false;
    this.usedStrings = new Set();
    this.arrangedNoteBuffer = [];
    this.midiNoteBuffer = [];
  }

  onMIDISuccess(midiAccess: WebMidi.MIDIAccess) {
    this.midi = midiAccess;
    const inputs = this.midi.inputs.values();
    this.midiInputs.length = 0;
    const listBody = document.getElementById('midiDeviceListBody');
    Helper.removeAllChildren(listBody);
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
      const tr = document.createElement('tr');
      const deviceName = document.createElement('td');
      deviceName.textContent = input.value.name;
      const manufacturer = document.createElement('td');
      manufacturer.textContent = input.value.manufacturer;
      const status = document.createElement('td');
      status.textContent = input.value.connection;
      if (input.value.connection === 'open') {
        tr.setAttribute('class', 'selectedRow');
      }
      tr.appendChild(deviceName);
      tr.appendChild(manufacturer);
      tr.appendChild(status);

      tr.onclick = () => {
        const midiActiveDom = document.getElementById('isMidiActive');
        if (input.value.connection === 'closed') {
          midiActiveDom?.classList.add('activated');
          input.value.onmidimessage = this.onMIDIMessage;
        } else {
          midiActiveDom?.classList.remove('activated');
          input.value.close();
        }
      };

      listBody!.appendChild(tr);
      this.midiInputs.push(input.value);
    }
    if (this.midiInputs.length > 0) {
      modalManager.getHandler(MODALS.MIDI.id).openModal();
    } else {
      const tr = document.createElement('tr');
      const notice = document.createElement('td');
      notice.textContent = 'No midi device available';
      tr.appendChild(notice);
      listBody!.appendChild(tr);
    }

    this.midi.onstatechange = this.onStateChange;
    /* midi = midiAccess;
    midiInputs = [];
    var inputs = midi.inputs.values();
    // loop through all inputs
    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        midiInputs.push(input.value);
        // listen for midi messages
        input.value.onmidimessage = onMIDIMessage;
        // this just lists our inputs in the console
        MidiEngine.listInputs(input);
    }
    // listen for connect/disconnect message
    midi.onstatechange = onStateChange; */
  }

  static onMIDIFailure(e: Event) {
    console.log(`No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim ${e}`);
  }

  init() {
    // request MIDI access
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({
        sysex: false,
      }).then(() => this.onMIDISuccess, () => MidiEngine.onMIDIFailure);
    } else {
      console.log('No MIDI support in your browser.');
    }
  }

  onMIDIMessage(event: WebMidi.MIDIMessageEvent) {
    // console.log(event);
    const { data } = event;
    const cmd = data[0] >> 4;
    // const channel = data[0] & 0xf;
    // const type = data[0] & 0xf0;
    const noteNumber = data[1];
    const velocity = data[2];
    // with pressure and tilt off
    // note off: 128, cmd: 8
    // note on: 144, cmd: 9
    // pressure / tilt on
    // pressure: 176, cmd 11:
    // bend: 224, cmd: 14

    if (cmd === 8 || ((cmd === 9) && (velocity === 0))) {
      this.noteOff(noteNumber);
    } else if (cmd === 9) {
      this.noteOn(noteNumber, velocity);
    }
  }

  onStateChange(event: WebMidi.MIDIConnectionEvent) {
    const { port } = event;
    const { state, name, type } = port;
    if (type === 'input') {
      console.log('name', name, 'port', port, 'state', state);
    }
    this.onMIDISuccess(this.midi);
  }

  /* static listInputs(inputs) {
    const {
      type, id, manufacturer, name, version,
    } = inputs.value;
    console.log(`Input port : [ type:'${type}' id: '${id
    }' manufacturer: '${manufacturer}' name: '${name
    }' version: '${version}']`);
  } */

  // TODO do nothing if it is playing a song!
  noteOn(midiNote: number, velocity: number) {
    const volume = (2.0 * velocity) / 127;
    const trackId = Song.currentTrackId;
    const instr = Song.playBackInstrument[trackId].instrument;
    const noteStart = audioEngine.getCurrentTime();
    const duration = 2.0; // TODO
    const note: Note = Song.defaultNote();
    const beat: Measure = Song.defaultMeasure();

    console.log('NOTE ON');
    if (Settings.songPlaying && this.isRecording) {
      this.midiNoteBuffer.push(midiNote);
    }

    // play Note
    if (Song.playBackInstrument[Song.currentTrackId].instrument === 'drums') {
      this.sourceArrs[midiNote] = audioEngine.playDrums(trackId, Song.currentVoiceId,
        midiNote, volume, noteStart, beat);
    } else {
      this.sourceArrs[midiNote] = audioEngine.playSF2(trackId, Song.currentVoiceId, 0,
        midiNote - Song.tracks[trackId].strings[0],
        volume, noteStart, duration, beat, note, instr, -1);
    }
    MidiEngine.virtualPianoNoteEvent(midiNote, true);

    // do not consider usedStrings yet
    const arrangedNote = GpxReader.arrangeNotesToGuitar(trackId,
      [{ ...Song.defaultNote(), ...{ fret: 0, string: 0, height: midiNote } }],
      this.usedStrings);
    if (arrangedNote.length > 0 && arrangedNote[0].string !== -1) {
      VisualInstruments.markNoteOnGuitar(arrangedNote[0].string,
        arrangedNote[0].fretWithCapo);
      if (this.arrangedNoteBuffer != null) {
        this.arrangedNoteBuffer[midiNote] = arrangedNote;
      }
      this.usedStrings.add(arrangedNote[0].string);
    }
  }

  static virtualPianoNoteEvent(midiNote: number, isNoteOn: boolean) {
    fastdom.mutate(() => {
      const keyDom = document.getElementById(`key${midiNote}`);
      if (keyDom != null) {
        if (isNoteOn) {
          keyDom.classList.add('activeKey');
        } else {
          keyDom.classList.remove('activeKey');
        }
      }
    });
  }

  noteOff(midiNote: number) {
    MidiEngine.virtualPianoNoteEvent(midiNote, false);
    if (this.sourceArrs[midiNote] != null) {
      const gainN = this.sourceArrs[midiNote];
      gainN?.gain.setValueAtTime(gainN.gain.value, audioEngine.getCurrentTime() + 0.05);
      gainN?.gain.exponentialRampToValueAtTime(0.0001, audioEngine.getCurrentTime() + 0.15);
    }

    if (this.arrangedNoteBuffer != null) {
      const arrangedNote = this.arrangedNoteBuffer[midiNote];
      if (arrangedNote != null) {
        for (const { string, fretWithCapo } of arrangedNote) {
          VisualInstruments.unmarkNoteOnGuitar(string, fretWithCapo);
          this.usedStrings.delete(string);
        }
        this.arrangedNoteBuffer[midiNote] = null;
      }
    }
  }

  recordMidi() {
    this.midiNoteBuffer.length = 0;
    this.isRecording = true;
  }

  static findNearestBeatIdInBlock(
    trackId: number, blockId: number, voiceId: number, posInBlock: number,
  ) {
    const beats = Song.measures[trackId][blockId][voiceId];
    const timeInBlock = Duration.getDurationOfBlock(blockId);
    let bestValue = 1000;
    let accumulateTime = 0;
    let foundBeatId = 0;
    for (let i = 0, n = beats.length; i < n; i += 1) {
      if (Math.abs(posInBlock - accumulateTime / timeInBlock) < bestValue) {
        bestValue = posInBlock - accumulateTime / timeInBlock;
        foundBeatId = i;
      } else {
        break;
      }
      accumulateTime += Duration.getDurationOfNote(beats[i], false);
    }
    return foundBeatId;
  }

  midiToNote() {
    const { blockId, positionInBlock } = playBackLogic.getCurrentTime();
    const beatId = MidiEngine.findNearestBeatIdInBlock(Song.currentTrackId, blockId,
      Song.currentVoiceId, positionInBlock);
    // grab notes from buffer
    const pianoArrangedNotes: Note[] = [];
    for (let i = 0, n = this.midiNoteBuffer.length; i < n; i += 1) {
      pianoArrangedNotes[i] = {
        ...Song.defaultNote(),
        ...{ fret: 0, string: 0, height: this.midiNoteBuffer[i] },
      };
    }

    const { notes } = Song.measures[Song.currentTrackId][blockId][Song.currentVoiceId][beatId];
    const usedStrings: Set<number> = new Set();
    if (notes != null) {
      for (let i = 0; i < notes.length; i += 1) {
        if (notes[i] != null) {
          usedStrings.add(i);
        }
      }
    }

    const arrangedNotes = GpxReader.arrangeAndSetNotesToGuitar(Song.currentTrackId, blockId,
      Song.currentVoiceId, beatId, pianoArrangedNotes, usedStrings);
    if (notes != null) {
      for (let i = 0; i < arrangedNotes.length; i += 1) {
        const { string } = arrangedNotes[i];
        if (notes[string] != null) {
          svgDrawer.createNote(Song.currentTrackId, blockId, Song.currentVoiceId,
            beatId, string, notes[string]!);
        }
      }
    }
    this.midiNoteBuffer.length = 0;
  }

  stopRecording() {
    this.isRecording = false;
    // empty buffer
    this.midiToNote();
  }
}

const midiEngine = new MidiEngine();
export default midiEngine;
