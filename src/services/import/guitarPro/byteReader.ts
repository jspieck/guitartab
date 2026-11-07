import { IMPORT_LIMITS, ImportError } from '../../importErrors'

/**
 * Reads the little-endian binary layout of Guitar Pro 3–5 files. Every read
 * checks the length first and throws an ImportError (with the byte offset)
 * instead of reading past the end.
 */
export class ByteReader {
  position = 0

  constructor(
    private readonly bytes: Uint8Array,
    /** File format, for error messages. */
    readonly format: string,
  ) {}

  bytesLeft(): number {
    return this.bytes.length - this.position
  }

  private ensureAvailable(count: number): void {
    if (!Number.isInteger(count) || count < 0 || this.position + count > this.bytes.length) {
      throw new ImportError(
        `The file ends unexpectedly (byte ${this.position} of ${this.bytes.length}); it may be truncated or damaged.`,
        this.format,
        { offset: this.position },
      )
    }
  }

  /** Signed byte. */
  readByte(): number {
    this.ensureAvailable(1)
    const byte = this.bytes[this.position]
    this.position += 1
    return byte > 127 ? byte - 256 : byte
  }

  readUnsignedByte(): number {
    this.ensureAvailable(1)
    const byte = this.bytes[this.position]
    this.position += 1
    return byte
  }

  /** Signed 16-bit little-endian integer. */
  readShort(): number {
    const b0 = this.readUnsignedByte()
    const b1 = this.readUnsignedByte()
    const value = (b1 << 8) | b0
    return value > 0x7fff ? value - 0x10000 : value
  }

  /** Signed 32-bit little-endian integer. */
  readInt(): number {
    const b0 = this.readByte()
    const b1 = this.readByte()
    const b2 = this.readByte()
    const b3 = this.readByte()
    return ((b3 & 0xff) << 24) | ((b2 & 0xff) << 16) | ((b1 & 0xff) << 8) | (b0 & 0xff)
  }

  /** Reads a count (int32) and rejects values no real file has, before anything loops over it. */
  readCount(max: number, what: string): number {
    const offset = this.position
    const count = this.readInt()
    if (count < 0 || count > max) {
      throw new ImportError(
        `Implausible number of ${what} (${count}); the file is damaged or not a .${this.format} file.`,
        this.format,
        { offset },
      )
    }
    return count
  }

  skipBytes(count: number): void {
    this.ensureAvailable(count)
    this.position += count
  }

  private readText(length: number): string {
    if (length > IMPORT_LIMITS.stringBytes) {
      throw new ImportError(`Implausible text length (${length}).`, this.format, { offset: this.position })
    }
    this.ensureAvailable(Math.max(0, length))
    const bytes: number[] = []
    for (let i = 0; i < length; i += 1) bytes.push(this.readUnsignedByte())
    return decodeText(bytes)
  }

  /** int (length + 1), byte (length), text. */
  readStringByteSizeOfInteger(): string {
    const length = this.readInt()
    this.readByte()
    return this.readText(length - 1)
  }

  /** int (length), text. */
  readStringInteger(): string {
    return this.readText(this.readInt())
  }

  /** Length byte, then a field of `size` bytes holding the text (the rest is padding). */
  readStringByte(size: number): string {
    const length = this.readUnsignedByte()
    const text = this.readText(length)
    if (size > length) this.skipBytes(size - length)
    return text
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true })
const windows1252 = new TextDecoder('windows-1252')

/**
 * Text as UTF-8 (what this app's GP5 export writes), else Windows-1252 (what Guitar Pro
 * itself writes). Bytes used to be read signed, which dropped every non-ASCII character.
 */
function decodeText(bytes: number[]): string {
  const data = Uint8Array.from(bytes)
  try {
    return utf8.decode(data)
  } catch {
    return windows1252.decode(data)
  }
}
