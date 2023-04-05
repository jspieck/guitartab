// @ts-nocheck
/*! JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import { audioEngine } from './audioEngine';

/**
 * @param {string} type
 * @param {number} size
 * @param {number} offset
 * @constructor
*/
class RiffChunk {
  type: string;

  size: number;

  offset: number;

  constructor(type: string, size: number, offset: number) {
    /** @type {string} */
    this.type = type;
    /** @type {number} */
    this.size = size;
    /** @type {number} */
    this.offset = offset;
  }
}

const riffParser = {

  /** @type {ByteArray} */
  input: null,
  /** @type {number} */
  ip: 0,
  /** @type {number} */
  length: 0,
  /** @type {Array.<Riff.Chunk>} */
  chunkList: [],
  /** @type {number} */
  offset: 0,
  /** @type {boolean} */
  padding: false,
  /** @type {boolean} */
  bigEndian: false,
  /** @type {string} */
  type: '',
  /** @type {number} */
  size: 0,

  getChunkList() {
    return this.chunkList;
  },

  /**
   * @param {ByteArray} input input buffer.
   * @param {Object=} optParams option parameters.
   * @constructor
   */
  parse(
    inp: ByteArray,
    optParamsIn: {index: number, length: number, padding?: boolean, bigEndian?: boolean},
  ) {
    const optParams = optParamsIn || {};
    this.input = inp;
    this.ip = optParams.index || 0;
    this.length = optParams.length || this.input!.length - this.ip;
    this.offset = this.ip;
    this.padding = optParams.padding != null
      ? optParams.padding
      : true;
    this.bigEndian = optParams.bigEndian != null
      ? optParams.bigEndian
      : false;
    /** @type {number} */
    const plength = this.length + this.offset;
    this.chunkList = [];
    while (this.ip < plength) {
      this.parseChunk();
    }
  },

  parseChunk() {
    /** @type {number} */
    let size;
    if (this.input == null) {
      throw new Error('input is null');
    }
    this.chunkList.push(new RiffChunk(
      String.fromCharCode(
        this.input[this.ip], this.input[this.ip + 1],
        this.input[this.ip + 2], this.input[this.ip + 3],
      ),
      (size = this.bigEndian
        ? ((this.input[this.ip + 4] << 24) | (this.input[this.ip + 5] << 16)
          | (this.input[this.ip + 6] << 8) | (this.input[this.ip + 7])) >>> 0
        : ((this.input[this.ip + 4]) | (this.input[this.ip + 5] << 8)
          | (this.input[this.ip + 6] << 16) | (this.input[this.ip + 7] << 24)) >>> 0
      ),
      this.ip + 8,
    ));
    this.ip += 8;

    this.ip += size;
    // padding
    if (this.padding && ((this.ip - this.offset) & 1) === 1) {
      this.ip += 1;
    }
    // this.ip = this.ip;
  },

  /**
   * @param {number} index chunk index.
   * @return {?Riff.Chunk}
   */
  getChunk(index: number) {
    /** @type {Riff.Chunk} */
    const chunk = this.chunkList[index];
    if (chunk == null) {
      return null;
    }
    return chunk;
  },

  /**
   * @return {number}
   */
  getNumberOfChunks() {
    return this.chunkList.length;
  },
};

