import { gProReader } from '../assets/js/GProReader'
import { revertHandler } from '../assets/js/revertHandler'
import Song from '../assets/js/songData'
import { compressGtContent, serializeSongContent } from '../utils/gtSerialization'
import { typedEventBus } from '../utils/typedEventBus'

/**
 * Autosave, crash recovery and the unsaved-changes guard.
 *
 * - "Dirty" means the song content differs from the last clean point (load,
 *   new song, save), so re-renders, view toggles or undoing back to the saved
 *   state never count as unsaved changes.
 * - While dirty, a snapshot is written 3 s after the last edit (and immediately
 *   when the page is hidden). Duplicates are skipped; the newest 10 are kept.
 * - On startup, the newest snapshot taken after the last clean point is offered
 *   for recovery. All kept snapshots stay available as drafts.
 */

export interface AutosaveSnapshot {
  id: string
  savedAt: number
  title: string
  bytes: Uint8Array
}

export interface SnapshotStore {
  put(snapshot: AutosaveSnapshot): Promise<void>
  /** Newest first. */
  list(): Promise<AutosaveSnapshot[]>
  delete(ids: string[]): Promise<void>
  clear(): Promise<void>
}

/** Remembers when the song was last clean, across page loads. */
export interface CleanMarker {
  get(): number
  set(time: number): void
}

const MAX_SNAPSHOTS = 10
const DEBOUNCE_MS = 3000
const DB_NAME = 'guitartab-autosave'
const STORE_NAME = 'snapshots'
const CLEAN_MARKER_KEY = 'guitartab:autosave:cleanAt'

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function createIndexedDbSnapshotStore(): SnapshotStore {
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open autosave database'))
    })
    return dbPromise
  }
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE_NAME, mode).objectStore(STORE_NAME)

  return {
    async put(snapshot) {
      await requestToPromise((await store('readwrite')).put(snapshot))
    },
    async list() {
      const records = await requestToPromise((await store('readonly')).getAll()) as AutosaveSnapshot[]
      return records.sort((left, right) => right.savedAt - left.savedAt)
    },
    async delete(ids) {
      const objectStore = await store('readwrite')
      await Promise.all(ids.map((id) => requestToPromise(objectStore.delete(id))))
    },
    async clear() {
      await requestToPromise((await store('readwrite')).clear())
    },
  }
}

export function createMemorySnapshotStore(): SnapshotStore {
  let snapshots: AutosaveSnapshot[] = []
  return {
    async put(snapshot) {
      snapshots = [snapshot, ...snapshots.filter((existing) => existing.id !== snapshot.id)]
    },
    async list() {
      return [...snapshots].sort((left, right) => right.savedAt - left.savedAt)
    },
    async delete(ids) {
      snapshots = snapshots.filter((snapshot) => !ids.includes(snapshot.id))
    },
    async clear() {
      snapshots = []
    },
  }
}

function createLocalStorageCleanMarker(): CleanMarker {
  return {
    get() {
      try {
        return Number(localStorage.getItem(CLEAN_MARKER_KEY)) || 0
      } catch {
        return 0
      }
    },
    set(time) {
      try {
        localStorage.setItem(CLEAN_MARKER_KEY, String(time))
      } catch {
        // Private mode / blocked storage: recovery still works within the session.
      }
    },
  }
}

interface AutosaveDependencies {
  store: SnapshotStore
  cleanMarker: CleanMarker
  readContent: () => string
  readTitle: () => string
  now: () => number
  debounceMs: number
}

const defaults = (): AutosaveDependencies => ({
  store: createIndexedDbSnapshotStore(),
  cleanMarker: createLocalStorageCleanMarker(),
  readContent: serializeSongContent,
  readTitle: () => Song.songDescription?.title || 'Untitled',
  now: () => Date.now(),
  debounceMs: DEBOUNCE_MS,
})

let deps: AutosaveDependencies | null = null
const dependencies = () => (deps ??= defaults())

/** Content at the last clean point; null when the current song was never saved (e.g. a restored draft). */
let baseline: string | null = null
let lastSnapshotContent: string | null = null
let changeCounter = 0
let dirtyCache: { counter: number, dirty: boolean } | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let snapshotCounter = 0
/** Clean marker as it was when this page session started (before any load or save). */
let startupCleanAt = 0

/** Swap storage, clock and content source (tests). Resets all state. */
export function configureAutosave(overrides: Partial<AutosaveDependencies> = {}): void {
  cancelPendingAutosave()
  deps = { ...defaults(), ...overrides }
  baseline = null
  lastSnapshotContent = null
  dirtyCache = null
  changeCounter = 0
  startupCleanAt = 0
}

