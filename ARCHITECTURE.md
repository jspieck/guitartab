# GuitarTab architecture

How the editor is put together as of October 2026, after the core port (HANDOVER 3.28–3.34) moved the last of the old `src/assets/js` code into typed modules. This file describes the current code; how it got here is in `HANDOVER.md`, the working plan in `../IMPROVEMENTS_AUDIT.md`, and the short version for day-to-day work in `CLAUDE.md`.

## Overview

GuitarTab is a browser editor and player for guitar tablature: Vue 3, TypeScript and Vite, Web Audio for sound, VexFlow 4 for standard notation. It opens Guitar Pro 3–8, MIDI and its own `.gt` files and writes `.gt`, GP5, GPX, MusicXML, PDF and SVG.

There is no framework beyond Vue: no Pinia, no router. Application state is plain `reactive` modules in `src/stores/`, the logic lives in `src/services/`, and Vue components render and forward user input.

## Folders and layers

```
src/
  main.ts, App.vue    app shell: mounts Vue, lays out the regions, starts the editor
  components/         Vue: toolbar (Menu.vue), tab renderer (tab/), dialogs (*Modal.vue),
                      studio panels (Mixer, Equalizer, Compressor, audio/), phone UI (compact/)
  composables/        functions used in component setup (layout, selection, viewport, toolbar state)
  services/           the application logic, no Vue components
    editor/           editing commands, undo, layout engine, selection, keyboard, note entry
    playback/         song cursor, scheduler, playhead
    audio/            audio graph, sample player, SoundFont, drums, metronome, meters
    dialogs/          dialog handlers and the dialog registry (modalManager)
    notation/         classical notation (VexFlow), lazy
    import/, *Import.ts, *Export.ts   file formats
    midi/             MIDI input devices, live input, placing pitches on strings
  stores/             reactive state modules (song, selection, settings, layout, practice...)
  utils/              pure helpers (durations, tab geometry, lanes, event bus, shortcuts table)
  types/              the song model and renderer types
  data/               instrument tables, the demo songs
```

Imports go downwards: `components` → `composables` → `services` → `stores`/`utils`/`types`/`data`. The lower layers (`services`, `stores`, `utils`, `types`, `data`) must not import components or composables; ESLint (`no-restricted-imports` in `eslint.config.mjs`) and `tests/layering.test.ts` enforce it, and the test also checks that `src/assets/js` stays gone. Module-level reactive state belongs in `stores/`, not in `composables/`.