const parser = {
  /** @type {Array.<Object>} */
  presetHeader: [] as {
    presetName: string,
    preset: number,
    bank: number,
    presetBagIndex: number,
    library: number,
    genre: number,
    morphology: number,
  }[],
  /** @type {Array.<Object>} */
  presetZone: [] as {
    presetGeneratorIndex: number,
    presetModulatorIndex: number,
  }[],
  /** @type {Array.<Object>} */
  presetZoneModulator: null,
  /** @type {Array.<Object>} */
  presetZoneGenerator: null,
  /** @type {Array.<Object>} */
  instrument: [] as {instrumentName: string, instrumentBagIndex: number}[],
  /** @type {Array.<Object>} */
  instrumentZone: null as {
    instrumentGeneratorIndex: number,
    instrumentModulatorIndex: number
  }[] | null,
  /** @type {Array.<Object>} */
  instrumentZoneModulator: null,
  /** @type {Array.<Object>} */
  instrumentZoneGenerator: null,
  /** @type {Array.<Object>} */
  sampleHeader: null,
  /** @type {Array.<Object>} */
  sample: null,
  /** @type {ByteArray} */
  input: null,

  getSampleHeader(index: number) {
    if (this.sampleHeader === null) {
      throw new Error('sampleHeader not found');
    }
    return this.sampleHeader[index];
  },
  getSample(index: number) {
    if (this.sample === null) {
      throw new Error('sample not found');
    }
    return this.sample[index];
  },
  getSamples() {
    return this.sample;
  },
  getPresets() {
    return this.presetHeader;
  },
  getInstruments() {
    return this.instrument;
  },
  getInstrumentZone() {
    return this.instrumentZone;
  },
  getInstrumentZoneModulator() {
    return this.instrumentZoneModulator;
  },
  getInstrumentZoneGenerator() {
    return this.instrumentZoneGenerator;
  },

  parse(inp) {
    this.input = inp;
    // parse RIFF chunk
    riffParser.parse(this.input, {});
    if (riffParser.getChunkList().length !== 1) {
      throw new Error('wrong chunk length');
    }
    /** @type {?Riff.Chunk} */
    const chunk = riffParser.getChunk(0);
    if (chunk === null) {
      throw new Error('chunk not found');
    }

    this.parseRiffChunk(chunk);
    // console.log(sampleHeader);
    this.input = null;
  },

  /**
   * @param {Riff.Chunk} chunk
   */
  parseRiffChunk(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    // check parse target
    if (chunk.type !== 'RIFF') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    // check signature
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {string} */
    const signature = String.fromCharCode(
      this.input[ip], this.input[ip + 1], this.input[ip + 2], this.input[ip + 3],
    );
    console.log(signature);
    ip += 4;
    if (signature !== 'sfbk') {
      throw new Error(`invalid signature: ${signature}`);
    }
    // read structure
    riffParser.parse(this.input, {
      index: ip,
      length: chunk.size - 4,
    });
    if (riffParser.getNumberOfChunks() !== 3) {
      throw new Error('invalid sfbk structure');
    }
    const infoChunk = riffParser.getChunk(0);
    const sdtaChunk = riffParser.getChunk(1);
    const pdtaChunk = riffParser.getChunk(2);
    if (infoChunk != null) {
      this.parseInfoList(infoChunk);
    }
    if (sdtaChunk != null) {
      this.parseSdtaList(sdtaChunk);
    }
    if (pdtaChunk != null) {
      this.parsePdtaList(pdtaChunk);
    }
  },

  /**
   * @param {Riff.Chunk} chunk
   */
  parseInfoList(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    if (chunk.type !== 'LIST') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    // check signature
    /** @type {string} */
    if (this.input == null) {
      throw new Error('input is null');
    }
    const signature = String.fromCharCode(
      this.input[ip], this.input[ip + 1], this.input[ip + 2], this.input[ip + 3],
    );
    ip += 4;
    if (signature !== 'INFO') {
      throw new Error(`invalid signature: ${signature}`);
    }
    // read structure
    riffParser.parse(this.input, {
      index: ip,
      length: chunk.size - 4,
    });
  },

  /**
   * @param {Riff.Chunk} chunk
   */
  parseSdtaList(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    // check parse target
    console.log(chunk.type);
    if (chunk.type !== 'LIST') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }

    // check signature
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {string} */
    const signature = String.fromCharCode(
      this.input[ip], this.input[ip + 1], this.input[ip + 2], this.input[ip + 3],
    );
    ip += 4;
    if (signature !== 'sdta') {
      throw new Error(`invalid signature: ${signature}`);
    }

    // read structure
    riffParser.parse(this.input, {
      index: ip,
      length: chunk.size - 4,
    });
    if (riffParser.getChunkList().length !== 1) {
      throw new Error('TODO');
    }
    /** @type {{type: string, size: number, offset: number}} */
    this.samplingData = riffParser.getChunk(0);
  },

  /**
   * @param {Riff.Chunk} chunk
   */
  parsePdtaList(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    // check parse target
    if (chunk.type !== 'LIST') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    // check signature
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {string} */
    const signature = String.fromCharCode(
      this.input[ip], this.input[ip + 1], this.input[ip + 2], this.input[ip + 3],
    );
    ip += 4;
    if (signature !== 'pdta') {
      throw new Error(`invalid signature: ${signature}`);
    }
    // read structure
    riffParser.parse(this.input, {
      index: ip,
      length: chunk.size - 4,
    });
    // check number of chunks
    if (riffParser.getNumberOfChunks() !== 9) {
      throw new Error('invalid pdta chunk');
    }
    this.parsePhdr(riffParser.getChunk(0)!);
    this.parsePbag(riffParser.getChunk(1)!);
    this.parsePmod(riffParser.getChunk(2)!);
    this.parsePgen(riffParser.getChunk(3)!);
    this.parseInst(riffParser.getChunk(4)!);
    this.parseIbag(riffParser.getChunk(5)!);
    this.parseImod(riffParser.getChunk(6)!);
    this.parseIgen(riffParser.getChunk(7)!);
    this.parseShdr(riffParser.getChunk(8)!);
  },

  /** Get Preset Header
   * @param {Riff.Chunk} chunk
   */
  parsePhdr(chunk: RiffChunk) {
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {Array.<Object>} */
    this.presetHeader = [];
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    // check parse target
    if (chunk.type !== 'phdr') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    while (ip < size) {
      this.presetHeader.push({
        presetName: String.fromCharCode.apply(null, data.subarray(ip, ip += 20)),
        preset: data[ip] | (data[ip + 1] << 8),
        bank: data[ip + 2] | (data[ip + 3] << 8),
        presetBagIndex: data[ip + 4] | (data[ip + 5] << 8),
        library: (data[ip + 6] | (data[ip + 7] << 8)
          | (data[ip + 8] << 16) | (data[ip + 9] << 24)) >>> 0,
        genre: (data[ip + 10] | (data[ip + 11] << 8)
          | (data[ip + 12] << 16) | (data[ip + 13] << 24)) >>> 0,
        morphology: (data[ip + 14] | (data[ip + 15] << 8)
          | (data[ip + 16] << 16) | (data[ip + 17] << 24)) >>> 0,
      });
      ip += 18;
    }
  },

  /** Get Preset Zone
   * @param {Riff.Chunk} chunk
   */
  parsePbag(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {Array.<Object>} */
    this.presetZone = [];
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    // check parse target
    if (chunk.type !== 'pbag') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    while (ip < size) {
      if (this.input == null) {
        throw new Error('input is null');
      }
      this.presetZone.push({
        presetGeneratorIndex: this.input[ip] | (this.input[ip + 1] << 8),
        presetModulatorIndex: this.input[ip + 2] | (this.input[ip + 3] << 8),
      });
      ip += 4;
    }
  },

  /** Get Preset Modulator
   * @param {Riff.Chunk} chunk
   */
  parsePmod(chunk: RiffChunk) {
    if (chunk.type !== 'pmod') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    this.presetZoneModulator = this.parseModulator(chunk);
  },

  /** Get Preset Zone Generator
   * @param {Riff.Chunk} chunk
   */
  parsePgen(chunk: RiffChunk) {
    if (chunk.type !== 'pgen') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    this.presetZoneGenerator = this.parseGenerator(chunk);
  },

  /** Get Instrument
   * @param {Riff.Chunk} chunk
   */
  parseInst(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {Array.<Object>} */
    this.instrument = [];
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    // check parse target
    if (chunk.type !== 'inst') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    if (this.input == null) {
      throw new Error('input is null');
    }
    while (ip < size) {
      this.instrument.push({
        instrumentName: String.fromCharCode.apply(null, this.input.subarray(ip, ip += 20)),
        instrumentBagIndex: this.input[ip] | (this.input[ip + 1] << 8),
      });
      ip += 2;
    }
  },

  /** Get Instrument Zone
   * @param {Riff.Chunk} chunk
   */
  parseIbag(chunk: RiffChunk) {
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {Array.<Object>} */
    this.instrumentZone = [];
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    if (chunk.type !== 'ibag') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    if (this.input == null) {
      throw new Error('input is null');
    }
    while (ip < size) {
      this.instrumentZone.push({
        instrumentGeneratorIndex: this.input[ip] | (this.input[ip + 1] << 8),
        instrumentModulatorIndex: this.input[ip + 2] | (this.input[ip + 3] << 8),
      });
      ip += 4;
    }
  },

  /** Get Instrument Zone Modulator
   * @param {Riff.Chunk} chunk
   */
  parseImod(chunk: RiffChunk) {
    // check parse target
    if (chunk.type !== 'imod') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    this.instrumentZoneModulator = this.parseModulator(chunk);
  },

  /** Get Instrument Zone Generator
   * @param {Riff.Chunk} chunk
   */
  parseIgen(chunk: RiffChunk) {
    // check parse target
    if (chunk.type !== 'igen') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }
    this.instrumentZoneGenerator = this.parseGenerator(chunk);
  },

  /** Get Sample Header
   * @param {Riff.Chunk} chunk
   */
  parseShdr(chunk: RiffChunk) {
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {Array.<Object>} */
    this.sample = [];
    /** @type {Array.<Object>} */
    this.sampleHeader = [];
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    /** @type {string} */
    let sampleName;
    /** @type {number} */
    let start;
    /** @type {number} */
    let end;
    /** @type {number} */
    let startLoop;
    /** @type {number} */
    let endLoop;
    /** @type {number} */
    let sampleRate;
    /** @type {number} */
    let originalPitch;
    /** @type {number} */
    let pitchCorrection;
    /** @type {number} */
    let sampleLink;
    /** @type {number} */
    let sampleType;

    // check parse target
    if (chunk.type !== 'shdr') {
      throw new Error(`invalid chunk type: ${chunk.type}`);
    }

    while (ip < size) {
      sampleName = String.fromCharCode.apply(null, data.subarray(ip, ip += 20));
      start = (
        (data[ip] << 0) | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)
      ) >>> 0;
      ip += 4;
      end = (
        (data[ip] << 0) | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)
      ) >>> 0;
      ip += 4;
      startLoop = (
        (data[ip] << 0) | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)
      ) >>> 0;
      ip += 4;
      endLoop = (
        (data[ip] << 0) | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)
      ) >>> 0;
      ip += 4;
      sampleRate = (
        (data[ip] << 0) | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)
      ) >>> 0;
      ip += 4;
      originalPitch = data[ip];
      ip += 1;
      pitchCorrection = (data[ip] << 24) >> 24;
      ip += 1;
      sampleLink = data[ip] | (data[ip + 1] << 8);
      ip += 2;
      sampleType = data[ip] | (data[ip + 1] << 8);
      ip += 2;

      //*
      let sampleInner = new Int16Array(new Uint8Array(data.subarray(
        this.samplingData.offset + start * 2,
        this.samplingData.offset + end * 2,
      )).buffer);

      startLoop -= start;
      endLoop -= start;

      if (sampleRate > 0) {
        const adjust = this.adjustSampleData(sampleInner, sampleRate);
        sampleInner = adjust.sample;
        sampleRate *= adjust.multiply;
        startLoop *= adjust.multiply;
        endLoop *= adjust.multiply;
      }

      this.sample.push(sampleInner);
      this.sampleHeader.push({
        sampleName,
        /*
        start: start,
        end: end,
        */
        startLoop,
        endLoop,
        sampleRate,
        originalPitch,
        pitchCorrection,
        sampleLink,
        sampleType,
      });
    }
  },

  adjustSampleData(sample: Int16Array, sampleRate: number) {
    /** @type {Int16Array} */
    let newSample;
    /** @type {number} */
    let i;
    /** @type {number} */
    let il;
    /** @type {number} */
    let j;
    /** @type {number} */
    let multiply = 1;

    // buffer
    while (sampleRate < 22050) {
      newSample = new Int16Array(sample.length * 2);
      j = 0;
      for (i = 0, il = sample.length; i < il; i += 1) {
        newSample[j] = sample[i];
        newSample[j + 1] = sample[i];
        j += 2;
      }
      this.sample = newSample;
      multiply *= 2;
      this.sampleRate *= 2;
    }
    return {
      sample,
      multiply,
    };
  },

  /**
   * @param {Riff.Chunk} chunk
   * @return {Array.<Object>}
   */
  parseModulator(chunk: RiffChunk) {
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    /** @type {number} */
    let code;
    /** @type {string} */
    let key;
    /** @type {Array.<Object>} */
    const output = [];

    while (ip < size) {
      // Src  Oper
      // TODO
      ip += 2;
      // Dest Oper
      code = data[ip] | (data[ip + 1] << 8);
      ip += 2;
      key = parser.getGeneratorEnumeratorTable(code);
      if (key == null) {
        // Amount
        output.push({
          type: key,
          value: {
            code,
            amount: data[ip] | (((data[ip + 1] << 8) << 16) >> 16),
            lo: data[ip],
            hi: data[ip + 1],
          },
        });
        ip += 2;
      } else {
        // Amount
        switch (key) {
          case 'keyRange': /* FALLTHROUGH */
          case 'velRange': /* FALLTHROUGH */
          case 'keynum': /* FALLTHROUGH */
          case 'velocity':
            output.push({
              type: key,
              value: {
                lo: data[ip],
                hi: data[ip + 1],
              },
            });
            ip += 2;
            break;
          default:
            output.push({
              type: key,
              value: {
                amount: data[ip] | (((data[ip + 1] << 8) << 16) >> 16),
              },
            });
            ip += 2;
            break;
        }
      }
      // AmtSrcOper
      // TODO
      ip += 2;
      // Trans Oper
      // TODO
      ip += 2;
    }
    return output;
  },

  /**
   * @param {Riff.Chunk} chunk
   * @return {Array.<Object>}
   */
  parseGenerator(chunk: RiffChunk) {
    if (this.input == null) {
      throw new Error('input is null');
    }
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */
    let ip = chunk.offset;
    /** @type {number} */
    const size = chunk.offset + chunk.size;
    /** @type {number} */
    let code;
    /** @type {string} */
    let key;
    /** @type {Array.<Object>} */
    const output = [];

    while (ip < size) {
      code = data[ip] | (data[ip + 1] << 8);
      ip += 2;
      key = parser.getGeneratorEnumeratorTable(code);
      if (key == null) {
        output.push({
          type: key,
          value: {
            code,
            amount: data[ip] | (((data[ip + 1] << 8) << 16) >> 16),
            lo: data[ip],
            hi: data[ip + 1],
          },
        });
        ip += 2;
      } else {
        switch (key) {
          case 'keynum': /* FALLTHROUGH */
          case 'keyRange': /* FALLTHROUGH */
          case 'velRange': /* FALLTHROUGH */
          case 'velocity':
            output.push({
              type: key,
              value: {
                lo: data[ip],
                hi: data[ip + 1],
              },
            });
            ip += 2;
            break;
          default:
            output.push({
              type: key,
              value: {
                amount: data[ip] | (((data[ip + 1] << 8) << 16) >> 16),
              },
            });
            ip += 2;
            break;
        }
      }
    }

    return output;
  },

  createInstrument() {
    /** @type {Array.<Object>} */
    const zone = this.instrumentZone;
    /** @type {Array.<Object>} */
    const output = [];
    /** @type {number} */
    let bagIndex;
    /** @type {number} */
    let bagIndexEnd;
    /** @type {Array.<Object>} */
    let zoneInfo;
    /** @type {{generator: Object, generatorInfo: Array.<Object>}} */
    let instrumentGenerator;
    /** @type {{modulator: Object, modulatorInfo: Array.<Object>}} */
    let instrumentModulator;

    if (this.instrument == null) {
      throw new Error('Instrument is null');
    }

    // instrument -> instrument bag -> generator / modulator
    for (let i = 0, il = this.instrument.length; i < il; i += 1) {
      bagIndex = this.instrument[i].instrumentBagIndex;
      bagIndexEnd = this.instrument[i + 1]
        ? this.instrument[i + 1].instrumentBagIndex
        : zone!.length;
      zoneInfo = [];

      // instrument bag
      for (let j = bagIndex, jl = bagIndexEnd; j < jl; j += 1) {
        instrumentGenerator = this.createInstrumentGenerator(zone, j);
        instrumentModulator = this.createInstrumentModulator(zone, j);

        zoneInfo.push({
          generator: instrumentGenerator.generator,
          generatorSequence: instrumentGenerator.generatorInfo,
          modulator: instrumentModulator.modulator,
          modulatorSequence: instrumentModulator.modulatorInfo,
        });
      }
      output.push({
        name: this.instrument[i].instrumentName,
        info: zoneInfo,
      });
    }
    return output;
  },

  createPreset() {
    /** @type {Array.<Object>} */
    const preset = this.presetHeader;
    /** @type {Array.<Object>} */
    const zone = this.presetZone;
    /** @type {Array.<Object>} */
    const output = [];
    /** @type {number} */
    let bagIndex;
    /** @type {number} */
    let bagIndexEnd;
    /** @type {Array.<Object>} */
    let zoneInfo;
    /** @type {{generator: Object, generatorInfo: Array.<Object>}} */
    let presetGenerator;
    /** @type {{modulator: Object, modulatorInfo: Array.<Object>}} */
    let presetModulator;

    if (preset == null) {
      throw new Error('Preset is null');
    }
    // preset -> preset bag -> generator / modulator
    for (let i = 0, il = preset.length; i < il; i += 1) {
      bagIndex = preset[i].presetBagIndex;
      bagIndexEnd = preset[i + 1]
        ? preset[i + 1].presetBagIndex
        : zone.length;
      zoneInfo = [];

      /** @type {number} */
      let instrument = null;
      // preset bag
      for (let j = bagIndex, jl = bagIndexEnd; j < jl; j += 1) {
        presetGenerator = this.createPresetGenerator(zone, j);
        presetModulator = this.createPresetModulator(zone, j);

        zoneInfo.push({
          generator: presetGenerator.generator,
          generatorSequence: presetGenerator.generatorInfo,
          modulator: presetModulator.modulator,
          modulatorSequence: presetModulator.modulatorInfo,
        });

        if (instrument == null) {
          if (presetGenerator.generator.instrument != null) {
            instrument = presetGenerator.generator.instrument.amount;
          } else if (presetModulator.modulator.instrument != null) {
            instrument = presetModulator.modulator.instrument.amount;
          } else {
            instrument = null;
          }
        }
      }

      output.push({
        name: preset[i].presetName,
        info: zoneInfo,
        header: preset[i],
        instrument,
      });
    }

    return output;
  },

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @returns {{generator: Object, generatorInfo: Array.<Object>}}
   * @private
   */
  createInstrumentGenerator(zone, index) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].instrumentGeneratorIndex,
      zone[index + 1]
        ? zone[index + 1].instrumentGeneratorIndex
        : this.instrumentZoneGenerator.length,
      this.instrumentZoneGenerator,
    );
    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo,
    };
  },

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @returns {{modulator: Object, modulatorInfo: Array.<Object>}}
   * @private
   */
  createInstrumentModulator(zone, index: number) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].presetModulatorIndex,
      zone[index + 1]
        ? zone[index + 1].instrumentModulatorIndex
        : this.instrumentZoneModulator.length,
      this.instrumentZoneModulator,
    );

    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo,
    };
  },

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @returns {{generator: Object, generatorInfo: Array.<Object>}}
   * @private
   */
  createPresetGenerator(zone, index: number) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].presetGeneratorIndex,
      zone[index + 1]
        ? zone[index + 1].presetGeneratorIndex
        : this.presetZoneGenerator.length,
      this.presetZoneGenerator,
    );
    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo,
    };
  },

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @returns {{modulator: Object, modulatorInfo: Array.<Object>}}
   * @private
  */
  createPresetModulator(zone, index) {
    /** @type {{modgen: Object, modgenInfo: Array.<Object>}} */
    const modgen = this.createBagModGen(
      zone,
      zone[index].presetModulatorIndex,
      zone[index + 1]
        ? zone[index + 1].presetModulatorIndex
        : this.presetZoneModulator.length,
      this.presetZoneModulator,
    );
    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo,
    };
  },

  /**
   * @param {Array.<Object>} zone
   * @param {number} indexStart
   * @param {number} indexEnd
   * @param zoneModGen
   * @returns {{modgen: Object, modgenInfo: Array.<Object>}}
   * @private
   */
  createBagModGen(zone, indexStart: number, indexEnd: number, zoneModGen) {
    /** @type {Array.<Object>} */
    const modgenInfo = [];
    /** @type {Object} */
    const modgen = {
      unknown: [],
      keyRange: {
        hi: 127,
        lo: 0,
      },
    }; // TODO
    for (let i = indexStart, il = indexEnd; i < il; i += 1) {
      const info = zoneModGen[i];
      modgenInfo.push(info);
      if (info.type === 'unknown') {
        modgen.unknown.push(info.value);
      } else {
        modgen[info.type] = info.value;
      }
    }
    return {
      modgen,
      modgenInfo,
    };
  },

  /**
   * @type {Array.<string>}
   * @const
   */
  GeneratorEnumeratorTable: [
    'startAddrsOffset',
    'endAddrsOffset',
    'startloopAddrsOffset',
    'endloopAddrsOffset',
    'startAddrsCoarseOffset',
    'modLfoToPitch',
    'vibLfoToPitch',
    'modEnvToPitch',
    'initialFilterFc',
    'initialFilterQ',
    'modLfoToFilterFc',
    'modEnvToFilterFc',
    'endAddrsCoarseOffset',
    'modLfoToVolume',
    null, // 14
    'chorusEffectsSend',
    'reverbEffectsSend',
    'pan',
    null,
    null,
    null, // 18,19,20
    'delayModLFO',
    'freqModLFO',
    'delayVibLFO',
    'freqVibLFO',
    'delayModEnv',
    'attackModEnv',
    'holdModEnv',
    'decayModEnv',
    'sustainModEnv',
    'releaseModEnv',
    'keynumToModEnvHold',
    'keynumToModEnvDecay',
    'delayVolEnv',
    'attackVolEnv',
    'holdVolEnv',
    'decayVolEnv',
    'sustainVolEnv',
    'releaseVolEnv',
    'keynumToVolEnvHold',
    'keynumToVolEnvDecay',
    'instrument',
    null, // 42
    'keyRange',
    'velRange',
    'startloopAddrsCoarseOffset',
    'keynum',
    'velocity',
    'initialAttenuation',
    null, // 49
    'endloopAddrsCoarseOffset',
    'coarseTune',
    'fineTune',
    'sampleID',
    'sampleModes',
    null, // 55
    'scaleTuning',
    'exclusiveClass',
    'overridingRootKey',
  ],

  getGeneratorEnumeratorTable(index: number) {
    return this.GeneratorEnumeratorTable[index];
  },
};

