// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)

describe('dialogs as state', () => {
  it('opens a dialog through its lazily loaded handler, stacks windows and mounts each once', async () => {
    const { DIALOGS, toggleDialog, isDialogOpen } = await import('../src/services/dialogs/dialogs')
    const { dialogState, frontDialogId, bringDialogToFront, dialogZIndex } =
      await import('../src/stores/dialogState')
    const { default: Song } = await import('../src/stores/song')
    Song.initEmptySong()
    Song.songDescription.title = 'Riff'

    // No DOM needed: the handler fills its state and the window opens as state.
    await toggleDialog(DIALOGS.INFO)
    expect(isDialogOpen(DIALOGS.INFO.id)).toBe(true)
    const { getDialogHandler } = await import('../src/services/dialogs/dialogHandlers')
    const info = getDialogHandler<import('../src/services/dialogs/infoModalHandler').InfoModalHandler>(
      DIALOGS.INFO.id,
    )
    expect(info.getInfoData().title).toBe('Riff')

    await toggleDialog(DIALOGS.PIANO)
    expect(frontDialogId()).toBe(DIALOGS.PIANO.id)
    expect(dialogZIndex(DIALOGS.PIANO.id)).toBeGreaterThan(dialogZIndex(DIALOGS.INFO.id))
    bringDialogToFront(DIALOGS.INFO.id)
    expect(frontDialogId()).toBe(DIALOGS.INFO.id)

    await toggleDialog(DIALOGS.INFO)
    expect(isDialogOpen(DIALOGS.INFO.id)).toBe(false)
    await toggleDialog(DIALOGS.INFO)
    // Mounted once, kept mounted after closing.
    expect(dialogState.mounted.filter((id) => id === DIALOGS.INFO.id)).toHaveLength(1)
    expect(dialogState.windows.map((window) => window.id)).toEqual([DIALOGS.PIANO.id, DIALOGS.INFO.id])
  })
})

describe('.gt serialization', () => {
  it('writes the same text from the raw song data as through the reactive proxy', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { serializeSongContent } = await import('../src/utils/gtSerialization')
    const { noteToDrum } = await import('../src/services/audio/drumKit')
    Song.initEmptySong()
    Song.measures[0][1][0][0].notes[2] = { ...Song.defaultNote(), fret: 7 }
    Song.songDescription.title = 'Ünïcode'
    // A reactive object assigned into the tree is stored raw, so nothing is lost.
    Song.measureMeta[2].marker = reactive({ text: 'Riff', color: { red: 1, green: 2, blue: 3 } })

    const throughProxy = [
      Song.songDescription,
      Song.measures,
      Song.measureMeta,
      Song.tracks,
      Song.playBackInstrument,
      Array.from(noteToDrum.entries()),
    ]
      .map((part) => JSON.stringify(part))
      .join('%%%')
    expect(serializeSongContent()).toBe(throughProxy)
    expect(serializeSongContent()).toContain('"fret":7')
  })
})
