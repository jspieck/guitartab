import Song, { PlayBackInstrument, Measure, Note } from './songData';
import Settings from './settingManager';
import { modalManager } from './modals/modalManager';
import { sequencer } from './sequencer';
import Chorus from './chorus';
import Freeverb from './freeverb';
import sf2Parser from './sf2parser';

import { MODALS } from './modals/modalTypes';
import { MixerModalHandler } from './modals/mixerModalHandler';
import { EqualizerModalHandler } from './modals/equalizerModalHandler';

type EventFunction = (e: Event) => void;

class AudioEngine {
  reverbActive: boolean;

  context: AudioContext;

  averageVolumeIsNull: boolean;

  equalizerHandler: EqualizerModalHandler | null;

  busses: { volume: GainNode, pan: StereoPannerNode, analyser: AnalyserNode,
    convolver: Freeverb, chorus: Chorus }[];

  drumBusses: { volume: GainNode, analyser: AnalyserNode, pan: StereoPannerNode }[];

  limiter: DynamicsCompressorNode | null;

  masterGain: GainNode;

  masterAnalyser: AnalyserNode;

  dataArray: Uint8Array | null;

  drumDataArray: Uint8Array | null;

  masterDataArray: Uint8Array | null;

  bufferLength: number;

  drumBufferLength: number;

  masterBufferLength: number;

  playingInstrumentSet: Set<{
    source: AudioBufferSourceNode, gain: AudioParam, trackId: number, voiceId: number,
  }>;

  sourcesPlaying: [startpoint: number, source: AudioBufferSourceNode, gainNode: GainNode][][];

  bufferList: {
    metronome: { buffer: AudioBuffer, noteValue: string }[],
    drums: { buffer: AudioBuffer, noteValue: string }[],
    slap: { buffer: AudioBuffer, noteValue: string }[],
    dead: { buffer: AudioBuffer, noteValue: string }[],
    palmMute: { buffer: AudioBuffer, noteValue: string }[],
    naturalHarmonic: { buffer: AudioBuffer, noteValue: string }[],
    [a: string]: { buffer: AudioBuffer, noteValue: string }[],
  };

  noteToDrum: Map<number, [string, number, number, number, boolean, string]>;

  theSynth: any;

  bindedDeleteSource: EventFunction;

  constructor() {
    this.reverbActive = false;
    this.context = new AudioContext();
    this.averageVolumeIsNull = true;

    this.busses = [];
    this.drumBusses = [];
    this.limiter = null;
    this.masterGain = this.context.createGain();
    this.masterAnalyser = this.context.createAnalyser();
    this.dataArray = null;
    this.drumDataArray = null;
    this.masterDataArray = null;
    this.bufferLength = 0;
    this.drumBufferLength = 0;
    this.masterBufferLength = 0;
    this.equalizerHandler = null;

    this.playingInstrumentSet = new Set();

    this.sourcesPlaying = [];
    this.bufferList = {
      metronome: [],
      drums: [],
      slap: [],
      dead: [],
      palmMute: [],
      naturalHarmonic: [],
    };
    // buffer name, buffer number, volume, pan, active
    this.noteToDrum = new Map([
      [35, ['Kick 1', 0, 2, 0, true, 'K1']],
      [36, ['Kick 2', 0, 2, 0, true, 'K2']],
      [37, ['Stick', 5, 1, 0, true, 'St']],
      [38, ['Snare 1', 2, 2, 0, true, 'S1']],
      [39, ['Clap', 7, 1, 0, true, 'Cl']],
      [40, ['Snare 2', 2, 2, 0, true, 'S2']],
      [41, ['Low Tom 2', 10, 1, 0, true, 'LT2']],
      [42, ['Closed Hi-hat', 1, 0.6, 0, true, 'CH']],
      [43, ['Low Tom 1', 10, 1, 0, true, 'LT1']],
      [44, ['Pedal Hi-hat', 1, 0.6, 0, true, 'PH']],
      [45, ['Mid Tom 1', 11, 1, 0, true, 'MT1']],
      [46, ['Open Hi-hat', 3, 1, 0, true, 'OH']],
      [47, ['Mid Tom 2', 12, 1, 0, true, 'MT2']],
      [48, ['High Tom 2', 13, 1, 0, true, 'HT2']],
      [49, ['Crash 1', 4, 1, 0, true, 'Cr1']],
      [50, ['High Tom 1', 13, 1, 0, true, 'HT1']],
      [51, ['Ride 1', 9, 1, 0, true, 'R1']],
      [52, ['Chinese Cymbal', 14, 1, 0, true, 'CC']],
      [53, ['Ride Bell', 15, 1, 0, true, 'RB']],
      [54, ['Tambourine', 8, 1, 0, true, 'T']],
      [55, ['Splash Cymbal', 16, 1, 0, true, 'SC']],
      [56, ['Cowbell', 17, 1, 0, true, 'Co']],
      [57, ['Crash 2', 4, 1, 0, true, 'Cr2']],
      [58, ['Vibra Slap', 18, 1, 0, true, 'VS']],
      [59, ['Ride 2', 9, 1, 0, true, 'R2']],
      [60, ['High Bongo', 19, 1, 0, true, 'HB']],
      [61, ['Low Bongo', 19, 1, 0, true, 'LB']],
      [62, ['Mute High Conga', 20, 1, 0, true, 'MHC']],
      [63, ['Open High Conga', 20, 1, 0, true, 'OHC']],
      [64, ['Low Conga', 20, 1, 0, true, 'LC']],
      [65, ['High Timbale', 21, 1, 0, true, 'HT']],
      [66, ['Low Timbale', 21, 1, 0, true, 'LT']],
      [67, ['High Agogo', 22, 1, 0, true, 'HA']],
      [68, ['Low Agogo', 22, 1, 0, true, 'LA']],
      [69, ['Cabasa', 6, 1, 0, true, 'Ca']],
      [70, ['Maracas', 23, 1, 0, true, 'M']],
      [71, ['Short Whistle', 24, 1, 0, true, 'SW']],
      [72, ['Long Whistle', 24, 1, 0, true, 'LW']],
      [73, ['Short Guiro', 25, 1, 0, true, 'SG']],
      [74, ['Long Guiro', 25, 1, 0, true, 'LG']],
      [75, ['Claves', 26, 1, 0, true, 'Cl']],
      [76, ['High Wood Block', 27, 1, 0, true, 'HWB']],
      [77, ['Low Wood Block', 27, 1, 0, true, 'LWB']],
      [78, ['Mute Cuica', 28, 1, 0, true, 'MCu']],
      [79, ['Open Cuica', 28, 1, 0, true, 'OCu']],
      [80, ['Mute Triangle', 29, 1, 0, true, 'MT']],
      [81, ['Open Triangle', 29, 1, 0, true, 'OT']],
    ]);

    this.theSynth = null;
    this.bindedDeleteSource = () => {};
  }