const synthesizerNote = {
  noteOn(instrument: {
    channel: number, sample: Int16Array, basePlaybackRate: number,
    sampleRate: number, volAttack: number,
    volDecay: number, loopStart: number, loopEnd: number, end: number
  }) {
    /** @type {number} */
    const { channel } = instrument;
    /** @type {number} */
    // const key = instrument['key'];
    /** @type {number} */
    // const velocity = instrument['velocity'];
    /** @type {Int16Array} */
    const buffer = instrument.sample;
    /** @type {number} */
    const playbackRate = instrument.basePlaybackRate;
    /** @type {number} */
    const { sampleRate } = instrument;
    /** @type {number} */
    // const volume = instrument['volume'];
    /** @type {number} */
    // const panpot = instrument['panpot'];
    /** @type {number} */
    // const pitchBend = instrument['pitchBend'];
    /** @type {number} */
    // const pitchBendSensitivity = instrument['pitchBendSensitivity'];
    /** @type {number} */
    // const modEnvToPitch = instrument['modEnvToPitch'];

    // state
    /** @type {number} */
    // const startTime = audioEngine.getCurrentTime();
    /** @type {number} */
    // const computedPlaybackRate = playbackRate;
    /** @type {Int16Array} */
    let sample = buffer;
    /** @type {number} */
    const { volAttack } = instrument;
    /** @type {number} */
    // const { modAttack } = instrument;
    /** @type {number} */
    const volDecay = volAttack + instrument.volDecay;
    /** @type {number} */
    // const modDecay = modAttack + instrument.modDecay;
    /** @type {number} */
    const loopStart = instrument.loopStart / sampleRate;
    /** @type {number} */
    const loopEnd = instrument.loopEnd / sampleRate;
    /** @type {number} */
    // const startTime = instrument['start'] / sampleRate;

    sample = sample.subarray(0, sample.length + instrument.end);
    /** @type {AudioBuffer} */
    const bufferInner = audioEngine.createBuffer(1, sample.length, sampleRate);
    /** @type {Float32Array} */
    const channelData = bufferInner.getChannelData(0);

    /* var convertToWebAudio = function(sampleInner){
        var newSample = new Int16Array(sample.length);
        for (var i = 0, il = sample.length; i < il; ++i) {
            if(sample[i] >= 0)
                newSample[i] = sample[i]/32767;
            else
                newSample[i] = sample[i]/32768;
        }
        return newSample;
    } */

    const int16ToFloat32 = function int16ToFloat32(inputArray, startIndex: number, length: number) {
      const output = new Float32Array(inputArray.length - startIndex);
      for (let i = startIndex; i < length; i += 1) {
        const int = inputArray[i];
        // If the high bit is on, then it is a negative number, and actually counts backwards.
        const float = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
        output[i] = float;
      }
      return output;
    };

    const sam = int16ToFloat32(sample, 0, sample.length);
    channelData.set(sam);

    return {
      buffer: bufferInner,
      volAttack,
      volDecay,
      playBackRate: playbackRate,
      loop: (channel !== 9),
      loopStart,
      loopEnd,
      volSustain: instrument.volSustain,
      volRelease: instrument.volRelease,
    };

    // this.updatePitchBend(this.pitchBend);

    // audio node
    /** @type {AudioPannerNode} */
    // var panner = context.createPanner();

    /** @type {BiquadFilterNode} */
    // var filter = context.createBiquadFilter();
    // filter.type = 'lowpass';

    /* panpot
    panner.panningModel = 0;
    panner.setPosition(
        Math.sin(this.panpot * Math.PI / 2),
        0,
        Math.cos(this.panpot * Math.PI / 2)
    ); */

    // filter.Q.setValueAtTime(instrument['initialFilterQ'] * Math.pow(10, 200), now);
    /** @type {number} */
    // var baseFreq = amountToFreq(instrument['initialFilterFc']);
    /** @type {number} */
    // var peekFreq = amountToFreq(instrument['initialFilterFc'] + instrument['modEnvToFilterFc']);
    /** @type {number} */
    // var sustainFreq = baseFreq + (peekFreq - baseFreq) * (1 - instrument['modSustain']);
    // filter.frequency.setValueAtTime(baseFreq, now);
    // filter.frequency.linearRampToValueAtTime(peekFreq, modAttack);
    // filter.frequency.linearRampToValueAtTime(sustainFreq, modDecay);

    /**
    * @param {number} val
    * @returns {number}
    */
    // function amountToFreq(val) {
    //    return Math.pow(2, (val - 6900) / 1200) * 440;
    // }
    // connect
    // bufferSource.connect(filter);
    // filter.connect(panner);
    // panner.connect(output);
    // filter.connect(output);
    // output.connect(destination);
    // fire
    // bufferSource.start(0, startTime, 1);
  },
};