function cancelPendingAutosave(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

export function isSongDirty(): boolean {
  if (dirtyCache?.counter === changeCounter) {
    return dirtyCache.dirty
  }
  const dirty = baseline == null || dependencies().readContent() !== baseline
  dirtyCache = { counter: changeCounter, dirty }
  return dirty
}

function setBaselineToCurrentSong(): void {
  cancelPendingAutosave()
  baseline = dependencies().readContent()
  changeCounter += 1
  dirtyCache = null
}

/** The song now matches a file (loaded, created or saved): nothing is unsaved. */
export function markSongSaved(): void {
  setBaselineToCurrentSong()
  dependencies().cleanMarker.set(dependencies().now())
}

/** Write a snapshot now if there are unsaved changes not yet captured. */
export async function flushAutosave(): Promise<void> {
  cancelPendingAutosave()
  if (!isSongDirty()) {
    return
  }
  const { readContent, readTitle, store, now } = dependencies()
  const content = readContent()
  if (content === lastSnapshotContent) {
    return
  }
  lastSnapshotContent = content
  snapshotCounter += 1
  const savedAt = now()
  await store.put({
    id: `autosave-${savedAt}-${snapshotCounter}`,
    savedAt,
    title: readTitle(),
    bytes: compressGtContent(content),
  })
  const overflow = (await store.list()).slice(MAX_SNAPSHOTS)
  if (overflow.length > 0) {
    await store.delete(overflow.map((snapshot) => snapshot.id))
  }
}

function reportAutosaveError(error: unknown): void {
  console.error('Autosave failed', error)
}

/** Song content may have changed: re-check dirtiness and autosave after a pause. */
export function scheduleAutosave(): void {
  changeCounter += 1
  cancelPendingAutosave()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushAutosave().catch(reportAutosaveError)
  }, dependencies().debounceMs)
}

export async function listDrafts(): Promise<AutosaveSnapshot[]> {
  return dependencies().store.list()
}

/**
 * The draft to offer on startup: the newest snapshot taken after the song was
 * last clean in a previous session, unless it equals what is loaded now.
 */
export async function getRecoverableDraft(): Promise<AutosaveSnapshot | null> {
  const [latest] = await listDrafts()
  if (!latest || latest.savedAt <= startupCleanAt) {
    return null
  }
  if (compressGtContent(dependencies().readContent()).join() === latest.bytes.join()) {
    return null
  }
  return latest
}

/** Hide the startup offer without deleting anything (drafts stay listed). */
export function dismissRecoverableDraft(): void {
  dependencies().cleanMarker.set(dependencies().now())
}

/** Loads a draft; returns false (and leaves the current song as it was) when it can't be read. */
export function restoreAutosave(snapshot: Pick<AutosaveSnapshot, 'bytes'>): boolean {
  // Loading marks the song clean; a restored draft is not, so keep the marker
  // where it was and the draft stays recoverable after another crash.
  const cleanAt = dependencies().cleanMarker.get()
  try {
    gProReader.loadGtFromBytes(snapshot.bytes)
  } catch (error) {
    console.error('Draft could not be restored', error)
    void import('./userNotifications').then(({ showUserError }) => {
      showUserError('This draft is damaged and could not be restored.')
    })
    return false
  }
  dependencies().cleanMarker.set(cleanAt)
  revertHandler.clearHistory()
  // A restored draft is not saved anywhere yet: keep it dirty, but do not
  // snapshot the identical content again.
  baseline = null
  lastSnapshotContent = dependencies().readContent()
  changeCounter += 1
  dirtyCache = null
  typedEventBus.emit('song-data-changed')
  return true
}

export async function discardAutosaves(): Promise<void> {
  lastSnapshotContent = null
  await dependencies().store.clear()
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!isSongDirty()) {
    return
  }
  // Capture the last edits even if the debounce has not fired yet.
  void flushAutosave().catch(reportAutosaveError)
  event.preventDefault()
  try {
    // Older browsers only show the prompt when returnValue is set.
    event.returnValue = ''
  } catch {
    // Read-only outside browsers; preventDefault() is enough.
  }
}

function handlePageHide(): void {
  if (debounceTimer) {
    void flushAutosave().catch(reportAutosaveError)
  }
}

/**
 * Start tracking. The song present at startup (empty or demo) is the clean
 * baseline; the persisted clean marker is read, not moved, so a draft from a
 * crashed session is still offered.
 */
export function setupAutosaveListeners(): void {
  startupCleanAt = dependencies().cleanMarker.get()
  if (baseline == null) {
    setBaselineToCurrentSong()
  }
  typedEventBus.on('song-data-changed', scheduleAutosave)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('pagehide', handlePageHide)
}

export function teardownAutosaveListeners(): void {
  typedEventBus.off('song-data-changed', scheduleAutosave)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('pagehide', handlePageHide)
  cancelPendingAutosave()
}
