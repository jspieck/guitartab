export interface RevertStackEntry {
  type: string
  info: unknown
}

export class RevertStack {
  readonly maxSize: number

  private entries: RevertStackEntry[] = []

  private index = -1

  constructor(maxSize = 20) {
    this.maxSize = maxSize
  }

  get size(): number {
    return this.entries.length
  }

  get currentIndex(): number {
    return this.index
  }

  get canUndo(): boolean {
    return this.index >= 0
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1
  }

  peek(): RevertStackEntry | null {
    if (this.index < 0 || this.index >= this.entries.length) {
      return null
    }
    return this.entries[this.index]
  }

  push(type: string, info: unknown): void {
    this.entries.splice(this.index + 1, this.entries.length - this.index - 1)
    this.entries.push({ type, info })
    this.index = this.entries.length - 1

    while (this.entries.length > this.maxSize) {
      this.entries.shift()
      this.index -= 1
    }
  }

  stepBack(): RevertStackEntry | null {
    if (!this.canUndo) {
      return null
    }
    const entry = this.entries[this.index]
    this.index -= 1
    return entry
  }

  stepForward(): RevertStackEntry | null {
    if (!this.canRedo) {
      return null
    }
    this.index += 1
    return this.entries[this.index]
  }

  clear(): void {
    this.entries = []
    this.index = -1
  }

  adjustIndex(delta: number): void {
    this.index += delta
  }

  /** Used by revertHandler when tracks are deleted. */
  getMutableEntries(): RevertStackEntry[] {
    return this.entries
  }
}
