# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GuitarTab: a browser guitar-tab editor and player (Vue 3 + TypeScript + Vite, Web Audio, VexFlow for standard notation). Imports Guitar Pro 3–8, MIDI and its own `.gt` format; exports `.gt`, GP5, GPX and MusicXML.

## Where things are

- The git repository is this folder (`guitartab/`). Planning docs live one level up, outside the repo: `../IMPROVEMENTS_AUDIT.md` (the working plan: numbered "Big wins"; "continue with the next big improvement" means this list), `../RELEASE_PLAN.md`, `../DEPLOYMENT.md`. CI is `.github/workflows/ci.yml` (unit + coverage, typecheck, lint, build budgets, Playwright on Linux); the old `../.github/workflows/guitartab-ci.yml` outside the repo never ran.
- `HANDOVER.md` is the detailed log of what was built, how it was verified and what was left. Read its sections 1, 4–7 before larger work; add a section when you finish one.
- `ARCHITECTURE.md` describes the older refactor history; parts are outdated (e.g. files it names were deleted).

## Working rules for this repo

- **The user commits.** Don't commit, stash, reset or discard changes unless asked.
- Never commit `Empire Of The Sun - We Are The People v2.gp5` (copyrighted local benchmark file) or `test-results/`. Ask before committing `public/audio/` (large samples, unclear licence).
- Report verification honestly (test counts, flakes, what was only checked by reading code); the user reads summaries, not diffs, and values screenshots for visual changes.

## Commands

```bash
npm run dev:local                  # dev server on 127.0.0.1:4173 (.claude/launch.json "guitartab")
npx vitest run                     # unit tests (Vitest)
npx vitest run tests/keyboardShortcuts.test.ts -t "fret entry"   # one file / one test
npm run test:coverage              # unit tests with per-folder coverage floors (vite.config.ts test.coverage.thresholds)
npm run typecheck                  # vue-tsc
npm run lint                       # eslint . (everything except the legacy core src/assets/js)
npm run format                     # Prettier on .ts/.mjs (not run repo-wide yet; see HANDOVER 3.21)
npm run build:check                # production build + per-chunk size budgets (scripts/check-bundle-budget.mjs)
npx playwright test                # e2e: projects "chromium" (desktop) and "mobile" (Pixel 7); own dev server on :4175
npx playwright test keyboard-shortcuts -g "Space"     # one spec / one test
npx playwright test --project=mobile                  # only *.mobile.spec.ts
npx playwright test classical-notation --update-snapshots   # refresh screenshot baselines after an intended visual change
GT_PERF_FILE="Empire Of The Sun - We Are The People v2.gp5" npx playwright test perf-note-entry   # opt-in keystroke benchmark
```

- `npm run lint` covers all `.vue`, services/stores/utils/composables, tests, e2e and scripts; `src/assets/js` is excluded except the handlers listed in `eslint.config.mjs`. 16 warnings (complexity/length/any) are known; errors are not acceptable.
- A husky pre-commit hook runs lint-staged (`eslint --fix`, Prettier on staged `.ts/.mjs`). `.prettierignore` keeps `src/assets/` and `*.vue` out of Prettier for now.
- CI has no `public/audio/`: it generates a stand-in SoundFont with `node scripts/make-test-soundfont.mjs`. Linux screenshot baselines come from CI's `linux-snapshots` artifact.
- On this Windows machine the Bash sandbox sometimes fails to spawn esbuild (`spawn EPERM`); run Vite/Vitest/Playwright through PowerShell then.
- **Don't edit source files while Playwright runs**: it uses the Vite dev server, and a hot reload fails random tests ("Execution context was destroyed").
- The first Playwright run after a cold dev-server start can fail several tests; re-run before investigating.

## Architecture (big picture)

