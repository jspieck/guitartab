import GProReader from './GProReader';

const HEADER_BCFS = 1397113666;
const HEADER_BCFZ = 1514554178;

class GPXByteBuffer {
  position: number;

  buffer: Uint8Array;

  BUFFER_TYPE_BITS: number;

  constructor(bytes: Uint8Array) {
    this.position = 0;
    this.buffer = bytes;
    this.BUFFER_TYPE_BITS = 8;
  }

  length() {
    return this.buffer.length;
  }

  offset() {
    return this.position / this.BUFFER_TYPE_BITS;
  }

  end() {
    return this.offset() >= this.length();
  }

  readBit(): number {
    let bit = -1;
    const byteIndex = Math.floor(this.position / this.BUFFER_TYPE_BITS);
    const byteOffset = ((this.BUFFER_TYPE_BITS - 1) - (this.position % this.BUFFER_TYPE_BITS));
    if (byteIndex >= 0 && byteIndex < this.buffer.length) {
      bit = (((this.buffer[byteIndex] & 0xff) >> byteOffset) & 0x01);
      this.position += 1;
    }
    return bit;
  }

  readBits(num: number): number {
    let value = 0;
    for (let i = (num - 1); i >= 0; i -= 1) {
      value |= (this.readBit() << i);
    }
    return value;
  }

  readBitsReversed(num: number): number {
    let value = 0;
    for (let i = 0; i < num; i += 1) {
      value |= (this.readBit() << i);
    }
    return value;
  }

  readBytes(num: number): number[] {
    const bytes = [];
    for (let i = 0; i < num; i += 1) {
      bytes[i] = this.readBits(8);
    }
    return bytes;
  }

  static getInteger(source: number[], offset: number) {
    const bytes = [];
    bytes[0] = source[offset + 0];
    bytes[1] = source[offset + 1];
    bytes[2] = source[offset + 2];
    bytes[3] = source[offset + 3];
    return ((bytes[3] & 0xff) << 24) | ((bytes[2] & 0xff) << 16)
      | ((bytes[1] & 0xff) << 8) | (bytes[0] & 0xff);
  }

  static getBytes(source: number[], offset: number, length: number) {
    const bytes = [];
    for (let i = 0; i < length; i += 1) {
      if (source.length > offset + i) {
        bytes[i] = source[offset + i];
      }
    }
    return bytes;
  }

  static getString(source: number[], offset: number, length: number) {
    const chars = [];
    for (let i = 0; i < length; i += 1) {
      const charValue = ((source[offset + i]) & 0xff);
      if (charValue === 0) {
        break;
      }
      chars[i] = charValue;
    }
    return GProReader.Utf8ArrayToStr(chars);
  }

  static load(byteArray: Uint8Array, fileSystem: {fileName: string, fileContents: number[]}[]) {
    const srcBuffer = new GPXByteBuffer(byteArray);
    console.log(srcBuffer);
    const header = GPXByteBuffer.getInteger(srcBuffer.readBytes(4), 0);
    if (header === HEADER_BCFS) {
      console.log('BCFS');
      const bcfsBytes = srcBuffer.readBytes(srcBuffer.length());
      const sectorSize = 0x1000;
      let offset = 0;
      while (offset + sectorSize + 3 < bcfsBytes.length) {
        offset += sectorSize;
        if (GPXByteBuffer.getInteger(bcfsBytes, offset) === 2) {
          const indexFileName = (offset + 4);
          const indexFileSize = (offset + 0x8C);
          const indexOfBlock = (offset + 0x94);

          const block = 0;
          let blockCount = 0;
          const byteArrayN = [];

          let blockInner = GPXByteBuffer.getInteger(bcfsBytes, (indexOfBlock + (4 * (blockCount))));
          blockCount += 1;
          while (blockInner !== 0) {
            offset = (block * sectorSize);
            const bytes = GPXByteBuffer.getBytes(bcfsBytes, offset, sectorSize);
            for (let i = 0; i < bytes.length; i += 1) {
              byteArrayN.push(bytes[i]);
            }
            blockInner = GPXByteBuffer.getInteger(bcfsBytes, (indexOfBlock + (4 * (blockCount))));
            blockCount += 1;
          }

          const fileSize = GPXByteBuffer.getInteger(bcfsBytes, indexFileSize);
          if (byteArrayN.length >= fileSize) {
            fileSystem.push({
              fileName: GPXByteBuffer.getString(bcfsBytes, indexFileName, 127),
              fileContents: GPXByteBuffer.getBytes(byteArrayN, 0, fileSize),
            });
          }
        }
      }
    } else if (header === HEADER_BCFZ) {
      console.log('BCFZ');
      const t0 = performance.now();
      const expectedLength = GPXByteBuffer.getInteger(srcBuffer.readBytes(4), 0);
      const byteArrayEl: number[] = [];
      // read as long as expectLength is smaller
      while (!srcBuffer.end() && srcBuffer.offset() < expectedLength) {
        const flag = srcBuffer.readBit();
        if (flag === 1) {
          const bits = srcBuffer.readBits(4);
          const offset = srcBuffer.readBitsReversed(bits);
          const size = srcBuffer.readBitsReversed(bits);

          /* var bytesClone = byteArrayEl.slice();
          var pos = bytesClone.length - offset;
          for(var i = 0; i < (size>offset?offset:size);i++){
            byteArrayEl.push(bytesClone[pos+i]);
          } */
          const pos = byteArrayEl.length - offset;
          for (let i = 0; i < (size > offset ? offset : size); i += 1) {
            byteArrayEl.push(byteArrayEl[pos + i]);
          }
        } else {
          const sizeRev = srcBuffer.readBitsReversed(2);
          for (let o = 0; o < sizeRev; o += 1) {
            byteArrayEl.push(srcBuffer.readBits(8));
          }
        }
      }
      const t1 = performance.now();
      console.log(`Time: ${t1 - t0}`);
      this.load(Uint8Array.from(byteArrayEl), []);
    } else {
      console.log('No GPX');
    }
  }
}

export default GPXByteBuffer;