Inside `services/` the layering is not strict. The editor, playback, audio, dialog handlers and importers call each other in both directions (playback reads the stores and the layout, edits restart playback, dialog handlers run edit commands, editor code opens dialogs). That is why they share one bundle chunk (see [Bundle](#bundle)).

## Startup

1. `main.ts` loads the global styles (`assets/css/guitarTab.scss`, `style.css`, `assets/css/compact.css`) and mounts `App.vue`. `style.css` defines CSS variables the tab renderer needs; without it the sheet and string lines are invisible.
2. `App.vue` renders the toolbar (`Menu.vue`) and the tab (`GuitarTabView.vue`) right away and loads the rest lazily with `defineAsyncComponent`: effects bar, sequencer, footer, dialogs (`ModalsContainer.vue`), drafts panel, help overlays and the phone UI. Cloud songs (`?song=<id>`) and the phone sheet fitting are dynamic imports too.
3. On mount it calls `startUp()` (`services/startup.ts`): document listeners (shortcuts in the capture phase, Ctrl + wheel zoom, unlocking audio on the first gesture), `playback.init()`, an empty song, the audio buses, then the first song. A first visit loads the four-track demo (`data/demoArrangement.ts`, its own lazy chunk); e2e tests ask for the small riff in `data/demoSong.ts`. The SoundFont loads in the background.
4. `songAutosave.ts` offers the newest unsaved snapshot for recovery.
5. Readiness is published as `<html data-editor-ready>` and `data-soundfont-ready` (`utils/startupReadiness.ts`); the e2e helpers wait for them.

## The song model

`types/song.ts` defines the model. A song is `measures[track][block][voice][beat]`: a *block* is a bar, and each entry is a `Beat` with its duration, effects and a sparse `notes` array indexed by string. Bar-level data (time signature, repeats, voltas, markers, tempo changes) is in `measureMeta[block]`. Tracks, tuning, chord libraries (`chordsMap`), mixer channels (`allChannels`) and per-track playback settings (`playBackInstrument`) sit next to it. Optional features are optional fields (`beat.text`, `beat.chord`, `effects.stroke`, …).

- `stores/songState.ts` holds that data as one `reactive` object; it is the single source of truth.
- `stores/song.ts` exports `Song`, a `Proxy` over `songState` that adds accessors (`findBeat`, `getBeat`, `getNote`, …) and default objects. Reads and writes go straight to `songState`, so `Song.measures[...] = ...` is reactive. Prefer the accessors over indexing by hand, and `toRaw` for bulk reads.
- **String order:** string index 0 is the *lowest* string (pitch = tuning + fret), drawn on the bottom tab line. `stringLine()` in `utils/tabStrings.ts` converts a string index to a screen line. The exception is chord `frets[]`, stored highest string first.
- Durations are in ticks (whole note = 64), `utils/duration.ts`. Tuplet group ids and fill counters are `stores/tupletState.ts`.
- `.gt` files and autosave drafts from older versions are upgraded on load by `services/songMigrations.ts`; changing a field means adding a migration step there.

## Rendering the tab

```
GuitarTabView.vue
  └ useGuitarTabLayout ── editorCore.buildModernTabRows ── measureLayoutEngine
        │                                                    ├ writes stores/tabLayoutState (blockToRow, blocksPerRow, measureOffset...)
        │                                                    └ caches per block in stores/tabRenderLayout
        └ useVisibleTabRows → TabRow.vue (mounted rows only)
              └ TabMeasure / TabNote / TabDurations / TabEffects / TabMeasureInfo / ChordDiagram
          ClassicalNotationLayer.vue → ClassicalRowSurface.vue (one VexFlow staff per visible row)
```

- `services/editor/measureLayoutEngine.ts` is the only row-breaking and bar-width pipeline (`computeBarWidth`, `relayoutTrack`, `barWidthChangesRows`). The plain arrays it writes to `tabLayoutState` are what playback, scrolling and navigation read. `redrawTrack` (`layoutInvalidation.ts`) lays a track out again.
- Vertical layout is per row: `utils/tabRowLanes.ts` stacks annotation lanes (effects, text, chords, dynamics) above and below the strings, in row-local coordinates with `y = 0` at the top string. Horizontal beat positions come from `utils/beatPositionInRow.ts`, `utils/measureBeatLayout.ts` and `services/editor/beatGrouping.ts`.
- The layout is computed inside a `computed` that writes reactive state; reads during that write use `toRaw`, otherwise Vue reports "Maximum recursive updates".
- Only rows near the viewport are mounted (`useVisibleTabRows`, `stores/tabVirtualizationState.ts`). Anything that needs the whole tab in the DOM (PDF/SVG export, printing) wraps the work in `withAllRowsRendered()`.
- Re-rendering after an edit is event-driven: commands emit `render.block`, `render.blocks`, `render.all`, `render.durations`, … and `useTabRenderInvalidation` invalidates the affected rows.
- **Classical notation** (`services/notation/`) is loaded only when switched on. `classicalNotationAdapter.ts` loads it; `classicalNotationLifecycle.ts` documents the activation order; `vexflowNotes.ts` converts beats to VexFlow notes (pure) and `classicalNotation.ts` draws. The staves are laid out from metrics computed from the notation data (`stores/classicalNotationLayoutState.ts`, whose `active` means "metrics are ready"), never from drawn output, so tab and staff rows line up. The installed `@types/vexflow` describe VexFlow 1.2; check new calls against `node_modules/vexflow/build/types`.
- **Layouts** (`stores/layoutModeState.ts`): under 900 px the phone layout (`components/compact/`: `CompactBar`, `TouchNotePad`), from 900 px the desktop chrome with the sheet fitted to the window, from 1200 px the fixed desktop sheet. In the phone layout the desktop chrome stays mounted but hidden, because some code still finds elements by id. Sheet fitting and pinch zoom: `services/compactLayout.ts`. `?layout=compact|desktop` forces one.

## Editing

**Selection.** The edit cursor (one string of one beat) and the two ends of the range selection are `stores/selectionState.ts`. `services/editor/rangeSelection.ts` drives the range (`startRange`, `extendRange`, `clearRange`, `notesInRange`) and also owns the playback loop, since the selected range is the loop. Clicking in the tab or the sequencer moves the cursor through `navigation.setClickedPos`.

**Commands and undo.** Every undoable change is an `EditCommand` on the single history in `services/editor/editCommands.ts` (`undoHistory`, a bounded `revertStack.ts`; reactive `undoAvailability` for the buttons). Most edits go through `recordBarEdit(label, scope, mutate)`: it snapshots the affected bars before and after `mutate` and records one step, so no edit needs a hand-written inverse. It restores bars in place (references to beats and notes stay valid), rolls back when `mutate` returns `false` or throws, and nests: low-level mutators (`setFret`, `deleteNote`, `changeNoteDuration`) record themselves, and a caller that wraps several in `recordBarEdit`/`editTransaction` gets one step. The other command families:

| Area | Module |
|---|---|
| frets, notes | `noteCommands.ts`, note entry at the cursor in `noteEntry.ts` |
| note lengths, tuplets | `durationEditing.ts`, `durationCommands.ts`, `durationModifierCommands.ts` |
| rests, tuplet numbering, track refresh | `barFilling.ts` |
| bars added/removed | `measureStructureCommands.ts` |
| time signatures | `timeSignatureCommands.ts` |
| effects on beats, notes and bars | `effectToggles.ts`, `notationCommands.ts`, `dynamicsCommands.ts`, `services/menuEffectMutations.ts` |
| song tempo, track volume, chord library, track settings | `songSettingsCommands.ts` (`recordTrackEdit`), `recordSongInfoEdit` |
| copy and paste | `clipboard.ts` (copies are snapshots) |
| zoom | `zoom.ts` (`Settings.currentZoom` is the only zoom value) |

Every command re-renders, refreshes the toolbar and emits `song-data-changed`, which triggers autosave. Some changes deliberately have no undo: mute, solo, pan, effect knobs, master volume, the studio panels.

**Keyboard.** All shortcuts are one table, `utils/keyboardShortcuts.ts` (`SHORTCUTS`), dispatched by `handleKeyDown` in `services/editor/keyboardDispatch.ts`. The Help sheet is generated from the same table.

**Toolbar.** `Menu.vue` reads its pressed and disabled buttons from a `computed` (`composables/useToolbarState.ts`) over the cursor, the range and the song, so nothing has to tell it to refresh. Its actions go through `composables/useMenuActions.ts` and `services/menuActionCommands.ts`.

**Dialogs.** Dialog logic lives in `services/dialogs/`, separate from the `.vue` files, because the registry (`modalTypes.ts`, `modalManager.ts`) builds every handler at startup and services open dialogs through it. Simple edit dialogs are a config for the generic `EditModalHandler` (`effectModals.ts`: `defaults`/`read`/`scope`/`write`); the Vue dialog binds `handler.form` and calls `handler.apply()`, which records one undo step, re-renders and closes. Bend, tremolo bar, time signature, chords, tuning and track settings have their own handlers; dialogs whose component does everything use `definePlainModal(id, name)`. `modalManager` shows, drags and stacks the dialog windows directly in the DOM (by element id, with interact.js). The equalizer and compressor handlers control audio nodes: `audioGraph.createBusses()` hands them the master EQ and limiter.

## Playback and audio

```
playback (services/playback/index.ts)        togglePlayback, start/stop, jumpToBeat, setPlayPosition...
  ├ songCursor.ts    pure: bars in playing order (repeats, voltas, loop), the next beat of each voice
  ├ scheduler.ts     ticked every 25 ms by timerWorker.ts; schedules beats 0.4 s ahead on the AudioContext clock;
  │                  metronome, count-in, speed trainer, jumps
  ├ notePlayback.ts  how a beat sounds: mute/solo, ties, strums, grace and ghost notes
  ├ playhead.ts      animation loop: playhead position, scrolling, the piano/guitar views
  └ startPosition.ts where Play starts
audio (services/audio/)
  ├ audioGraph.ts    the one AudioContext; track and drum buses, master EQ and limiter
  ├ samplePlayer.ts  playFret/playPitch: SoundFont notes with their effects (bends, slides, vibrato...)
  ├ soundFont/       RIFF/SF2 parser, banks, loader (25 MB file, parsed on the main thread)
  ├ effects.ts       per-bus chorus and Freeverb
  └ drumKit.ts, metronome.ts, meters.ts
```

The song clock counts whole notes; `spw()`/`wps()` in `playback/tempo.ts` convert to seconds and apply the practice speed (`stores/practiceState.ts`). Practice features (speed, metronome, count-in, speed trainer, loop) are the transport in `PracticeControls.vue` over `practiceState` and the scheduler. `stores/soundingNotesState.ts` holds the notes the piano and guitar dialogs show as pressed: those playback has reached plus live notes.

MIDI input: `services/midi/devices.ts` lists and connects devices (access is requested when the MIDI dialog opens); `liveInput.ts` sounds live notes and writes recorded ones (one undo step per flush), placing pitches on strings with `noteArranger.ts`.

## Import and export

- **Import** has one entry point, `importSongBytes(fileName, bytes)` in `services/songImport.ts`, which picks the parser by file ending, throws a typed `ImportError` (`importErrors.ts`) and puts the previous song back when a file can't be read. `openSongFile` (the toolbar's file input), `loadGtBytes` (autosave, cloud) and `loadBuiltSong` (demo) build on it.
  - GP3/4/5: `services/import/guitarPro/` (`parseGuitarPro` → `applyGuitarProSong`; parser classes over a `ByteReader`, GP4/GP3 reuse the GP5/GP4 parts).
  - GP6/7/8: `gpContainers.ts` unpacks the ZIP/BCFZ/BCFS container, `gpifImport.ts` reads the GPIF XML (`parseGpif` → `applyGpifSong`).
  - MIDI: `import/midiFile.ts` reads the file, `midiImport.ts` builds a song.
  - Parsers produce plain data first and apply it afterwards, so they run in node tests.
- **Export** is the lazy `songExport` chunk: `.gt` (`utils/gtSerialization.ts`, LZ-compressed text), GP5 (`gp5Export.ts`), GPX (`gpifExport.ts` + `gpxWriter.ts`), MusicXML 4.0 (`musicXmlExport.ts`), PDF and SVG of the rendered sheet (`pdfExport.ts`, `tabExportSvg.ts`).
- **Persistence:** `songAutosave.ts` keeps up to 10 snapshots in IndexedDB while there are unsaved changes ("dirty" compares song content with the last clean point), offers recovery on startup and guards against closing with unsaved changes. Cloud songs (`cloudSongApi.ts`, `cloudSongLoader.ts`, `CloudSongsModal.vue`) are optional and need a server that is not in this repository.

## Events and settings

- `utils/typedEventBus.ts` is the only event bus, typed by the `AppEvents` map: `render.*` (invalidate rows), `song-data-changed`, `song-loaded`, `selection.*`, `playback.*`, `classical-notation-changed`, `modal.*` and a few `navigation.*`/`ui.*` events. New state that components only display should be a store plus a `computed`, not an event.
- Settings are `stores/settingsState.ts` (imported as `Settings`): reactive, each key persisted to `localStorage`. `EPSILON` and `OVERBAR_ROW_HEIGHT` are constants exported there.
- Banners: `showNotification(text, kind, action?)` in `stores/notificationState.ts`, shown by `App.vue`; `showUserError` (`services/userNotifications.ts`) wraps it.

## Bundle

Chunks are assigned by `manualChunks` in `vite.config.ts`, and `scripts/check-bundle-budget.mjs` (`npm run build:check`) enforces a size budget per chunk and fails if two chunks import each other.

- At startup: the entry (`App.vue` and the shell, 16 KB budget), `framework` (Vue, plus the Vite/Vue helper modules), `vendor`, `ui-vendor`, `serialization` (lz-string), `shortcuts`, `toolbar` (`Menu.vue`, 32 KB), `tab-renderer`, and `editor-core` (280 KB): stores, utils, the editor, playback and audio, the dialog handlers, the importers and the riff.
- Lazy: `ModalsContainer` and the dialogs, `studio-panels`, `studio-ui`, the phone UI, `classicalNotation` + `notation` (VexFlow, 1 MB), `songExport`, `pdfExport`, `demoArrangement`, `cloudSongLoader`, `compactLayout`.

`editor-core` is one chunk because its modules import each other. When two chunks import each other, the browser runs one before the other has initialized, and the production build fails at startup with "Cannot access 'x' before initialization" while the dev server works (HANDOVER 3.34). To make part of it lazy again, remove the imports back into it first: e.g. build dialog handlers on first use, or make `importSongBytes` async and `import()` the parsers.

## Tests

- **Unit** (Vitest, `tests/`, runs in node): pure modules directly; DOM tests opt in per file (`happy-dom`, or `jsdom` for XML). Characterization snapshots pin behaviour that was ported: playback (`playbackCharacterization.test.ts`), the audio graph on a fake AudioContext (`audioEngine.test.ts`), GP3/4/5 import from byte-built files (`guitarProImport.test.ts`), the `Song` facade, note entry and classical conversion. Coverage floors per folder are in `vite.config.ts`.
- **E2E** (Playwright, `e2e/`, desktop Chromium and a Pixel 7 profile) runs against the Vite dev server and drives the app through its own modules (`await import('/src/stores/song.ts')` inside `page.evaluate`). It covers editing, undo, shortcuts, playback and navigation, practice, import fixtures and fuzzing, GP5/GT/MusicXML roundtrips, the phone layout, and screenshot baselines for classical notation and the sheet (per OS: `win32` locally, `linux` from CI).
- **CI** (`.github/workflows/ci.yml`): unit tests with coverage, typecheck, lint, `build:check`, Playwright on Linux with a generated stand-in SoundFont.

## Known weak spots

- `Song` is still a global mutable object that any service can write, and several services are singletons created on import (`audioGraph`, `modalManager`, `playback`). Tests mock them per file.
- The dialog windows are managed outside Vue: `modalManager` finds elements by id, toggles classes and attaches interact.js. This is also why the desktop chrome stays mounted in the phone layout.
- The startup modules form one cyclic cluster (`editor-core`), so none of the dialog handlers or importers can be lazy-loaded without untangling imports first.
- Render invalidation still goes through `render.*` events rather than reactive dependencies.
- Some leftovers from the migration remain thin wrappers: `renderBridge.ts`, `playbackEngineBridge.ts` and `durationReplacerAdapter.ts` adapt between older and newer interfaces.
- 26 lint warnings (complexity, function length, `any`), mostly in ported code: the GP5 writer, `durationEditing`, `barFilling`, `computeBarWidth`, `manualChunks`.