The app is a hybrid: a modern Vue layer (`src/components`, `composables`, `services`, `stores`, `utils`) on top of a legacy, singleton-heavy core in `src/assets/js` (`songData.ts`, `tab.ts`, `appManager.ts`, `playbackEngine.ts`, `audioEngine.ts`, `overlayHandler.ts`, GP readers/writer). Vue renders everything; the legacy core still owns most mutations and playback (undo, selection, settings and notifications are stores/services now).

**Song data.** `src/stores/songState.ts` is the reactive source of truth; `Song` (`songData.ts`) is a facade that reads/writes through it, so legacy edits are reactive. Shape: `Song.measures[track][block][voice][beat]`. A "block" is a bar (bar metadata in `Song.measureMeta[block]`); the type `Beat` is one beat. Use the accessors `Song.getBeat/findBeat/getNote(ref)` rather than indexing by hand. Optional features are optional fields (`beat.text`, `beat.chord`, `effects.stroke`, …); old `.gt` files are upgraded on load by `services/songMigrations.ts` (add a step there when changing a field). Use `toRaw` for bulk reads.

**String order.** Data string index 0 is the **lowest** string (pitch = tuning[string] + fret; same in GP files, MIDI, audio, notation), drawn on the **bottom** tab line. Convert with `stringLine()` (`utils/tabStrings.ts`) whenever a string becomes a screen position. Exception: chord `frets[]` are stored highest string first.

**Rendering pipeline.** `GuitarTabView.vue` → `useGuitarTabLayout` → `editorCore.buildModernTabRows` → `services/editor/measureLayoutEngine.ts` (the only row-breaking/width pipeline; also syncs legacy `tab.blocksPerRow` etc.). Vertical layout uses per-row annotation lanes (`utils/tabRowLanes.ts`; row-local y, `y = 0` = top string). Layout is cached per block (`stores/tabRenderLayout.ts`) so unchanged bars don't re-render. Pitfall: the layout is computed inside a computed that writes reactive state; reads during that write must use `toRaw`, otherwise "Maximum recursive updates". Only visible rows are mounted (`useVisibleTabRows.ts`); anything that needs the whole tab in the DOM (PDF/SVG export, print) must wrap it in `withAllRowsRendered()`. Classical notation (VexFlow, lazy) draws one staff per visible row from layout metrics, never from drawn output (`vexflowClassical.ts`, `ClassicalRowSurface.vue`, `classicalNotationAdapter.ts`).

**Events and state.** `utils/typedEventBus.ts` is the only event bus (`render.*`, `navigation.*`, `song-data-changed`, a few `ui.*`). Settings are the reactive `stores/settingsState.ts` (persisted per key; imported as `Settings`); `EPSILON`/`OVERBAR_ROW_HEIGHT` are constants exported there. `classicalNotationLayoutState.active` is not a mirror of `Settings.vexFlowIsActive` but means "classical layout metrics are ready". The toolbar's pressed/disabled buttons are a `computed` (`composables/useToolbarState.ts`) over the cursor, range and song, so no event is needed to refresh them. Banner messages: `showNotification(text, kind, action?)` in `stores/notificationState.ts` (rendered by `App.vue`); `showUserError` wraps it. The edit cursor and the range selection live in the reactive `stores/selectionState.ts` (read and write `selectionState.cursor` directly). The range is driven by `services/editor/rangeSelection.ts` (`startRange`, `extendRange`, `applyRangeAsLoop`, `clearRange`, `currentLoopInterval`, `notesInRange`, `rangeHasNotes`), which also owns the loop interval. `useTabSelection().currentSelection` is a further mirror; `navigation.setClickedPos` moves the cursor.

**Layering.** `services/`, `stores/`, `utils/`, `types/` and the legacy core must not import `components/` or `composables/` (ESLint `no-restricted-imports`; `tests/layering.test.ts` covers `src/assets/js`). Module-level reactive state goes in `stores/`, not in `composables/` (that folder is for functions used in component setup).

