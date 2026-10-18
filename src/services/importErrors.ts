/**
 * The one error type file import throws. Parsers may fail in many ways on bad
 * input; `importSongBytes` turns all of them into this, so callers can show a
 * single clear message and the app stays usable.
 */
export class ImportError extends Error {
  readonly format: string
  /** Byte offset where reading failed, when known. */
  readonly offset?: number

  constructor(message: string, format: string, options: { offset?: number; cause?: unknown } = {}) {
    super(message)
    this.name = 'ImportError'
    this.format = format
    this.offset = options.offset
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export const SUPPORTED_IMPORT_FORMATS = ['gp3', 'gp4', 'gp5', 'gpx', 'gp', 'mid', 'gt'] as const
export type ImportFormat = (typeof SUPPORTED_IMPORT_FORMATS)[number]

export function importFormatOf(fileName: string): ImportFormat | null {
  const ending = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase()
  return (SUPPORTED_IMPORT_FORMATS as readonly string[]).includes(ending) ? (ending as ImportFormat) : null
}

/** Upper bounds for counts read from binary files; real files stay far below them. */
export const IMPORT_LIMITS = {
  measures: 4096,
  tracks: 128,
  beatsPerVoice: 512,
  comments: 1024,
  strings: 16,
  points: 256,
  stringBytes: 1 << 20,
} as const