const synth = {
  /** @type {number} */
  bank: 0,
  /** @type {Array.<Array.<Object>>} */
  bankSet: [],
  /** @type {number} */
  bufferSize: 1024,
  /** @type {AudioContext} */
  ctx: null,
  /** @type {Array.<number>} */
  channelInstrument:
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 10, 11, 12, 13, 14, 15],
  /** @type {Array.<number>} */
  channelVolume:
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /** @type {Array.<number>} */
  channelPanpot:
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /** @type {Array.<number>} */
  channelPitchBend:
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  channelPitchBendSensitivity:
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  /** @type {HTMLTableElement} */
  table: null,

  getBankSet() {
    return this.bankSet;
  },

  ProgramNames: [
    'Acoustic Piano',
    'Bright Piano',
    'Electric Grand Piano',
    'Honky-tonk Piano',
    'Electric Piano',
    'Electric Piano 2',
    'Harpsichord',
    'Clavi',
    'Celesta',
    'Glockenspiel',
    'Musical box',
    'Vibraphone',
    'Marimba',
    'Xylophone',
    'Tubular Bell',
    'Dulcimer',
    'Drawbar Organ',
    'Percussive Organ',
    'Rock Organ',
    'Church organ',
    'Reed organ',
    'Accordion',
    'Harmonica',
    'Tango Accordion',
    'Acoustic Guitar (nylon)',
    'Acoustic Guitar (steel)',
    'Electric Guitar (jazz)',
    'Electric Guitar (clean)',
    'Electric Guitar (muted)',
    'Overdriven Guitar',
    'Distortion Guitar',
    'Guitar harmonics',
    'Acoustic Bass',
    'Electric Bass (finger)',
    'Electric Bass (pick)',
    'Fretless Bass',
    'Slap Bass 1',
    'Slap Bass 2',
    'Synth Bass 1',
    'Synth Bass 2',
    'Violin',
    'Viola',
    'Cello',
    'Double bass',
    'Tremolo Strings',
    'Pizzicato Strings',
    'Orchestral Harp',
    'Timpani',
    'String Ensemble 1',
    'String Ensemble 2',
    'Synth Strings 1',
    'Synth Strings 2',
    'Voice Aahs',
    'Voice Oohs',
    'Synth Voice',
    'Orchestra Hit',
    'Trumpet',
    'Trombone',
    'Tuba',
    'Muted Trumpet',
    'French horn',
    'Brass Section',
    'Synth Brass 1',
    'Synth Brass 2',
    'Soprano Sax',
    'Alto Sax',
    'Tenor Sax',
    'Baritone Sax',
    'Oboe',
    'English Horn',
    'Bassoon',
    'Clarinet',
    'Piccolo',
    'Flute',
    'Recorder',
    'Pan Flute',
    'Blown Bottle',
    'Shakuhachi',
    'Whistle',
    'Ocarina',
    'Lead 1 (square)',
    'Lead 2 (sawtooth)',
    'Lead 3 (calliope)',
    'Lead 4 (chiff)',
    'Lead 5 (charang)',
    'Lead 6 (voice)',
    'Lead 7 (fifths)',
    'Lead 8 (bass + lead)',
    'Pad 1 (Fantasia)',
    'Pad 2 (warm)',
    'Pad 3 (polysynth)',
    'Pad 4 (choir)',
    'Pad 5 (bowed)',
    'Pad 6 (metallic)',
    'Pad 7 (halo)',
    'Pad 8 (sweep)',
    'FX 1 (rain)',
    'FX 2 (soundtrack)',
    'FX 3 (crystal)',
    'FX 4 (atmosphere)',
    'FX 5 (brightness)',
    'FX 6 (goblins)',
    'FX 7 (echoes)',
    'FX 8 (sci-fi)',
    'Sitar',
    'Banjo',
    'Shamisen',
    'Koto',
    'Kalimba',
    'Bagpipe',
    'Fiddle',
    'Shanai',
    'Tinkle Bell',
    'Agogo',
    'Steel Drums',
    'Woodblock',
    'Taiko Drum',
    'Melodic Tom',
    'Synth Drum',
    'Reverse Cymbal',
    'Guitar Fret Noise',
    'Breath Noise',
    'Seashore',
    'Bird Tweet',
    'Telephone Ring',
    'Helicopter',
    'Applause',
    'Gunshot',
  ],

  init(input) {
    this.bankSet = this.createAllInstruments(input);
  },

  createAllInstruments(input) {
    parser.parse(input);
    /** @type {Array} */
    const presets = parser.createPreset();
    /** @type {Array} */
    const instruments = parser.createInstrument();
    /** @type {Object} */
    const banks = [];
    /** @type {Array.<Array.<Object>>} */
    let bank;
    /** @type {Object} */
    let preset;
    /** @type {Object} */
    let instrument;
    /** @type {number} */
    let presetNumber;

    for (let i = 0, il = presets.length; i < il; i += 1) {
      preset = presets[i];
      presetNumber = preset.header.preset;

      if (typeof preset.instrument === 'number') {
        // FALSE NUMBER HERE
        instrument = instruments[preset.instrument];
        if (instrument.name.replace(/\0*$/, '') !== 'EOI') {
          // select bank
          if (banks[preset.header.bank] == null) {
            banks[preset.header.bank] = [];
          }
          bank = banks[preset.header.bank];
          bank[presetNumber] = [];
          bank[presetNumber].name = preset.name;

          for (let j = 0, jl = instrument.info.length; j < jl; j += 1) {
            this.createNoteInfo(instrument.info[j], bank[presetNumber]);
          }
        }
      }
    }
    return banks;
  },

  createNoteInfo(info, presetIn) {
    const preset = presetIn;
    const { generator } = info;
    /** @type {number} */
    let sampleId;
    /** @type {Object} */
    let sampleHeader;

    if (generator.keyRange == null || generator.sampleID == null) {
      return;
    }
    /** @type {number} */
    const volAttack = this.getModGenAmount(generator, 'attackVolEnv', -12000);
    /** @type {number} */
    const volDecay = this.getModGenAmount(generator, 'decayVolEnv', -12000);
    /** @type {number} */
    const volSustain = this.getModGenAmount(generator, 'sustainVolEnv');
    /** @type {number} */
    const volRelease = this.getModGenAmount(generator, 'releaseVolEnv', -12000);
    /** @type {number} */
    const modAttack = this.getModGenAmount(generator, 'attackModEnv', -12000);
    /** @type {number} */
    const modDecay = this.getModGenAmount(generator, 'decayModEnv', -12000);
    /** @type {number} */
    const modSustain = this.getModGenAmount(generator, 'sustainModEnv');
    /** @type {number} */
    const modRelease = this.getModGenAmount(generator, 'releaseModEnv', -12000);

    /** @type {number} */
    const tune = (
      this.getModGenAmount(generator, 'coarseTune')
      + this.getModGenAmount(generator, 'fineTune') / 100
    );
    /** @type {number} */
    const scale = this.getModGenAmount(generator, 'scaleTuning', 100) / 100;
    /** @type {number} */
    const freqVibLFO = this.getModGenAmount(generator, 'freqVibLFO');

    for (let i = generator.keyRange.lo, il = generator.keyRange.hi; i <= il; i += 1) {
      if (preset[i]) {
        // Do nothing
      } else {
        sampleId = this.getModGenAmount(generator, 'sampleID');
        sampleHeader = parser.getSampleHeader(sampleId);
        preset[i] = {
          sample: parser.getSample(sampleId),
          sampleRate: sampleHeader.sampleRate,
          basePlaybackRate: (2 ** (1 / 12)) ** (
            i - this.getModGenAmount(generator, 'overridingRootKey', sampleHeader.originalPitch)
            + tune + (sampleHeader.pitchCorrection / 100)
          ) * scale,
          modEnvToPitch: this.getModGenAmount(generator, 'modEnvToPitch') / 100,
          scaleTuning: scale,
          start:
            this.getModGenAmount(generator, 'startAddrsCoarseOffset') * 32768
            + this.getModGenAmount(generator, 'startAddrsOffset'),
          end:
            this.getModGenAmount(generator, 'endAddrsCoarseOffset') * 32768
            + this.getModGenAmount(generator, 'endAddrsOffset'),
          loopStart: (
            // (sampleHeader.startLoop - sampleHeader.start) +
            (sampleHeader.startLoop)
            + this.getModGenAmount(generator, 'startloopAddrsCoarseOffset') * 32768
            + this.getModGenAmount(generator, 'startloopAddrsOffset')
          ),
          loopEnd: (
            // (sampleHeader.endLoop - sampleHeader.start) +
            (sampleHeader.endLoop)
            + this.getModGenAmount(generator, 'endloopAddrsCoarseOffset') * 32768
            + this.getModGenAmount(generator, 'endloopAddrsOffset')
          ),
          volAttack: 2 ** (volAttack / 1200),
          volDecay: 2 ** (volDecay / 1200),
          volSustain: volSustain / 1000,
          volRelease: 2 ** (volRelease / 1200),
          modAttack: 2 ** (modAttack / 1200),
          modDecay: 2 ** (modDecay / 1200),
          modSustain: modSustain / 1000,
          modRelease: 2 ** (modRelease / 1200),
          initialFilterFc: this.getModGenAmount(generator, 'initialFilterFc', 13500),
          modEnvToFilterFc: this.getModGenAmount(generator, 'modEnvToFilterFc'),
          initialFilterQ: this.getModGenAmount(generator, 'initialFilterQ'),
          freqVibLFO: freqVibLFO
            ? 2 ** (freqVibLFO / 1200) * 8.176
            : null,
        };
      }
    }
  },

  getModGenAmount(generator, enumeratorType, optDefaultIn?) {
    const optDefault = (optDefaultIn == null)
      ? 0
      : optDefaultIn;
    return generator[enumeratorType]
      ? generator[enumeratorType].amount
      : optDefault;
  },

  /**
  * @param {number} channel
  * @param {number} key
  * @param {number} velocity
  */
  noteOn(channel: number, key: number, velocity: number) {
    /** @type {Object} */
    const bankInner: { channel: number,
      key: number,
      velocity: number,
      panpot: number,
      volume: number,
      pitchBend: number,
      pitchBendSensitivity: number,
    }[] = this.bankSet[channel === 9 ? 128 : this.bank];

    /** @type {Object} */
    const instrument = bankInner[channel];
    if (channel === 9) {
      // eslint-disable-next-line prefer-destructuring
      this.instrument = bankInner[0]; // POP DRUMS
    }
    // console.log(instrument);

    if (!instrument) {
      console.log('Instrument not found! ', channel);
      return null;
    }

    /** @type {Object} */
    const instrumentKey = instrument[key];
    if (!(instrumentKey)) {
      console.log('Instrumentkey not found! ', instrument, key, instrumentKey);
      return null;
    }

    let panpot = this.channelPanpot[channel] - 64;
    panpot /= panpot < 0 ? 64 : 63;
    // create note information
    instrumentKey.channel = channel;
    instrumentKey.key = key;
    instrumentKey.velocity = velocity;
    instrumentKey.panpot = panpot;
    instrumentKey.volume = this.channelVolume[channel] / 127;
    instrumentKey.pitchBend = this.channelPitchBend[channel] - 8192;
    instrumentKey.pitchBendSensitivity = this.channelPitchBendSensitivity[channel];
    // console.log(instrumentKey);
    return synthesizerNote.noteOn(instrumentKey);
  },
};

const sf2Parser = {
  /** @type {Array.<number>} */
  RpnMsb: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /** @type {Array.<number>} */
  RpnLsb: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /** @type {boolean} */
  ready: false,

  loadSoundFont(url: string) {
    /** @type {XMLHttpRequest} */
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.addEventListener('load', (ev) => {
      /** @type {XMLHttpRequest} */
      const xhrInner = ev.target;
      if (xhrInner != null) {
        this.onload(xhrInner.response);
      }
    }, false);
    xhr.send();
  },

  /**
   * @param {ArrayBuffer} response
   */
  onload(response: ArrayBuffer) {
    /** @type {Uint8Array} */
    const input = new Uint8Array(response);
    this.load(input);
  },

  /**
   * @param {Uint8Array} input
   */
  load(input: Uint8Array) {
    synth.init(input);
    // synth.start();
    // synth.refreshInstruments(input);
    // Test Note
    // synth.noteOn(channel, message[1], message[2]);
  },

  getSynth() {
    return synth;
  },
};

export default sf2Parser;
