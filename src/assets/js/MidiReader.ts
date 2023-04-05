type MidiEvent = {
  delta: number,
  type: string,
  midiChannel: number,
  metaType: number,
  metaData: number[],
  midiEventType: number,
  parameter1: number,
  parameter2?: number
}

type MidiTrack = {
  trackName: string,
  events: MidiEvent[],
  byteLength: number
}

const midiReader = {
  midiFile: {
    format: 0,
    numTracks: 0,
    ticksPerBeat: 0,
    tracks: [] as MidiTrack[],
  },

  error(str: string) {
    console.log('Error: ', str);
  },

  appendText(e: HTMLElement, text: string) {
    e.appendChild(document.createTextNode(text));
  },

  dumpFileInfo(e: HTMLElement) {
    // Performs a simple dump of the MIDI file
    if (!e) {
      return;
    }
    e.innerHTML = `File type: ${this.midiFile.format}<br>Number of tracks: ${this.midiFile.numTracks}<br>Ticks per beat: ${this.midiFile.ticksPerBeat}<br>`;
    for (let i = 0; i < this.midiFile.numTracks; i += 1) {
      const track = this.midiFile.tracks[i];
      this.appendText(e, `Track #${i}: `);
      if (track.trackName) {
        this.appendText(e, `'${track.trackName}' `);
      }
      this.appendText(e, `${track.events.length} events`);
      e.appendChild(document.createElement('br'));

      let str = '';
      for (let j = 0; j < track.events.length; j += 1) {
        const ev = track.events[j];
        str += `(${ev.delta}')`;
        if (ev.type === 'MIDI') {
          const n = (ev.midiEventType << 4) + ev.midiChannel;
          str += `[${n.toString(16)} ${ev.parameter1.toString(16)}`;
          if (ev.parameter2 != null) {
            str += ` ${ev.parameter2.toString(16)}`;
          }
          str += '] ';
        } else if (ev.type === 'meta') {
          str += `[meta ${ev.metaType.toString(16)} ${ev.metaData.length}bytes]`;
        } else {
          // must be sysex
          str += `[sysex: ${ev.metaData.length}bytes]`;
        }
      }
      this.appendText(e, str);
      e.appendChild(document.createElement('br'));
      e.appendChild(document.createElement('br'));
    }
  },

  decodeVariableLengthValue(data: DataView, trackOffset: number) {
    let i;
    let idx = trackOffset;
    let result = 0;

    do {
      i = data.getUint8(idx);
      idx += 1;
      // left-shift by 7 bits
      result <<= 7;
      // mask off the top bit
      result += i & 0x7f;
    } while (i >= 0x80);

    return {
      idx,
      result,
    };
  },

  decodeMetaEvent(
    data: DataView, trackOffset: number, trackIn: MidiTrack, trackEventIn: MidiEvent,
  ) {
    const trackEvent = trackEventIn;
    const track = trackIn;
    // we already know the first byte is 0xff
    let idx = trackOffset + 1;
    const metaData = [];

    trackEvent.type = 'meta';
    trackEvent.metaType = data.getUint8(idx);
    idx += 1;
    /* Type Event Type Event
      0x00 Sequence number
      0x01 Text event
      0x02 Copyright notice
      0x03 Sequence or track name
      0x04 Instrument name
      0x05 Lyric text
      0x06 Marker text
      0x07 Cue point
      0x20 MIDI channel prefix assignment
      0x2F End of track
      0x51 Tempo setting
      0x54 SMPTE offset
      0x58 Time signature
      0x59 Key signature
      0x7F Sequencer specific event */

    const result = this.decodeVariableLengthValue(data, idx);
    idx = result.idx;
    const length = result.result;
    const end = idx + length;

    while (idx < end) {
      metaData.push(data.getUint8(idx));
      idx += 1;
    }
    trackEvent.metaData = metaData;
    if (trackEvent.metaType === 0x03) {
      let str = '';
      for (let i = 0; i < metaData.length; i += 1) {
        str += String.fromCharCode(metaData[i]);
      }
      track.trackName = str;
    }

    return idx;
  },

  decodeSysexEvent(
    data: DataView, trackOffset: number, track: MidiTrack, trackEventIn: MidiEvent,
  ) {
    const trackEvent = trackEventIn;
    let idx = trackOffset;
    const metaData = [];
    let d;
    trackEvent.type = 'sysex';
    metaData.push(data.getUint8(idx));
    idx += 1;

    do {
      d = data.getUint8(idx);
      idx += 1;
      metaData.push(d);
    } while (d !== 0xf7);

    trackEvent.metaData = metaData;
    return idx;
  },

  decodeMIDIEvent(data: DataView, idxIn: number, trackEventIn: MidiEvent) {
    const trackEvent = trackEventIn;
    let idx = idxIn;
    const eventType = data.getUint8(idx);
    idx += 1;

    trackEvent.type = 'MIDI';

    trackEvent.midiEventType = (eventType & 0xf0) >> 4;
    trackEvent.midiChannel = eventType & 0x0f;

    trackEvent.parameter1 = data.getUint8(idx);
    idx += 1;

    // program change and channel aftertouch don't have a param2
    if (trackEvent.midiEventType !== 0x0c && trackEvent.midiEventType !== 0x0d) {
      trackEvent.parameter2 = data.getUint8(idx);
      idx += 1;
    }
    return idx;
  },

  decodeRunningModeMIDIEvent(
    data: DataView,
    idxIn: number,
    trackEventIn: MidiEvent,
    lastEvent: MidiEvent,
  ) {
    let idx = idxIn;
    const trackEvent = trackEventIn;
    trackEvent.type = 'MIDI';
    trackEvent.midiEventType = lastEvent.midiEventType;
    trackEvent.midiChannel = lastEvent.midiChannel;

    trackEvent.parameter1 = data.getUint8(idx);
    idx += 1;
    // program change and channel aftertouch don't have a param2
    if (
      trackEvent.midiEventType !== 0x0c
      && trackEvent.midiEventType !== 0x0d
    ) {
      trackEvent.parameter2 = data.getUint8(idx);
      idx += 1;
    }
    return idx;
  },

  decodeTrackEvent(data: DataView, track: MidiTrack, trackOffset: number) {
    const trackEvent: MidiEvent = {
      type: '',
      metaType: 0,
      delta: 0,
      midiChannel: 0,
      metaData: [],
      midiEventType: 0,
      parameter1: 0,
    };
    let idx = trackOffset;
    const lastEventIdx = track.events.length;

    const result = this.decodeVariableLengthValue(data, idx);
    idx = result.idx;
    trackEvent.delta = result.result;

    // figure out what type of event we have - DON'T increment the index!!
    const i = data.getUint8(idx);
    if (i === 0xff) {
      idx = this.decodeMetaEvent(data, idx, track, trackEvent);
    } else if (i === 0xf0 || i === 0xf7) {
      idx = this.decodeSysexEvent(data, idx, track, trackEvent);
    } else if (i & 0x80) {
      // non-running-mode MIDI Event
      idx = this.decodeMIDIEvent(data, idx, trackEvent);
    } else if (lastEventIdx > 0) {
      idx = this.decodeRunningModeMIDIEvent(
        data,
        idx,
        trackEvent,
        track.events[track.events.length - 1],
      );
    } else {
      this.error('Running mode event with no previous event!');
      return -1;
    }

    track.events.push(trackEvent);
    return idx;
  },

  decodeTrack(data: DataView, trackIn: MidiTrack, trackOffset: number) {
    let idx = trackOffset;
    const track = trackIn;

    //   char           ID[4];  // Track header 'MTrk'
    if (
      data.getUint8(idx) !== 0x4d
      || data.getUint8(idx + 1) !== 0x54
      || data.getUint8(idx + 2) !== 0x72
      || data.getUint8(idx + 3) !== 0x6b
    ) {
      this.error('malformed track header');
      return -1;
    }
    idx += 4;

    //   unsigned long length;  // length of track chunk in bytes
    track.byteLength = data.getUint32(idx);
    idx += 4;
    const end = idx + track.byteLength;

    track.events = []; // creates an empty array

    // any number of trackEvents.
    while (idx < end) {
      idx = this.decodeTrackEvent(data, track, idx);
      if (idx === -1) {
        this.error('error decoding track event');
        return -1;
      }
    }
    // {this.error('error'); return -1;}
    return idx;
  },

  decodeSMF(buffer: ArrayBuffer) {
    const data = new DataView(buffer);
    let idx = 0;
    this.midiFile = {
      format: 0, numTracks: 0, ticksPerBeat: 0, tracks: [],
    }; // clear the midi file object if it's already allocated
    //  alert( 'File is ' + buffer.byteLength + ' bytes long.');
    //   char           ID[4];  // File header 'MThd'
    if (
      data.getUint8(idx) !== 0x4d
      || data.getUint8(idx + 1) !== 0x54
      || data.getUint8(idx + 2) !== 0x68
      || data.getUint8(idx + 3) !== 0x64
    ) {
      return this.error('malformed file header');
    }
    idx += 4;
    //   unsigned long  Length; /* This should be 6 */
    if (data.getUint32(idx) !== 6) {
      return this.error('file header length is not 6.');
    }
    idx += 4;

    //   unsigned short format;
    this.midiFile.format = data.getUint16(idx);
    idx += 2;

    if (this.midiFile.format < 0 || this.midiFile.format > 2) {
      return this.error(`MIDI file format ${this.midiFile.format} unrecognized.`);
    }

    if (this.midiFile.format === 2) {
      return this.error('MIDI file format type 2 not supported.');
    }

    // unsigned short numTracks;
    this.midiFile.numTracks = data.getUint16(idx);
    idx += 2;

    // unsigned short ticksPerBeat;
    this.midiFile.ticksPerBeat = data.getUint16(idx);
    idx += 2;

    this.midiFile.tracks = new Array(this.midiFile.numTracks);
    for (let iTrack = 0; iTrack < this.midiFile.numTracks; iTrack += 1) {
      this.midiFile.tracks[iTrack] = {
        trackName: '', events: [], byteLength: 0,
      };
      idx = this.decodeTrack(data, this.midiFile.tracks[iTrack], idx);
      if (idx === -1) {
        return this.error(`error reading track #${iTrack}`);
      }
    }

    // alert('Success!');
    this.dumpFileInfo(document.getElementById('updates')!);
    return idx;
  },
};

export default midiReader;
