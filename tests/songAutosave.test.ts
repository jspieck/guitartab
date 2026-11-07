import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureAutosave,
  confirmReplaceUnsavedSong,
  createMemorySnapshotStore,
  dismissRecoverableDraft,
  flushAutosave,
  getRecoverableDraft,
  isSongDirty,
  listDrafts,
  markSongSaved,
  scheduleAutosave,
  setupAutosaveListeners,
  teardownAutosaveListeners,
  type CleanMarker,
  type SnapshotStore,
} from '../src/services/songAutosave'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
// Vitest runs in node: the module only needs window as an event target.
const globalWithWindow = globalThis as { window?: EventTarget }
globalWithWindow.window ??= new EventTarget()

let content = 'song-v1'
let clock = 1_000
let store: SnapshotStore
let cleanAt = 0
const cleanMarker: CleanMarker = {
  get: () => cleanAt,
  set: (time) => {
    cleanAt = time
  },
}

/** Simulate a new page session sharing the same persisted store and marker. */
function startSession(): void {
  configureAutosave({
    store,
    cleanMarker,
    readContent: () => content,
    readTitle: () => 'My Song',
    now: () => clock,
    debounceMs: 3000,
  })
  setupAutosaveListeners()
}

function edit(next: string): void {
  content = next
  clock += 1_000
  scheduleAutosave()
}

describe('songAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    content = 'song-v1'
    clock = 1_000
    cleanAt = 0
    store = createMemorySnapshotStore()
    startSession()
  })

  afterEach(() => {
    teardownAutosaveListeners()
    vi.useRealTimers()
  })

  it('treats the song loaded at startup as clean', () => {
    expect(isSongDirty()).toBe(false)
  })

  it('is dirty only while content differs from the last clean point', () => {
    edit('song-v2')
    expect(isSongDirty()).toBe(true)

    // Undoing back to the saved content is clean again.
    edit('song-v1')
    expect(isSongDirty()).toBe(false)

    edit('song-v3')
    markSongSaved()
    expect(isSongDirty()).toBe(false)
  })

  it('does not treat re-renders without content changes as edits', async () => {
    scheduleAutosave()
    await vi.advanceTimersByTimeAsync(3000)

    expect(isSongDirty()).toBe(false)
    expect(await listDrafts()).toHaveLength(0)
  })

  it('writes one snapshot after the debounce, and skips duplicates', async () => {
    edit('song-v2')
    edit('song-v2b')
    await vi.advanceTimersByTimeAsync(2999)
    expect(await listDrafts()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    const drafts = await listDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].title).toBe('My Song')

    scheduleAutosave()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await listDrafts()).toHaveLength(1)
  })

  it('opens another song without asking while nothing is unsaved', () => {
    const ask = vi.fn(() => false)
    expect(confirmReplaceUnsavedSong('next.gp5', ask)).toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('asks before replacing unsaved edits, and keeps them as a draft on yes', async () => {
    edit('song-v2')
    const ask = vi.fn(() => false)
    expect(confirmReplaceUnsavedSong('next.gp5', ask)).toBe(false)
    expect(ask.mock.calls[0][0]).toContain('"next.gp5"')
    await vi.advanceTimersByTimeAsync(0)
    expect(await listDrafts()).toHaveLength(0)

    expect(confirmReplaceUnsavedSong('next.gp5', () => true)).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(await listDrafts()).toHaveLength(1)
  })

  it('keeps only the ten newest snapshots', async () => {
    for (let version = 0; version < 14; version += 1) {
      edit(`song-v${version + 10}`)
      await flushAutosave()
    }

    const drafts = await listDrafts()
    expect(drafts).toHaveLength(10)
    expect(drafts[0].savedAt).toBeGreaterThan(drafts[9].savedAt)
  })

  it('offers unsaved work from a crashed session on the next start', async () => {
    edit('song-v2')
    await flushAutosave()

    // Crash: no save. Next session starts with the initial song again.
    content = 'song-v1'
    clock += 60_000
    startSession()

    const draft = await getRecoverableDraft()
    expect(draft?.title).toBe('My Song')
  })

  it('does not offer a draft once the work was saved', async () => {
    edit('song-v2')
    await flushAutosave()
    clock += 1_000
    markSongSaved()

    content = 'song-v1'
    startSession()

    expect(await getRecoverableDraft()).toBeNull()
    // Still available in the drafts list.
    expect(await listDrafts()).toHaveLength(1)
  })

  it('stops offering a dismissed draft but keeps it listed', async () => {
    edit('song-v2')
    await flushAutosave()
    content = 'song-v1'
    clock += 1_000
    startSession()
    expect(await getRecoverableDraft()).not.toBeNull()

    dismissRecoverableDraft()
    clock += 1_000
    startSession()

    expect(await getRecoverableDraft()).toBeNull()
    expect(await listDrafts()).toHaveLength(1)
  })

  it('does not offer a draft identical to the song already loaded', async () => {
    edit('song-v2')
    await flushAutosave()
    // Next session happens to load the same content (e.g. from a cloud link).
    startSession()

    expect(await getRecoverableDraft()).toBeNull()
  })

  it('warns before unload only while dirty, and flushes pending edits', async () => {
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    expect(unload()).toBe(false)

    edit('song-v2')
    expect(unload()).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(await listDrafts()).toHaveLength(1)
  })
})
