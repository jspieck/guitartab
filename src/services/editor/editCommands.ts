import { computed, ref, toRaw } from 'vue'
import Song, { type Beat, type MeasureMetaInfo } from '../../stores/song'
import { notifySongDataChanged } from '../appEvents'
import { requestBlocksRender } from './renderCommands'
import { RevertStack } from './revertStack'

/**
 * One undoable edit. `apply` (re)does it, `invert` undoes it; both must be
 * repeatable, because undo/redo can run them any number of times.
 */
export interface EditCommand {
  readonly label: string
  apply(): void
  invert(): void
  /** Runs after every apply/invert: re-render, refresh views the render events don't reach. */
  afterChange?(): void
  /**
   * Track `trackId` was deleted: renumber the tracks the command refers to.
   * Returns false when the command no longer means anything (it edited only
   * that track); it is then dropped from the history.
   */
  adaptToTrackRemove?(trackId: number): boolean
}

// --- Undo history ----------------------------------------------------------

const UNDO_LIMIT = 200
const stack = new RevertStack<EditCommand>(UNDO_LIMIT)
// Bumped on every change of the stack, so Undo/Redo buttons can follow it reactively.
const historyVersion = ref(0)

function historyChanged(): void {
  historyVersion.value += 1
}

/** Reactive: whether Undo / Redo can do something. */
export const undoAvailability = {
  canUndo: computed(() => historyVersion.value >= 0 && stack.canUndo),
  canRedo: computed(() => historyVersion.value >= 0 && stack.canRedo),
}

/** Re-render, re-sync the toolbar and mark the song dirty after a change. */
function commandChanged(command: EditCommand): void {
  command.afterChange?.()
  notifySongDataChanged()
}

export const undoHistory = {
  canUndo: (): boolean => stack.canUndo,
  canRedo: (): boolean => stack.canRedo,
  /** The command the next undo would revert. */
  peek: (): EditCommand | null => stack.peek(),
  undo(): void {
    const command = stack.stepBack()
    if (command) {
      historyChanged()
      command.invert()
      commandChanged(command)
    }
  },
  redo(): void {
    const command = stack.stepForward()
    if (command) {
      historyChanged()
      command.apply()
      commandChanged(command)
    }
  },
  clear(): void {
    stack.clear()
    historyChanged()
  },
  /** Called after a track was deleted. */
  adaptToTrackRemove(trackId: number): void {
    stack.removeWhere((command) => command.adaptToTrackRemove?.(trackId) === false)
    historyChanged()
  },
}

// --- Executing commands ----------------------------------------------------

let activeTransaction: BarTransaction | null = null

/**
 * Applies a command and records it for undo. Pass `alreadyApplied` when the
 * change was made live (a drag) and only needs recording. Inside a
 * {@link recordBarEdit} it becomes part of that edit's undo step.
 */
export function executeCommand(command: EditCommand, options: { alreadyApplied?: boolean } = {}): void {
  if (!options.alreadyApplied) {
    command.apply()
  }
  if (activeTransaction) {
    activeTransaction.subCommands.push(command)
    return
  }
  stack.push(command)
  historyChanged()
  commandChanged(command)
}

// --- Bar snapshots ---------------------------------------------------------

interface VoiceCell {
  trackId: number
  blockId: number
  before: Beat[][]
  after?: Beat[][]
}

interface MetaCell {
  blockId: number
  before: MeasureMetaInfo
  after?: MeasureMetaInfo
}

/**
 * Deep copy of song data. Unwraps Vue proxies at every level (legacy code
 * sometimes stores a reactive object inside raw data, which structuredClone
 * rejects) and keeps the holes of sparse `notes` arrays (JSON would turn them
 * into null).
 */
export function cloneData<T>(value: T): T {
  const raw = toRaw(value) as unknown
  if (typeof raw !== 'object' || raw === null) {
    return raw as T
  }
  if (Array.isArray(raw)) {
    const copy: unknown[] = new Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) {
      if (i in raw) copy[i] = cloneData(raw[i])
    }
    return copy as T
  }
  if (raw instanceof Map) {
    return new Map([...raw].map(([key, entry]) => [key, cloneData(entry)])) as T
  }
  const copy: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    copy[key] = cloneData((raw as Record<string, unknown>)[key])
  }
  return copy as T
}

function isContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Makes `target` equal to `source` while keeping the identity of nested
 * objects and arrays. Modal handlers and range selections hold references to
 * beats and notes, which must stay the live ones after an undo.
 */
export function syncInto(
  target: Record<string, unknown> | unknown[],
  source: Record<string, unknown> | unknown[],
): void {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.length = source.length
    for (let i = 0; i < source.length; i += 1) {
      if (!(i in source)) {
        delete target[i]
      } else {
        target[i] = merged(target[i], source[i])
      }
    }
    return
  }
  const targetObj = target as Record<string, unknown>
  const sourceObj = source as Record<string, unknown>
  for (const key of Object.keys(targetObj)) {
    if (!(key in sourceObj)) {
      delete targetObj[key]
    }
  }
  for (const key of Object.keys(sourceObj)) {
    targetObj[key] = merged(targetObj[key], sourceObj[key])
  }
}

function merged(current: unknown, next: unknown): unknown {
  if (isContainer(current) && isContainer(next) && Array.isArray(current) === Array.isArray(next)) {
    syncInto(current, next)
    return current
  }
  // Copy so a later edit of the live song can't change the stored snapshot.
  return isContainer(next) ? cloneData(next) : next
}

function restoreCells(
  voices: readonly VoiceCell[],
  metas: readonly MetaCell[],
  side: 'before' | 'after',
): void {
  for (const cell of metas) {
    const meta = Song.measureMeta[cell.blockId]
    if (meta)
      syncInto(meta as unknown as Record<string, unknown>, cell[side] as unknown as Record<string, unknown>)
  }
  for (const cell of voices) {
    const voicesOfBar = Song.measures[cell.trackId]?.[cell.blockId]
    if (voicesOfBar) syncInto(voicesOfBar, cell[side]!)
  }
}

