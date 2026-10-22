/** A bounded undo/redo stack. `index` points at the entry the next undo reverts. */
export class RevertStack<T> {
  readonly maxSize: number

  private entries: T[] = []

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

  peek(): T | null {
    if (this.index < 0 || this.index >= this.entries.length) {
      return null
    }
    return this.entries[this.index]
  }

  /** Adds an entry and drops everything that could have been redone. */
  push(entry: T): void {
    this.entries.splice(this.index + 1)
    this.entries.push(entry)
    this.index = this.entries.length - 1

    while (this.entries.length > this.maxSize) {
      this.entries.shift()
      this.index -= 1
    }
  }

  stepBack(): T | null {
    if (!this.canUndo) {
      return null
    }
    const entry = this.entries[this.index]
    this.index -= 1
    return entry
  }

  stepForward(): T | null {
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

  /** Removes the entries `predicate` matches, keeping the undo position on the same entry. */
  removeWhere(predicate: (entry: T) => boolean): void {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (predicate(this.entries[i])) {
        this.entries.splice(i, 1)
        if (this.index >= i) {
          this.index -= 1
        }
      }
    }
  }
}