  getCurrentTime(): number {
    return this.context.currentTime;
  }

  createBiquadFilter(): BiquadFilterNode {
    return this.context.createBiquadFilter();
  }

  createBuffer(numChannels: number, sampleLength: number, sampleRate: number): AudioBuffer {
    return this.context.createBuffer(numChannels, sampleLength, sampleRate);
  }

  // initSound() {
  //   this.context = new AudioContext();
  // }

  setMasterGain(value: number) {
    this.masterGain.gain.value = value;
  }

  static getImpulseBuffer(audioCtx: AudioContext, impulseUrl: RequestInfo) {
    return fetch(impulseUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer));
  }

  async updateBusses(channels: PlayBackInstrument[]) {
    // first disconnect everything
    for (let i = 0; i < this.busses.length; i += 1) {
      this.busses[i].analyser.disconnect();
    }
    // now create new busses
    this.busses.length = 0;
    // dataArray = [];
    // CREATE BUSSES FOR EACH TRACK
    const promiseBuffers: Promise<AudioBuffer>[] = [];
    const convolvers = [];
    console.log('Iterating over channels of number: ', channels.length);
    for (let i = 0; i < channels.length; i += 1) {
      const busGain = this.context.createGain();
      busGain.gain.value = Song.playBackInstrument[i].volume / 100.0;
      // busGain.connect(this.masterGain); COMMENT IN
      const panNode = this.context.createStereoPanner();
      panNode.pan.value = -1 + (channels[i].balance / 127) * 2;
      panNode.connect(busGain);
      // busGain.connect(this.masterGain);

      const chorus = new Chorus(this.context, {
        dryGain: 1 - channels[i].chorus / 127,
        wetGain: channels[i].chorus / 127,
      });
      busGain.connect(chorus.input);
      // chorus.connect(this.masterGain);

      // convolution reverb - expensive
      let convolverGain = null;
      if (this.reverbActive) {
        const convolver = this.context.createConvolver();
        convolvers.push(convolver);
        // convolver.buffer = await AudioEngine.getImpulseBuffer(this.context,
        promiseBuffers.push(AudioEngine.getImpulseBuffer(this.context,
          'audio/convolution.ogg'));
        convolverGain = this.context.createGain();
        const reverbScaling = 0.35;
        convolverGain.gain.value = (channels[i].reverb / 127) * reverbScaling;
        busGain.connect(convolver);
        convolver.connect(convolverGain);
        convolverGain.connect(this.masterGain);
      }
      // freeverb cheaper
      const options = {
        dampening: 3000,
        roomSize: 0.7,
        dryGain: 1.0 - channels[i].reverb / 127,
        wetGain: channels[i].reverb / 127,
      };
      const freeverb = new Freeverb(this.context, options);
      chorus.output.connect(freeverb.input);
      // busGain.connect(freeverb);
      freeverb.output.connect(this.masterGain);
      /* phaser
      var phaser = new tuna.Phaser({
        rate: 1.2,                     //0.01 to 8 is a decent range, but higher values are possible
        depth: 0.3,                    //0 to 1
        feedback: 0.2,                 //0 to 1+
        stereoPhase: 30,               //0 to 180
        baseModulationFrequency: 700,  //500 to 1500
        bypass: (channels[i].reverb == 0) ? 1 : 0
      });
      busGain.connect(phaser);
      var phaserGain = this.context.createGain();
      phaserGain.gain.value = channels[i].phaser/127;
      phaser.connect(phaserGain);
      phaserGain.connect(this.masterGain);
      bus.phaser = [phaser, phaserGain];
      //EFFECT SECTION END */

      /* CREATE ANALYSER */
      const analyser = this.context.createAnalyser();
      analyser.smoothingTimeConstant = 0.9;
      busGain.connect(analyser);
      this.busses[i] = {
        volume: busGain,
        pan: panNode,
        // convolverGain,
        chorus,
        convolver: freeverb,
        analyser,
      };

      analyser.fftSize = 32;
      this.bufferLength = analyser.frequencyBinCount;
    }
    const audioBuffers = await Promise.all(promiseBuffers);
    for (let i = 0; i < audioBuffers.length; i += 1) {
      convolvers[i].buffer = audioBuffers[i];
    }
    this.dataArray = new Uint8Array(this.bufferLength);
  }

  createBusses() {
    // limiter
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -1.0; // this is the pitfall, leave some headroom
    limiter.knee.value = 0.0; // brute force
    limiter.ratio.value = 20.0; // max compression
    limiter.attack.value = 0.005; // 5ms attack
    limiter.release.value = 0.050; // 50ms release
    limiter.connect(this.context.destination);
    // this.masterGain
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1.0;
    // this.masterGain.connect(limiter);
    // create equalizer
    this.equalizerHandler = modalManager.getHandler('equalizerModal') as EqualizerModalHandler;
    this.equalizerHandler.setAudioContext(this.context);
    this.equalizerHandler.insertBetween(this.masterGain, limiter);
    limiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.context.destination);
    this.masterAnalyser.smoothingTimeConstant = 0.9;
    this.masterAnalyser.fftSize = 4096;

    this.limiter = limiter;
    this.masterBufferLength = this.masterAnalyser.frequencyBinCount;
    this.masterDataArray = new Uint8Array(this.masterBufferLength);

    // audioEngine.updateBusses(Song.playBackInstrument);
    // CREATE BUS FOR EACH DRUM COMPONENT
    let i = 0;
    for (const drumInfo of this.noteToDrum.values()) {
      const busGain = this.context.createGain();
      // eslint-disable-next-line prefer-destructuring
      busGain.gain.value = drumInfo[2];
      busGain.connect(this.masterGain);

      const panNode = this.context.createStereoPanner();
      panNode.pan.value = 0;
      panNode.connect(busGain);

      /* CREATE ANALYSER */
      const analyser = this.context.createAnalyser();
      busGain.connect(analyser);
      analyser.fftSize = 32;
      this.drumBufferLength = analyser.frequencyBinCount;

      this.drumBusses[i] = {
        volume: busGain,
        pan: panNode,
        analyser,
      };
      i += 1;
    }
    this.drumDataArray = new Uint8Array(this.drumBufferLength);
  }

  drawVolumeOf(
    analyser: AnalyserNode, dataArray: Uint8Array, bufLength: number,
    ctx: CanvasRenderingContext2D, canvasWidth: number,
    canvasHeight: number, background: string, horizontal: boolean,
  ) {
    analyser.getByteFrequencyData(dataArray);

    let averageVolume = 0;
    for (let j = 0; j < bufLength; j += 1) {
      const x = dataArray[j];
      averageVolume += x * x;
    }
    averageVolume = Math.sqrt(averageVolume / bufLength) * 0.7;
    if (averageVolume !== 0) {
      this.averageVolumeIsNull = false;
      ctx.fillStyle = background;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      if (horizontal) {
        ctx.fillRect(0, 0, (averageVolume / 120) * canvasWidth, canvasHeight);
      } else {
        ctx.fillRect(0, canvasHeight - (averageVolume / 120) * canvasHeight,
          canvasWidth, canvasHeight);
      }
    }
  }

  drawVolumes() {
    if (Settings.songPlaying || !this.averageVolumeIsNull) {
      this.averageVolumeIsNull = true;
      let color = 'rgba(43, 43, 43, 0.47)';
      if (Settings.darkMode) {
        color = '#4d4d4d';
      }
      if (this.dataArray != null) {
        for (let i = 0, n = Song.measures.length; i < n; i += 1) {
          const canvasContext = sequencer.getVolumeCanvasContext(i + 1);
          if (canvasContext != null) {
            this.drawVolumeOf(this.busses[i].analyser, this.dataArray, this.bufferLength,
              canvasContext, 90, 30, color, true);
          }
        }
      }
      if (this.drumDataArray != null) {
        if (modalManager.isModalOpen('mixerModal')) {
          for (let i = 0; i < this.drumBusses.length; i += 1) {
            this.drawVolumeOf(this.drumBusses[i].analyser, this.drumDataArray,
              this.drumBufferLength, (modalManager.getHandler(MODALS.MIXER.id) as MixerModalHandler).getMixerVolumeContext(i)!,
              20, 82, 'rgba(6, 54, 122, 0.72)', false);
          }
        }
      }
      if (this.masterDataArray != null) {
        const canvasContext = sequencer.getVolumeCanvasContext(0);
        if (canvasContext != null) {
          this.drawVolumeOf(this.masterAnalyser, this.masterDataArray, this.masterBufferLength,
            canvasContext, 120, 30, color, true);
        }
        if (modalManager.isModalOpen('equalizerModal')) {
          this.equalizerHandler.drawSpectrum(this.masterDataArray);
        }
      }
      requestAnimationFrame(() => {
        this.drawVolumes();
      });
    }
  }

  setEffectGain(trackIndex: number, value: number, type: string) {
    switch (type) {
      case 'reverb':
        this.busses[trackIndex].convolver.wetGain = value / 127;
        break;
      case 'chorus':
        this.busses[trackIndex].chorus.dry = 1 - value / 127;
        break;
      case 'phaser':
        /* TODO currently not supported
        this.busses[trackIndex].phaser[1].gain.value = value / 127;
        if (value !== 0) {
          this.busses[trackIndex].phaser[0].bypass = 0;
        } else {
          this.busses[trackIndex].phaser[0].bypass = 1;
        } */
        break;
      case 'pan':
        this.busses[trackIndex].pan.pan.value = -1 + (value / 127) * 2;
        break;
      default:
    }
  }

  playDrums(
    trackId: number,
    voiceId: number,
    note: number,
    volume: number,
    noteStart: number,
    beat: Measure,
  ): GainNode | null {
    const drumInfo = this.noteToDrum.get(note);
    if (drumInfo == null || drumInfo[4] === false) {
      return null;
    }
    const source = this.context.createBufferSource();
    const drumsBuffer = this.bufferList.drums;
    /* if(this.noteToDrum[note][2] != null){
            volume *= this.noteToDrum[note][2];
        } */
    if (drumsBuffer[drumInfo[1]].buffer == null) {
      return null;
    }
    source.buffer = drumsBuffer[drumInfo[1]].buffer;
    const gainNode = this.playSource(trackId, voiceId, source, 0, volume, noteStart,
      2, 'drums', beat, null, 0, Song.tracks.length + note - 35);
    return gainNode;
  }

  playSound(
    trackId: number,
    voiceId: number,
    volume: number,
    string: number,
    fretIn: number,
    duration: number,
    startpoint: number,
    type: string,
    beat: Measure,
    noteEffects: Note,
    nextNote: number,
    note: number,
  ): GainNode {
    let fret = fretIn;
    const source = this.context.createBufferSource();
    if (!noteEffects.dead && !noteEffects.slap && !(noteEffects.palmMute && type === 'guitar') && !noteEffects.artificialPresent) {
      const bufferListLength = this.bufferList[type].length;
      if (string >= bufferListLength) {
        console.log(fret, Song.tracks[trackId].strings[string],
          Song.tracks[trackId].strings[bufferListLength - 1]);
        fret += Song.tracks[trackId].strings[string]
          - Song.tracks[trackId].strings[bufferListLength - 1];
        source.buffer = this.bufferList[type][bufferListLength - 1].buffer;
      } else {
        source.buffer = this.bufferList[type][string].buffer;
      }
    } else if (noteEffects.slap) {
      // slap always not pitched
      source.buffer = this.bufferList.slap[0].buffer;
    } else if (noteEffects.dead) {
      source.buffer = this.bufferList.dead[0].buffer;
    } else if (noteEffects.palmMute && type === 'guitar') {
      const bufferListLength = this.bufferList.palmMute.length;
      if (string >= bufferListLength) {
        fret += Song.tracks[trackId].strings[string]
          - Song.tracks[trackId].strings[bufferListLength - 1];
        source.buffer = this.bufferList.palmMute[bufferListLength - 1].buffer;
      } else {
        source.buffer = this.bufferList.palmMute[string].buffer;
      }
    } else if (noteEffects.artificialPresent) {
      source.buffer = this.bufferList.naturalHarmonic[0].buffer;
    }
    /* if(this.bufferList[type][string].loopStart != null){
            source.loop = true;
            source.loopStart = this.bufferList[type][string].loopStart;
            source.loopEnd = this.bufferList[type][string].loopEnd;
        } */
    const isRinging = Song.tracks[trackId].letItRing
      || (noteEffects != null && noteEffects.letRing);
    if (isRinging) {
      if (this.sourcesPlaying[trackId] == null) {
        this.sourcesPlaying[trackId] = [];
      }
      if (this.sourcesPlaying[trackId][string] != null) {
        // smooth out fade
        const gainN = this.sourcesPlaying[trackId][string][2];
        gainN.gain.cancelScheduledValues(Math.max(0, startpoint - 0.2));
        gainN.gain.setValueAtTime(gainN.gain.value, startpoint);
        gainN.gain.exponentialRampToValueAtTime(0.0001, startpoint + 0.3);
      }
    }
    const gainNode = this.playSource(
      trackId, voiceId, source, fret, volume, startpoint, duration,
      type, beat, noteEffects, nextNote, note,
    );

    // make quieter but not end aprubtly
    // let startVolume = gainNode.gain.value;
    // startVolume = Math.max(0.0001, startVolume); // Prevent too small values
    // gainNode.gain.setValueAtTime(startVolume, startpoint+ duration*0.75);
    // gainNode.gain.exponentialRampToValueAtTime(startVolume*0.5, startpoint + duration);
    if (isRinging) {
      this.sourcesPlaying[trackId][string] = [startpoint, source, gainNode];
    }
    return gainNode;
  }

  static noteValueToInteger(noteValue: string): number {
    const noteToHeight: {[a: string]: number} = {
      C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, H: 11,
    };
    return noteToHeight[noteValue.substring(0, noteValue.length - 1)]
      + parseInt(noteValue.substring(noteValue.length - 1), 10) * 12;
  }

  getNearest(type: string, value: number): [number, number] {
    if (this.bufferList[type].length === 0 || this.bufferList[type][0].noteValue === 'X') {
      // Unpitched
      return [0, 0];
    }
    // create list of all objects
    const list = [];
    for (let i = 0; i < this.bufferList[type].length; i += 1) {
      list[i] = AudioEngine.noteValueToInteger(this.bufferList[type][i].noteValue);
    }

    let minDist = 1000;
    let index = 0;
    for (let i = 0; i < list.length; i += 1) {
      if (Math.abs(value - list[i]) < minDist) {
        minDist = Math.abs(list[i] - value);
        index = i;
      }
    }
    return [value - list[index], index];
  }

  // C3 C4 C5 C6
  // play note: C0 = 0 C1 = 12
  playNoteInstrument(
    trackId: number,
    voiceId: number,
    note: number,
    volume: number,
    type: string,
    noteStart: number,
    duration: number,
    beat: Measure,
    noteEffects: Note,
    nextNote: number | null,
  ) {
    if (this.bufferList[type] == null) {
      return null;
    }
    const source = this.context.createBufferSource();
    // source.loop = true;
    const [noteInOctave, nearestId] = this.getNearest(type, note);
    source.buffer = this.bufferList[type][nearestId].buffer;

    /* if(this.bufferList[type][nearestId].loopStart != null){
      source.loop = true;
      source.loopStart = this.bufferList[type][nearestId].loopStart;
      source.loopEnd = this.bufferList[type][nearestId].loopEnd;
    } */

    // play next note on same sound buffer as last
    let nextNoteOctave = -1;
    if (nextNote != null) {
      nextNoteOctave = noteInOctave + nextNote - note;
    }

    const gainNode = this.playSource(trackId, voiceId, source, noteInOctave, volume,
      noteStart, duration, type, beat, noteEffects, nextNoteOctave, note);
    return gainNode;
  }

  loadSF2() {
    // TESTING OF SOUNDFONT
    // sf2Parser.loadSoundFont('./GeneralMidi/Yamaha_XG_Soundset.sf2'); // CHEAPEST
    // sf2Parser.loadSoundFont("./GeneralMidi/Turtle Beach Montego II Aureal GM.sf2");
    // sf2Parser.loadSoundFont("./GeneralMidi/SGM-v2.01-NicePianosGuitarsBass-V1.2.sf2");
    // TODO this is the best one
    sf2Parser.loadSoundFont('./src/assets/audio/Roland SC-55Edited.sf2'); // FAVORITE
    // sf2Parser.loadSoundFont("./GeneralMidi/Timbres Of Heaven GM_GS_XG_SFX V 3.4 Final.sf2");
    // sf2Parser.loadSoundFont("./GeneralMidi/FluidR3 GM2-2.sf2");
    // sf2Parser.loadSoundFont("./GeneralMidi/Arachno SoundFont - Version 1.0.sf2");
    this.theSynth = sf2Parser.getSynth();
    // sf2Parser.loadSoundFont("./GeneralMidi/YamahaXGSoundSet.sf2");
  }

  playSF2(
    trackId: number,
    voiceId: number,
    string: number,
    fret: number,
    volumeIn: number,
    start: number,
    durationIn: number,
    beat: Measure,
    noteEffects: Note | null,
    instr: string,
    nextFretIn: number | null,
  ): GainNode | null {
    const velocity = 100;
    let volume = volumeIn;
    let duration = durationIn;
    const nextFret = nextFretIn;
    let instrumentId;
    if (Song.tracks[trackId].channel == null) {
      instrumentId = Song.tracks[trackId].program;
      if (Song.tracks[trackId].primaryChannel === 9) {
        instrumentId = 9;
      }
    } else {
      instrumentId = Song.allChannels[Song.tracks[trackId].channel.index].cInstrument;
      if (Song.tracks[trackId].channel.index === 9) {
        instrumentId = 9;
      }
    }
    let note = fret + Song.tracks[trackId].capo;
    if (instrumentId !== 9) {
      note += Song.tracks[trackId].strings[string];
    }
    const drumInfo = this.noteToDrum.get(note);
    if (instrumentId === 9 && drumInfo != null && drumInfo[4] === false) {
      return null;
    }
    // console.log(instrumentId, note);
    const res = this.theSynth.noteOn(instrumentId, note, velocity);
    const source = this.context.createBufferSource();

    if (Song.tracks[trackId].letItRing
      || (noteEffects != null && noteEffects.letRing)) {
      duration += 0.5;
    }

    // Extras
    if (noteEffects != null && noteEffects.slap) {
      // slap always not pitched
      source.buffer = this.bufferList.slap[0].buffer;
    } else if (noteEffects != null && noteEffects.dead) {
      // source.buffer = this.bufferList["dead"][0].buffer;
      return null;
      /* }else if(noteEffects.palmMute){
      //TODO Palm Mute on SF2
      if(instr != "guitar" && instr != "eguitar" && instr != "disteguitar" && instr != "mutedGuitar"
          && instr != "nylonGuitar" && instr != "overdriveguitar")
          return;
      var this.bufferListLength = this.bufferList["palmMute"].length;
      if(string >= this.bufferListLength){
          fret += Song.tracks[trackId].strings[string]
          - Song.tracks[trackId].strings[this.bufferListLength-1];
          source.buffer = this.bufferList["palmMute"][this.bufferListLength-1].buffer;
      }else{
          source.buffer = this.bufferList["palmMute"][string].buffer;
      } */
    } else if (noteEffects != null && noteEffects.artificialPresent) {
      source.buffer = this.bufferList.naturalHarmonic[0].buffer;
    } else {
      if (res == null) {
        console.log('BUFFER ERROR: ', trackId, voiceId, string, fret);
        return null;
      }
      source.buffer = res.buffer;
      // source.buffer = this.bufferList["guitar"][0].buffer;
      source.playbackRate.value = res.playBackRate;
      source.loop = res.loop;
      source.loopStart = res.loopStart;
      source.loopEnd = res.loopEnd;
    }

    const { volSustain } = res;
    // var volRelease = res.volRelease;
    const volRelease = 0.015;
    const volEndTime = start + duration + volRelease;

    volume = AudioEngine.getVolumeOfBeat(volume, beat);

    const sf2Gain = this.context.createGain();
    sf2Gain.gain.setValueAtTime(0, start);
    const attackVolume = volume * (velocity / 127);
    sf2Gain.gain.linearRampToValueAtTime(attackVolume, start + res.volAttack);
    const decayVolume = volume * (1 - volSustain);
    sf2Gain.gain.linearRampToValueAtTime(decayVolume, start + res.volDecay);
    let currentVolume = decayVolume;
    if (res.volDecay - res.volAttack !== 0) {
      currentVolume = attackVolume - (decayVolume - attackVolume)
        * Math.min(1, duration / (res.volDecay - res.volAttack));
    }
    // console.log(currentVolume, decayVolume, attackVolume, duration, res.volDecay-res.volAttack);
    sf2Gain.gain.setValueAtTime(currentVolume, start + duration);
    // sf2Gain.gain.linearRampToValueAtTime(0, volEndTime);
    sf2Gain.gain.exponentialRampToValueAtTime(0.000001, start + duration + volRelease);
    source.start(start);
    source.stop(start + duration + volRelease + 0.1);

    // Connect the source to the gain node.
    source.connect(sf2Gain);

    let finalGain = sf2Gain;
    // TODO extra gain node for avoding interference
    if (noteEffects != null) {
      if (noteEffects.trillPresent) {
        const trillGain = this.context.createGain();
        trillGain.gain.setValueAtTime(0, start);
        sf2Gain.connect(trillGain);
        finalGain = trillGain;
        AudioEngine.makeTrill(trillGain, duration + volEndTime, start);
      } else if (noteEffects.bendPresent) { // do not allow bend and vibrato at the same time
        AudioEngine.makeBend(noteEffects.bendObj, source, duration, start, res.playBackRate);
      } else if (noteEffects.slide && nextFret != null) {
        source.playbackRate.setValueAtTime(source.playbackRate.value, start + duration * 0.8);
        source.playbackRate.exponentialRampToValueAtTime(source.playbackRate.value
          * 2 ** ((nextFret - fret) / 12), start + duration);
      } else if (noteEffects.vibrato) {
        // I do not want these effects to overlap during playback
        AudioEngine.makeVibrato(source, duration, start);
      }
    }

    if (instr === 'drums') {
      note -= 35;
      if (this.drumBusses[note] == null) {
        return null;
      }
      finalGain.connect(this.drumBusses[note].pan);
      this.drumBusses[note].pan.connect(this.busses[trackId].pan);
    } else {
      console.log('Connect bus', this.busses);
      finalGain.connect(this.busses[trackId].pan);
    }

    this.playingInstrumentSet.add({
      source, gain: finalGain.gain, trackId, voiceId,
    });
    this.bindedDeleteSource = this.deleteSource.bind(this);
    source.addEventListener('ended', this.bindedDeleteSource);

    /* if(instr != "drums" && !Song.tracks[trackId].letItRing
    && (noteEffects == null || !noteEffects.letRing)){
        sf2Gain.gain.setValueAtTime(sf2Gain.gain.value, start+duration);
        sf2Gain.gain.exponentialRampToValueAtTime(0.000001, start +duration*1.1+0.03);
        //console.log(start +" "+duration);
        //sf2Gain.gain.setTargetAtTime(0, start +duration*1.3, 0.015);
        source.start(start, 0, duration*1.1+1);
    }else{
        //play until the end of the sample
        source.start(start);
    } */
    // console.log(duration+volRelease);

    return sf2Gain;
  }

  deleteSource(event: Event) {
    const target = event.target as AudioBufferSourceNode;
    target.disconnect();
    target.removeEventListener('ended', this.bindedDeleteSource);
    for (const playingInstrument of this.playingInstrumentSet) {
      if (playingInstrument.source === target) {
        this.playingInstrumentSet.delete(playingInstrument);
      }
    }
  }

  static getVolumeOfBeat(
    startVolume: number,
    beat: Measure,
  ): number {
    const typeToVolume: {[a: string]: number} = {
      ppp: 0.2, pp: 0.4, p: 0.6, mp: 0.8, mf: 0.9, f: 1.0, ff: 1.2, fff: 1.4,
    };
    const loudnessProtection = 0.2;
    const extra = 0.075 - Math.random() * 0.15;
    const trimmedValue = Math.max(0.01, (startVolume + extra)) * loudnessProtection;
    if (beat.dynamic != null) {
      return typeToVolume[beat.dynamic] * trimmedValue;
    }
    return trimmedValue;
  }

  playMetronomeNote(startpoint: number, isHigh: boolean) {
    const source = this.context.createBufferSource();
    if (isHigh) {
      source.buffer = this.bufferList.metronome[0].buffer;
    } else {
      source.buffer = this.bufferList.metronome[1].buffer;
    }
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0.15;
    source.connect(gainNode);
    gainNode.connect(this.limiter!);
    source.start(startpoint, 0, 2);
  }

  playSource(
    trackId: number,
    voiceId: number,
    sourceIn: AudioBufferSourceNode,
    noteInOctave: number,
    volume: number,
    startpoint: number,
    duration: number,
    instr: string,
    beat: Measure,
    noteEffects: Note | null,
    nextNote: number,
    note: number,
  ) {
    const source = sourceIn;
    source.playbackRate.value = 2 ** (noteInOctave / 12);

    const gainNode = this.context.createGain();
    gainNode.gain.value = AudioEngine.getVolumeOfBeat(volume, beat);
    // Connect the source to the gain node.
    source.connect(gainNode);
    if (instr === 'disteguitar2') { // channel.distortion !== undefined){
      const waveShaper = this.context.createWaveShaper();
      waveShaper.curve = AudioEngine.smoothDistortion(0.5); // 0, channel.distortion;
      gainNode.gain.value *= 0.4; // PRE
      gainNode.connect(waveShaper);
      const postNode = this.context.createGain();
      postNode.gain.value = 0.3;

      waveShaper.connect(postNode);
      postNode.connect(this.busses[trackId].pan);
    } else if (instr === 'drums') {
      gainNode.connect(this.drumBusses[note].pan);
      this.drumBusses[note].pan.connect(this.busses[trackId].pan);
    } else {
      gainNode.connect(this.busses[trackId].pan);
    }
    const isVibrato = (beat.effects != null && beat.effects.vibrato);
    if (noteEffects != null) {
      if (noteEffects.trillPresent) {
        AudioEngine.makeTrill(gainNode, duration, startpoint);
      } else if (noteEffects.bendPresent && !isVibrato) {
        // do not allow bend and vibrato at the same time
        AudioEngine.makeBend(noteEffects.bendObj, source, duration,
          startpoint, source.playbackRate.value);
      } else if (noteEffects.slide && nextNote !== -1) {
        source.playbackRate.setValueAtTime(source.playbackRate.value, startpoint + duration * 0.8);
        source.playbackRate.exponentialRampToValueAtTime(2 ** (nextNote / 12),
          startpoint + duration);
      }
    }
    if (isVibrato) {
      AudioEngine.makeVibrato(source, duration, startpoint);
    }

    if (instr !== 'drums' && !Song.tracks[trackId].letItRing && (noteEffects == null || !noteEffects.letRing)) {
      gainNode.gain.setValueAtTime(gainNode.gain.value, startpoint + duration);
      gainNode.gain.exponentialRampToValueAtTime(0.000001, startpoint + duration * 1.1 + 0.03);
      // console.log(startpoint +" "+duration);
      // gainNode.gain.setTargetAtTime(0, startpoint +duration*1.3, 0.015);
      source.start(startpoint, 0, duration * 1.1 + 1);
    } else {
      // play until the end of the sample
      source.start(startpoint);
    }

    const playingInstrument = {
      source,
      gain: gainNode.gain,
      trackId,
      voiceId,
    };
    this.playingInstrumentSet.add(playingInstrument);
    source.onended = () => {
      this.playingInstrumentSet.delete(playingInstrument);
    };
    return gainNode;
  }

  stopSourceOfTrack(trackId: number, voiceId: number) {
    const { currentTime } = this.context;
    for (const item of this.playingInstrumentSet) {
      if (item.trackId === trackId && item.voiceId === voiceId) {
        item.gain.cancelScheduledValues(currentTime);
        item.gain.setValueAtTime(item.gain.value, currentTime);
        item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001);
        this.playingInstrumentSet.delete(item);
      }
    }
  }

  stopAllSources() {
    const { currentTime } = this.context;
    for (const item of this.playingInstrumentSet) {
      // item.stop();
      item.gain.cancelScheduledValues(currentTime);
      item.gain.setValueAtTime(item.gain.value, currentTime);
      item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001);
    }
    this.playingInstrumentSet.clear();
  }

  static generateCurve(
    base: number, FREQUENCY: number, SCALE: number, duration: number,
  ): Float32Array {
    // Split the time into valueCount discrete steps.
    const valueCount = 4096;
    const values = new Float32Array(valueCount);
    for (let i = 0; i < valueCount; i += 1) {
      const percent = (i / valueCount) * duration * FREQUENCY;
      values[i] = base + (Math.sin(percent * 2 * Math.PI) * SCALE);
      // Set the last value to one, to restore playbackRate to normal at the end.
      if (i === valueCount - 1) {
        values[i] = 1;
      }
    }
    return values;
  }

  static makeBend(
    bendObj: {bendPosition: number, bendValue: number}[],
    source: AudioBufferSourceNode,
    duration: number,
    startpoint: number,
    playBackRate: number,
  ): void {
    // TODO maybe curve
    // sixties of the note duration /60
    const lastTime = startpoint + duration * (bendObj[0].bendPosition / 60);
    const pBrate = playBackRate * 2 ** ((bendObj[0].bendValue / 100) / 12);
    source.playbackRate.setValueAtTime(pBrate, lastTime);

    for (let i = 1; i < bendObj.length; i += 1) {
      const newTime = startpoint + duration * (bendObj[i].bendPosition / 60);
      const newValue = playBackRate * 2 ** ((bendObj[i].bendValue / 100) / 12);
      source.playbackRate.exponentialRampToValueAtTime(newValue, newTime);
    }
  }

  static makeTrill(gainNode: GainNode, trillDuration: number, startpoint: number): void {
    const FREQUENCY = (Song.bpm / 60) * 2;
    const SCALE = 0.6;
    const volume = gainNode.gain.value;
    // Create a sinusoidal value curve.
    const values = AudioEngine.generateCurve(volume, FREQUENCY, SCALE, trillDuration);
    const trillDur = trillDuration !== -1 ? trillDuration : 3;
    gainNode.gain.setValueCurveAtTime(values, startpoint, trillDur);
  }

  static makeVibrato(
    source: AudioBufferSourceNode, vibratoDuration: number, startpoint: number,
  ): void {
    const FREQUENCY = (Song.bpm / 60) * 2;
    const SCALE = 0.01;
    const playBackRate = source.playbackRate.value;
    // Create a sinusoidal value curve.
    const values = AudioEngine.generateCurve(playBackRate, FREQUENCY, SCALE, vibratoDuration);
    const vibratoDur = (vibratoDuration !== -1) ? vibratoDuration : 3;
    source.playbackRate.setValueCurveAtTime(values, startpoint, vibratoDur);
  }

  static makeDistortion(distValue: number): Float32Array {
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;

    for (let i = 0; i < nSamples; i += 1) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = (3 + distValue) * x * 57 * (deg / (Math.PI + distValue * Math.abs(x)));
    }
    return curve;
  }

  static smoothDistortion(distAmount: number): Float32Array {
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const amount = Math.min(distAmount, 0.9);
    const k = (2 * amount) / (1 - amount);
    for (let i = 0; i < nSamples; i += 1) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }
}

const audioEngine = new AudioEngine();
export { audioEngine, AudioEngine };
export default audioEngine;