function sameData(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** The bars one edit touches, snapshotted when they are first included. */
class BarTransaction {
  readonly voices: VoiceCell[] = []
  readonly metas: MetaCell[] = []
  readonly subCommands: EditCommand[] = []
  readonly hooks: (() => void)[] = []

  constructor(readonly label: string) {}

  include(trackIds: readonly number[], blockIds: readonly number[]): void {
    for (const blockId of blockIds) {
      if (Song.measureMeta[blockId] != null && !this.metas.some((cell) => cell.blockId === blockId)) {
        this.metas.push({ blockId, before: cloneData(Song.measureMeta[blockId]) })
      }
      for (const trackId of trackIds) {
        const bar = Song.measures[trackId]?.[blockId]
        if (
          bar != null &&
          !this.voices.some((cell) => cell.trackId === trackId && cell.blockId === blockId)
        ) {
          this.voices.push({ trackId, blockId, before: cloneData(bar) })
        }
      }
    }
  }

  rollBack(): void {
    for (const command of [...this.subCommands].reverse()) command.invert()
    restoreCells(this.voices, this.metas, 'before')
  }

  /** The recorded command, or null when nothing changed. */
  finish(): EditCommand | null {
    for (const cell of this.metas) cell.after = cloneData(Song.measureMeta[cell.blockId])
    for (const cell of this.voices) cell.after = cloneData(Song.measures[cell.trackId][cell.blockId])
    const metas = this.metas.filter((cell) => !sameData(cell.before, cell.after))
    let voices = this.voices.filter((cell) => !sameData(cell.before, cell.after))
    const subCommands = this.subCommands
    if (metas.length === 0 && voices.length === 0 && subCommands.length === 0) {
      return null
    }
    const hooks = this.hooks
    return {
      label: this.label,
      apply() {
        for (const command of subCommands) command.apply()
        restoreCells(voices, metas, 'after')
      },
      invert() {
        restoreCells(voices, metas, 'before')
        for (const command of [...subCommands].reverse()) command.invert()
      },
      afterChange() {
        const blockIds = [...new Set([...metas, ...voices].map((cell) => cell.blockId))]
        if (blockIds.length > 0) {
          requestBlocksRender(Song.currentTrackId, blockIds, Song.currentVoiceId)
        }
        for (const hook of hooks) hook()
        for (const command of subCommands) command.afterChange?.()
      },
      adaptToTrackRemove(trackId) {
        voices = voices.filter((cell) => cell.trackId !== trackId)
        for (const cell of voices) {
          if (cell.trackId > trackId) cell.trackId -= 1
        }
        const keptSubs = subCommands.filter((command) => command.adaptToTrackRemove?.(trackId) !== false)
        subCommands.splice(0, subCommands.length, ...keptSubs)
        return voices.length > 0 || metas.length > 0 || subCommands.length > 0
      },
    }
  }
}

export interface BarEditScope {
  /** The track edited. */
  trackId: number
  blockIds: readonly number[]
  /** Snapshot these bars in every track (time signatures change all tracks). */
  allTracks?: boolean
  /** Runs after the edit and after each undo/redo of it. */
  afterChange?: () => void
}

/**
 * Runs `mutate` and records one undoable command that restores the bars'
 * contents (all voices of `trackId`, or of every track) and bar settings
 * from snapshots, so no hand-written inverse is needed. Undo/redo restore in
 * place, so objects held by modal handlers or selections stay live.
 *
 * Nestable: inside another `recordBarEdit` (or {@link editTransaction}) the
 * bars are added to the outer edit, and so are commands executed meanwhile;
 * only the outermost call records an undo step. So low-level mutators can
 * record themselves and a user action that calls several still undoes as one.
 *
 * Records nothing when nothing changed. When `mutate` returns false (refused)
 * or throws, its changes to the bars are rolled back.
 *
 * The bars must cover everything `mutate` writes. Edits that add or remove
 * bars or tracks need their own command.
 */
export function recordBarEdit(
  label: string,
  scope: BarEditScope,
  mutate: () => void | boolean,
): EditCommand | null {
  const trackIds = scope.allTracks ? Song.measures.map((_, trackId) => trackId) : [scope.trackId]
  const outer = activeTransaction
  const transaction = new BarTransaction(label)
  transaction.include(trackIds, scope.blockIds)
  if (outer) {
    outer.include(trackIds, scope.blockIds)
    if (scope.afterChange) outer.hooks.push(scope.afterChange)
  } else if (scope.afterChange) {
    transaction.hooks.push(scope.afterChange)
  }

  activeTransaction = outer ?? transaction
  let refused: boolean
  try {
    refused = mutate() === false
  } catch (error) {
    transaction.rollBack()
    activeTransaction = outer
    throw error
  }
  activeTransaction = outer

  if (refused) {
    transaction.rollBack()
    return null
  }
  if (outer) {
    return null
  }
  const command = transaction.finish()
  if (command) {
    stack.push(command)
    historyChanged()
    commandChanged(command)
  }
  return command
}

/**
 * Groups everything `run` changes into one undo step. Bars must be included
 * by the edits inside (`recordBarEdit`), which most legacy mutators do.
 */
export function editTransaction(label: string, run: () => void | boolean): EditCommand | null {
  return recordBarEdit(label, { trackId: Song.currentTrackId, blockIds: [] }, run)
}

/** True while an edit records; lets old code skip its own bookkeeping. */
export function isRecordingEdit(): boolean {
  return activeTransaction != null
}

// --- Single values ---------------------------------------------------------

export interface ValueCommandOptions<T> {
  label: string
  /** The track the value belongs to; renumbered when an earlier track is deleted. */
  trackId?: number
  get: (trackId: number | undefined) => T
  set: (value: T, trackId: number | undefined) => void
  afterChange?: () => void
}

/** Commands that belong to one track: dropped with it, renumbered after earlier deletions. */
export function trackScoped<T extends EditCommand>(command: T, trackRef: { trackId?: number }): T {
  command.adaptToTrackRemove = (deleted) => {
    if (trackRef.trackId == null) return true
    if (trackRef.trackId === deleted) return false
    if (trackRef.trackId > deleted) trackRef.trackId -= 1
    return true
  }
  return command
}

/**
 * A command that sets one value (song tempo, a track's volume). `before` is
 * read now; pass it explicitly when the value was already changed live.
 * Records nothing when the value doesn't change.
 */
export function setValue<T>(
  options: ValueCommandOptions<T>,
  value: T,
  before: T = options.get(options.trackId),
): EditCommand | null {
  if (sameData(before, value)) {
    return null
  }
  const ref = { trackId: options.trackId }
  const command = trackScoped<EditCommand>(
    {
      label: options.label,
      apply: () => options.set(value, ref.trackId),
      invert: () => options.set(before, ref.trackId),
      afterChange: options.afterChange,
    },
    ref,
  )
  // Applying again after a live change is harmless: set() is idempotent.
  executeCommand(command)
  return command
}
