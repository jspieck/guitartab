import Song, { PlayBackInstrument, Beat, Note } from './songData';
import Settings from '../../stores/settingsState';
import { modalManager } from './modals/modalManager';
import { getMeterCanvas } from '../../stores/sequencerState';
import { Chorus, Freeverb } from '../../services/audio/effects';
import sf2Parser from './sf2parser';

import { CompressorModalHandler } from './modals/compressorModalHandler';
import { EqualizerModalHandler } from './modals/equalizerModalHandler';
import {
  generateCurve,
  makeBend,
  makeTrill,
  makeVibrato,
  makeDistortion,
  smoothDistortion,
  setEffectGain as applyEffectGain,
} from '../../services/editor/audioModulation';

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

  /** Drum pieces (MIDI notes) soloed in the Drum Mixer; when any are, only those play. */
  drumSolo: Set<number> = new Set();

  isDrumAudible(note: number): boolean {
    const drumInfo = this.noteToDrum.get(note);
    if (drumInfo == null) {
      return true;
    }
    if (this.drumSolo.size > 0) {
      return this.drumSolo.has(note);
    }
    return drumInfo[4] !== false;
  }

  /** Drum piece bus -> the track bus that plays it (connect() is idempotent). */
  connectDrumBus(drumIndex: number, trackId: number) {
    const drumBus = this.drumBusses[drumIndex];
    const trackBus = this.busses[trackId];
    if (drumBus == null || trackBus == null) {
      return;
    }
    drumBus.volume.connect(trackBus.pan);
  }

  setMasterGain(value: number) {
    this.masterGain.gain.value = value;
  }

  static getImpulseBuffer(audioCtx: AudioContext, impulseUrl: RequestInfo) {
    return fetch(impulseUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer));
  }

  async ensureContextRunning() {
    if (this.context.state === 'closed') {
      void import('../../services/userNotifications').then(({ showUserError }) => {
        showUserError('Audio context is closed. Reload the page to restore playback.');
      });
      return;
    }

    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch (error) {
        console.error('AudioContext resume failed', error);
        void import('../../services/userNotifications').then(({ showUserError }) => {
          showUserError('Could not start audio. Click play again after interacting with the page.');
        });
        return;
      }
    }

    for (const bus of this.busses) {
      bus?.chorus?.ensureStarted();
    }
  }

  async updateBusses(channels: PlayBackInstrument[]) {
    // first disconnect everything: the old chains stay connected to the master
    // otherwise, and drum busses wired into them would sound twice
    for (let i = 0; i < this.busses.length; i += 1) {
      this.busses[i].pan.disconnect();
      this.busses[i].volume.disconnect();
      this.busses[i].analyser.disconnect();
      // also stops the chorus LFOs, which otherwise keep running for every rebuild
      this.busses[i].chorus.dispose();
      this.busses[i].convolver.dispose();
    }
    // now create new busses
    this.busses.length = 0;
    // CREATE BUSSES FOR EACH TRACK
    const promiseBuffers: Promise<AudioBuffer>[] = [];
    const convolvers = [];
    for (let i = 0; i < channels.length; i += 1) {
      const busGain = this.context.createGain();
      busGain.gain.value = Song.playBackInstrument[i].volume / 100.0;
      const panNode = this.context.createStereoPanner();
      panNode.pan.value = -1 + (channels[i].balance / 127) * 2;
      panNode.connect(busGain);

      const chorus = new Chorus(this.context, { wetGain: channels[i].chorus / 127 });
      busGain.connect(chorus.input);

      // convolution reverb - expensive
      let convolverGain = null;
      if (this.reverbActive) {
        const convolver = this.context.createConvolver();
        convolvers.push(convolver);
        promiseBuffers.push(AudioEngine.getImpulseBuffer(this.context,
          'audio/convolution.ogg'));
        convolverGain = this.context.createGain();
        const reverbScaling = 0.35;
        convolverGain.gain.value = (channels[i].reverb / 127) * reverbScaling;
        busGain.connect(convolver);
        convolver.connect(convolverGain);
        convolverGain.connect(this.masterGain);
      }
      // freeverb is cheaper than the convolver
      const freeverb = new Freeverb(this.context, {
        dampening: 3000,
        roomSize: 0.7,
        wetGain: channels[i].reverb / 127,
      });
      chorus.output.connect(freeverb.input);
      freeverb.output.connect(this.masterGain);

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
    // user settings from the Compressor panel (defaults match the values above)
    modalManager.getHandler<CompressorModalHandler>('compressorModal').attach(limiter);
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1.0;
    // create equalizer
    this.equalizerHandler = modalManager.getHandler('equalizerModal') as EqualizerModalHandler;
    this.equalizerHandler.setAudioContext(this.context);
    this.equalizerHandler.insertBetween(this.masterGain, limiter);
    // the analyser passes audio through; connecting the limiter to the destination
    // directly as well would double the output (+6 dB, clipping past the limiter)
    limiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.context.destination);
    this.masterAnalyser.smoothingTimeConstant = 0.9;
    this.masterAnalyser.fftSize = 4096;

    this.limiter = limiter;
    this.masterBufferLength = this.masterAnalyser.frequencyBinCount;
    this.masterDataArray = new Uint8Array(this.masterBufferLength);

    // CREATE BUS FOR EACH DRUM COMPONENT
    let i = 0;
    for (const drumInfo of this.noteToDrum.values()) {
      const busGain = this.context.createGain();
      // eslint-disable-next-line prefer-destructuring
      busGain.gain.value = drumInfo[2];
      // routed into the playing track's bus on demand (connectDrumBus)

      const panNode = this.context.createStereoPanner();
      panNode.pan.value = 0;
      panNode.connect(busGain);

      /* CREATE ANALYSER */
      const analyser = this.context.createAnalyser();
      busGain.connect(analyser);
      // long enough to hold a whole animation frame, so the Drum Mixer's peak meters don't miss hits
      analyser.fftSize = 2048;
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
    // clear even when silent, otherwise the last bar stays frozen after playback
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (averageVolume !== 0) {
      this.averageVolumeIsNull = false;
      ctx.fillStyle = background;
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
          const canvasContext = getMeterCanvas(i + 1);
          if (canvasContext != null) {
            this.drawVolumeOf(this.busses[i].analyser, this.dataArray, this.bufferLength,
              canvasContext, 90, 30, color, true);
          }
        }
      }
      if (this.masterDataArray != null) {
        const canvasContext = getMeterCanvas(0);
        if (canvasContext != null) {
          this.drawVolumeOf(this.masterAnalyser, this.masterDataArray, this.masterBufferLength,
            canvasContext, 120, 30, color, true);
        }
        if (modalManager.isModalOpen('equalizerModal')) {
          this.equalizerHandler!.drawSpectrum(this.masterDataArray);
        }
      }
      requestAnimationFrame(() => {
        this.drawVolumes();
      });
    }
  }

  setEffectGain(trackIndex: number, value: number, type: string) {
    applyEffectGain(this.busses[trackIndex], value, type);
  }

  playDrums(
    trackId: number,
    voiceId: number,
    note: number,
    volume: number,
    noteStart: number,
    beat: Beat,
  ): GainNode | null {
    const drumInfo = this.noteToDrum.get(note);
    if (drumInfo == null || !this.isDrumAudible(note)) {
      return null;
    }
    const source = this.context.createBufferSource();
    const drumsBuffer = this.bufferList.drums;
    if (drumsBuffer[drumInfo[1]].buffer == null) {
      return null;
    }
    source.buffer = drumsBuffer[drumInfo[1]].buffer;
    const gainNode = this.playSource(trackId, voiceId, source, 0, volume, noteStart,
      2, 'drums', beat, null, 0, note - 35);
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
    beat: Beat,
    noteEffects: Note,
    nextNote: number | null,
  ) {
    if (this.bufferList[type] == null) {
      return null;
    }
    const source = this.context.createBufferSource();
    const [noteInOctave, nearestId] = this.getNearest(type, note);
    source.buffer = this.bufferList[type][nearestId].buffer;

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
    // TODO this is the best one
    sf2Parser.loadSoundFont('./audio/Roland SC-55Edited.sf2'); // FAVORITE
    this.theSynth = sf2Parser.getSynth();
  }

  /** The first buffer of an effect sample set, or null while it isn't loaded. */
  loadedSample(name: string): AudioBuffer | null {
    return this.bufferList[name]?.[0]?.buffer ?? null;
  }

  /** SoundFont program, MIDI key and channel for a fret on a track (9 = drums). */
  sf2Target(trackId: number, string: number, fret: number) {
    const track = Song.tracks[trackId];
    let instrumentId;
    if (track.channel == null) {
      instrumentId = track.primaryChannel === 9 ? 9 : track.program;
    } else {
      instrumentId = track.channel.index === 9 ? 9 : Song.allChannels[track.channel.index].cInstrument;
    }
    let note = fret + track.capo;
    if (instrumentId !== 9) {
      note += track.strings[string];
    }
    return { instrumentId, note, channelIndex: track.channel?.index || 0 };
  }

  /** Builds (and caches) the sample buffer for a note without playing it. */
  preloadSF2(trackId: number, string: number, fret: number) {
    if (!this.theSynth?.bankSet?.length) return; // SoundFont not loaded yet
    const { instrumentId, note, channelIndex } = this.sf2Target(trackId, string, fret);
    this.theSynth.noteOn(instrumentId, note, 100, channelIndex);
  }

  playSF2(
    trackId: number,
    voiceId: number,
    string: number,
    fret: number,
    volumeIn: number,
    start: number,
    durationIn: number,
    beat: Beat,
    noteEffects: Note | null,
    instr: string,
    nextFretIn: number | null,
  ): GainNode | null {
    const velocity = 100;
    let volume = volumeIn;
    let duration = durationIn;
    const nextFret = nextFretIn;
    const target = this.sf2Target(trackId, string, fret);
    const { instrumentId, channelIndex } = target;
    let { note } = target;
    const drumInfo = this.noteToDrum.get(note);
    if (instrumentId === 9 && drumInfo != null && !this.isDrumAudible(note)) {
      return null;
    }
    const res = this.theSynth.noteOn(instrumentId, note, velocity, channelIndex);
    const source = this.context.createBufferSource();

    if (Song.tracks[trackId].letItRing
      || (noteEffects != null && noteEffects.letRing)) {
      duration += 0.5;
    }

    // Extras (effect samples fall back to the plain note while they aren't loaded)
    const slapSample = noteEffects?.slap ? this.loadedSample('slap') : null;
    const harmonicSample = noteEffects?.artificialStyle != null ? this.loadedSample('naturalHarmonic') : null;
    if (slapSample) {
      // slap always not pitched
      source.buffer = slapSample;
    } else if (noteEffects != null && noteEffects.dead && !noteEffects.slap) {
      return null;
    } else if (harmonicSample) {
      source.buffer = harmonicSample;
    } else {
      if (res == null) {
        console.log('BUFFER ERROR: ', trackId, voiceId, string, fret);
        return null;
      }
      source.buffer = res.buffer;
      source.playbackRate.value = res.playBackRate;
      source.loop = res.loop;
      source.loopStart = res.loopStart;
      source.loopEnd = res.loopEnd;
    }

    // The envelope comes from the SoundFont; without it (not loaded yet) skip the note.
    if (res == null) {
      return null;
    }
    const { volSustain } = res;
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
    sf2Gain.gain.setValueAtTime(currentVolume, start + duration);
    sf2Gain.gain.exponentialRampToValueAtTime(0.000001, start + duration + volRelease);
    source.start(start);
    source.stop(start + duration + volRelease + 0.1);

    // Connect the source to the gain node.
    source.connect(sf2Gain);

    let finalGain = sf2Gain;
    // TODO extra gain node for avoding interference
    if (noteEffects != null) {
      if (noteEffects.trill != null) {
        const trillGain = this.context.createGain();
        trillGain.gain.setValueAtTime(0, start);
        sf2Gain.connect(trillGain);
        finalGain = trillGain;
        makeTrill(trillGain, duration + volEndTime, start);
      } else if (noteEffects.bendObj != null) { // do not allow bend and vibrato at the same time
        makeBend(noteEffects.bendObj, source, duration, start, res.playBackRate);
      } else if (noteEffects.slide && nextFret != null) {
        source.playbackRate.setValueAtTime(source.playbackRate.value, start + duration * 0.8);
        source.playbackRate.exponentialRampToValueAtTime(source.playbackRate.value
          * 2 ** ((nextFret - fret) / 12), start + duration);
      } else if (noteEffects.vibrato) {
        // I do not want these effects to overlap during playback
        makeVibrato(source, duration, start);
      }
    }

    if (instr === 'drums') {
      note -= 35;
      if (this.drumBusses[note] == null) {
        return null;
      }
      finalGain.connect(this.drumBusses[note].pan);
      this.connectDrumBus(note, trackId);
    } else {
      console.log('Connect bus', this.busses);
      finalGain.connect(this.busses[trackId].pan);
    }

    this.playingInstrumentSet.add({
      source, gain: finalGain.gain, trackId, voiceId,
    });
    this.bindedDeleteSource = this.deleteSource.bind(this);
    source.addEventListener('ended', this.bindedDeleteSource);

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
    beat: Beat,
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

  /**
   * Metronome click: a short synthesized blip (no samples to load), higher and
   * louder on the first beat of a bar.
   */
  playMetronomeNote(startpoint: number, isHigh: boolean) {
    const start = Math.max(startpoint, this.context.currentTime);
    const oscillator = this.context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = isHigh ? 1760 : 1320;
    const gainNode = this.context.createGain();
    const peak = isHigh ? 0.3 : 0.18;
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
    oscillator.connect(gainNode);
    gainNode.connect(this.limiter ?? this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.06);
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
    beat: Beat,
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
      waveShaper.curve = smoothDistortion(0.5); // 0, channel.distortion;
      gainNode.gain.value *= 0.4; // PRE
      gainNode.connect(waveShaper);
      const postNode = this.context.createGain();
      postNode.gain.value = 0.3;

      waveShaper.connect(postNode);
      postNode.connect(this.busses[trackId].pan);
    } else if (instr === 'drums') {
      gainNode.connect(this.drumBusses[note].pan);
      this.connectDrumBus(note, trackId);
    } else {
      gainNode.connect(this.busses[trackId].pan);
    }
    const isVibrato = (beat.effects != null && beat.effects.vibrato);
    if (noteEffects != null) {
      if (noteEffects.trill != null) {
        makeTrill(gainNode, duration, startpoint);
      } else if (noteEffects.bendObj != null && !isVibrato) {
        // do not allow bend and vibrato at the same time
        makeBend(noteEffects.bendObj, source, duration,
          startpoint, source.playbackRate.value);
      } else if (noteEffects.slide && nextNote !== -1) {
        source.playbackRate.setValueAtTime(source.playbackRate.value, startpoint + duration * 0.8);
        source.playbackRate.exponentialRampToValueAtTime(2 ** (nextNote / 12),
          startpoint + duration);
      }
    }
    if (isVibrato) {
      makeVibrato(source, duration, startpoint);
    }

    if (instr !== 'drums' && !Song.tracks[trackId].letItRing && (noteEffects == null || !noteEffects.letRing)) {
      gainNode.gain.setValueAtTime(gainNode.gain.value, startpoint + duration);
      gainNode.gain.exponentialRampToValueAtTime(0.000001, startpoint + duration * 1.1 + 0.03);
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
      item.gain.cancelScheduledValues(currentTime);
      item.gain.setValueAtTime(item.gain.value, currentTime);
      item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001);
    }
    this.playingInstrumentSet.clear();
  }

  static generateCurve(
    base: number, FREQUENCY: number, SCALE: number, duration: number,
  ): Float32Array {
    return generateCurve(base, FREQUENCY, SCALE, duration);
  }

  static makeBend(
    bendObj: {bendPosition: number, bendValue: number}[],
    source: AudioBufferSourceNode,
    duration: number,
    startpoint: number,
    playBackRate: number,
  ): void {
    makeBend(bendObj, source, duration, startpoint, playBackRate);
  }

  static makeTrill(gainNode: GainNode, trillDuration: number, startpoint: number): void {
    makeTrill(gainNode, trillDuration, startpoint);
  }

  static makeVibrato(
    source: AudioBufferSourceNode, vibratoDuration: number, startpoint: number,
  ): void {
    makeVibrato(source, vibratoDuration, startpoint);
  }

  static makeDistortion(distValue: number): Float32Array {
    return makeDistortion(distValue);
  }

  static smoothDistortion(distAmount: number): Float32Array {
    return smoothDistortion(distAmount);
  }
}

const audioEngine = new AudioEngine();
export { audioEngine, AudioEngine };
export default audioEngine;