**Editing and undo.** Every undoable edit is an `EditCommand` on the one undo history in `services/editor/editCommands.ts` (`undoHistory.undo/redo/peek/clear/adaptToTrackRemove`, reactive `undoAvailability`; there is no `revertHandler` any more). Most edits use `recordBarEdit(label, { trackId, blockIds, allTracks? }, mutate)`: it snapshots the bars before and after `mutate` and records one step (no hand-written inverse; restores in place so held beat/note references stay live; `mutate` returning false or throwing rolls back). It nests: low-level mutators (`tab.drawNote`, `Tab.deleteNote`, `changeNoteDuration`) record themselves, and a caller that wraps several in `recordBarEdit`/`editTransaction` gets one undo step; commands executed inside join it too. Pass `withoutUndo = true` to those mutators only when building a song (demo, tests). Other commands: `setValue`, `executeCommand`, `songSettingsCommands.ts` (song tempo, track volume, chord library, `recordTrackEdit` for track settings), `measureStructureCommands.ts` (add/remove bar), `recordSongInfoEdit` (title, artist…). Dialogs that edit beats, notes or bar settings use the generic `EditModalHandler` in `assets/js/modals/effectModals.ts`: a config with `defaults`/`read`/`scope`/`write`; the Vue dialog binds `handler.form` and calls `handler.apply()` (one undo step, re-render, close). Add new simple dialogs there; bend, tremolo bar, time signature, chords and track settings have their own handlers. Every command re-renders, refreshes the toolbar and emits `song-data-changed` (autosave). Edits without undo, by choice: mute/solo/pan/effect knobs, master volume, the studio panels. All keyboard shortcuts are one table, `utils/keyboardShortcuts.ts` (`SHORTCUTS`), dispatched by `AppManager.keyDownEvent` (document, capture phase) via `shortcutHandlers` at the bottom of `appManager.ts`; the Help sheet is generated from the same table, so add new shortcuts there. `AppManager` now only holds keyboard dispatch, note entry, range delete and mouse state; loading a song and switching tracks are in `services/editor/trackLoading.ts` (`loadSongIntoEditor`, `switchTrack`, `initTrackPlayback`, `resetEditorState`), fitting bars to a time signature in `services/editor/timeSignatureCommands.ts`. There is no Pinia: state is plain `reactive` modules in `stores/` (the note length for new notes is `stores/noteInputState.ts`; the sequencer's edit mode, playback indicator, dragged bar range and the fader meter canvases are `stores/sequencerState.ts`). MIDI input devices are listed and connected by `services/midi/devices.ts` (access is requested when the MIDI dialog opens); `services/midi/liveInput.ts` sounds live notes, shows them on the piano/guitar and writes recorded notes (one undo step per flush), placing pitches on strings with `services/midi/noteArranger.ts`. Dialogs whose Vue component does everything use `definePlainModal(id, name)` (`modals/baseModalHandler.ts`, reactive `params`). Copy/paste of the range selection is `services/editor/clipboard.ts` (copies are snapshots); the toolbar's effect switches on the song are `services/editor/effectToggles.ts`.

**Playback.** `playbackEngine.ts`: a worker ticks `scheduler()` every 25 ms; notes are scheduled `scheduleAhead` (0.4 s) ahead on the `AudioContext` clock. The song clock counts whole notes; convert with `spw()/wps()`, which apply the practice speed (`stores/practiceState.ts`). Metronome, count-in and speed trainer live there too. Instruments come from a 25 MB SoundFont parsed on the main thread (`sf2parser.ts`); each track bus has a chorus and a small Freeverb (`services/audio/effects.ts`, disposed when the busses are rebuilt). Note lengths in ticks (whole = 64) are `utils/duration.ts`. Beat grouping and bar-local beat x: `services/editor/beatGrouping.ts`; a bar's left offset: `barLeftOffset` in `utils/measureBeatLayout.ts`. The piano and guitar dialogs render `stores/soundingNotesState.ts`: the beat playback has reached plus live notes (MIDI keyboard, piano clicks).

**Import/export.** `GProReader.importSongBytes` is the single import path (typed `ImportError`, rolls back on failure). GP6/7/8: `services/gpContainers.ts` (ZIP/BCFZ/BCFS) → `services/gpifImport.ts`. MIDI: `services/midiImport.ts`. Exports (lazy `songExport` chunk): `musicXmlExport.ts`, `gpifExport.ts` + `gpxWriter.ts`, `GP5Writ.ts`, `.gt` (`utils/gtSerialization.ts`). Parsers build plain data first and then apply it (`parseGpif` → `applyGpifSong`), which keeps them testable in node.

**Layouts.** `stores/layoutModeState.ts`: under 900 px a compact phone layout (`components/compact/`: `CompactBar`, `TouchNotePad`; desktop chrome stays mounted but hidden because legacy code finds elements by id), 900–1199 px desktop chrome with the sheet fitted to the window, wider the fixed desktop sheet. Sheet fitting and pinch zoom: `services/compactLayout.ts`. `?layout=compact|desktop` forces a layout.

**Startup and bundle.** `App.vue` → `startUp()` in `assets/js/guitarTab.ts` (first visit loads the demo song from `data/demoArrangement.ts`; e2e uses the small riff in `data/demoSong.ts`). Chunks are assigned in `vite.config.ts` (`MODULE_CHUNKS`, `IMPORTER_MODULES`, `manualChunks`) and each has a size budget in `scripts/check-bundle-budget.mjs` (entry 16 KB, `toolbar` = `Menu.vue` 32 KB). New startup code should be lazy or go into a named chunk.

## Tests

- **Vitest runs in `node`.** Opt into a DOM per file: `// @vitest-environment happy-dom` (components), `// @vitest-environment jsdom` (XML: happy-dom rejects CDATA). Legacy singletons that need a browser are mocked only where a file opts in, with the one-line `vi.mock(..., () => import('./helpers/legacyMocks').then(...))` pattern (see `tests/helpers/legacyMocks.ts`). Mock `Song` with `tests/helpers/songMock.ts`. `tests/playbackScheduler.test.ts` shows how to drive the real scheduler on fake timers.
- **E2E tests drive the app through its own modules**: `await import('/src/assets/js/songData.ts')` inside `page.evaluate` (works because Playwright runs against the Vite dev server). Song `notes` arrays are sparse; use `Array.from(notes, …)`, not `.map`.
- `waitForEditorShell(page)` (`e2e/helpers.ts`) loads the small one-track riff (frets 0, 2, 3, so assert other frets); `{ demo: 'arrangement' }` gives the four-track demo. It waits for `html[data-editor-ready]`; tests that play audio also call `waitForSoundFont(page)` (`data-soundfont-ready`). No `networkidle` waits.
- Phone tests are `e2e/*.mobile.spec.ts` (run only in the `mobile` project). Long songs: `growSong()` or the effects fixture (`e2e/fixtures/effectsShowcase.ts`) with the overlap detector, never the user's GP5 file.
- Screenshot baselines (`e2e/classical-notation.spec.ts-snapshots/`, `e2e/visual*.spec.ts-snapshots/`) are per OS: `win32` locally, `linux` from CI. Refresh after an intended visual change with `--update-snapshots`.
- For visual checks write throwaway specs as `e2e/zz-*.spec.ts`, pass the output folder via an env var, and delete them afterwards.

## Code style

- TypeScript in `services/`, `stores/`, `utils/`, `composables/`, tests: no semicolons. Legacy `src/assets/js`: semicolons. Match the file you're in; short comments that explain *why*.
- Toolbar popovers must `Teleport` to `<body>` (`#completeBar` clips overflow).
- `src/style.css` defines CSS variables the tab renderer needs; the compact layout's colours are `--compact-*` tokens in `src/assets/css/compact.css` (dark values under `#darkMode`).
