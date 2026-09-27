# GuitarTabVue Architecture



## Overview



GuitarTabVue is a Vue 3, Vite, and TypeScript application for editing and playing guitar tab. The current codebase is a hybrid architecture:



- A modern Vue renderer and composition layer lives under `src/components`, `src/composables`, `src/utils`, and `src/types`.

- A large legacy music, notation, playback, and mutation core still lives under `src/assets/js`.

- The active tab editor depends on both layers at the same time. Vue owns UI composition and all tab rendering; the legacy modules `Song` and `tab` still own mutation, width calculation, and playback timing.



That hybrid model explains most of the current maintenance cost: rendering, editing logic, playback state, and global events are split across modern reactive code and legacy imperative modules.



## Runtime Layers



### 1. Application Shell



Main entry points:



- `src/main.ts`

- `src/App.vue`



Responsibilities:



- bootstraps Vue and Pinia

- loads global styles, including the CSS variable layer in `src/style.css`

- mounts the top-level app shell

- lazy-loads heavier shell regions such as the effects bar, sequencer, footer, and modal container



Important note:



- `src/style.css` is a functional dependency of the modern tab renderer, not only a cosmetic stylesheet. If it is removed from `src/main.ts`, the tab sheet background and string lines lose their CSS variable values and become effectively invisible.



### 2. Modern Tab Renderer



Primary files:



- `src/components/tab/GuitarTabView.vue`

- `src/components/tab/TabRow.vue`

- `src/components/tab/TabMeasure.vue`

- `src/components/tab/TabMeasureInfo.vue`

- `src/components/tab/TabNote.vue`

- `src/components/tab/TabDurations.vue`

- `src/components/tab/TabEffects.vue`



Responsibilities:



- computes row and measure layout for the SVG tab sheet

- renders strings, separators, notes, durations, effects, markers, repeats, and metadata

- translates editor selection into visible UI state

- coordinates context-menu actions and note mutation commands



Current reality:



- this layer is now partially typed and significantly cleaner than before

- it still depends on legacy width calculation, block mapping, and mutation helpers

- some larger manager components in the same folder still carry `any`-heavy logic and broad responsibilities

Composables (`useSongData`, `useTabSelection`, `useTrack`, `typedEventBus`, `types/tab.ts`) provide Vue-friendly access to song data, selection, and shared renderer types above the editor services layer.



### 3. Editor Services Layer (`src/services/editor/`)

Primary files:

- `src/services/editor/editorCore.ts` — Vue-facing adapter over `songState`, layout, selection, and mutations
- `src/services/editor/renderBridge.ts` — layout queries (`getPositionInRow`, block/row geometry) backed by `useTabRenderLayout`
- `src/services/editor/measureLayoutEngine.ts` — single row-breaking and width pipeline
- `src/services/editor/playbackController.ts`, `playbackEngineBridge.ts`, `playbackPositionResolver.ts`
- `src/services/editor/noteCommands.ts`, `durationCommands.ts`, `renderCommands.ts`, …

`playbackLoopController.ts` lives at `src/services/playbackLoopController.ts` (pure loop/transport math, no DOM).

The old `services/legacy/` folder name and `legacy*` export prefixes were removed; these modules are the normal editor boundary, not a temporary shim.

### 4. Domain and Mutation Core (`src/assets/js/`)



Primary files and modules:



- `src/assets/js/songData.ts`

- `src/assets/js/tab.ts`

- `src/services/editor/playbackController.ts`

- `src/services/editor/navigationController.ts`

- `src/services/editor/renderEventBridge.ts`

- `src/assets/js/menuHandler.ts`

- `src/assets/js/vexflowClassical.ts`

- `src/assets/js/playBackLogicNew.ts`

- `src/assets/js/audioEngine.ts`



Responsibilities:



- canonical song, measure, beat, and note data structures

- note and duration mutation logic

- measure width computation and renderer mapping data

- playback timing, MIDI and audio behavior

- classical notation rendering via VexFlow



Architectural characteristic:



- this layer is still the effective source of truth for the musical model and many editor commands

- it is highly stateful and optimized around global mutation rather than explicit data flow



### 5. UI Control Surfaces



Primary files:



- `src/components/Menu.vue`

- `src/components/ModalsContainer.vue`

- `src/components/NoteContextMenu.vue`

- several modal components under `src/components`



Responsibilities:



- toolbar and menu actions

- modal orchestration

- note effect toggles and duration actions

- bridge between user actions and legacy mutation commands



This area is cleaner than before, but it still contains legacy integration points and event-driven coupling.



### 6. Playback and Audio



Primary files:



- `src/composables/usePlayback.ts`

- `src/components/Sequencer.vue`

- `src/components/Mixer.vue`

- `src/assets/js/audioEngine.ts`

- `src/assets/js/midiReceiver.ts`

- `src/assets/audio/*`



Responsibilities:



- transport state

- sequencer and mixer UI

- audio graph setup and playback behavior

- SoundFont-driven sample playback



This subsystem is functionally rich but still tightly coupled to the legacy core and large asset footprint.



## Data Flow



The main runtime flow today looks like this:



1. Vue bootstraps the app and global styles in `src/main.ts`.

2. `src/App.vue` mounts the shell and async-loads secondary panels.

3. `src/components/tab/GuitarTabView.vue` reads reactive bridge data from `useSongData` and `useTabSelection`.

4. The renderer computes row and measure layout through `editorCore.ts` and `useTabRenderLayout.ts`, but still uses legacy helpers from `tab.ts` and `songData.ts` for width, block mapping, and mutations.

5. Render invalidation flows through typed events (`renderCommands.ts` → `useTabRenderInvalidation.ts`); playback bar and scroll use `playbackController.ts` and `navigationController.ts`.

6. UI actions emit through `typedEventBus`, call composables, or directly trigger legacy mutation helpers.

7. Playback, notation, and modal flows still cross the Vue and legacy boundary frequently.



The important architectural takeaway is that the codebase does not yet have a single clean application state boundary. Vue is the UI framework, but the legacy modules still own much of the real business state.



## Build and Tooling



Primary files:



- `vite.config.ts`

- `package.json`

- `tests/durationReplacer.test.ts`

- `eslint.config.mjs`



Current state:



- Vite handles application build and manual chunk splitting

- Vitest is configured with focused coverage around bridge, layout, menu, and render-command seams

- ESLint exists with a flat config focused on Vue, TypeScript, and maintainability rules rather than template formatting churn

- lint coverage includes `src/components/Menu.vue`, `src/services/**/*.ts`, composables, tab renderer files, and shared utils

- maintainability warnings for function complexity and overly long functions are active so refactors can be driven by lint instead of formatter rules

- the lint command currently surfaces remaining debt as warnings, which is intentional for incremental cleanup



Manual chunk groups currently isolate:



- framework libraries

- notation and VexFlow code

- UI vendor libraries

- serialization helpers

- PDF export helpers

- audio engine code

- modal handlers

- tab renderer files

- studio UI components



## Current Strengths



- The white-mode renderer problem was fixed at the root by restoring the missing stylesheet import instead of only repainting symptoms.

- The modern tab renderer now has a shared type layer and better-defined payloads across several core components.

- **`svgDrawer.ts` deleted (~3,100 lines).** The legacy DOM tab renderer is gone. Vue (`GuitarTabView.vue` and children) is the sole tab renderer.

- Playback bar movement, scroll-to-block, page-mode toggle, and navigation event wiring now live in focused legacy service modules instead of a monolithic drawer class.

- SVG primitive helpers for modals live in `src/utils/svgPrimitives.ts`.

- Chord diagram DOM construction for legacy modal surfaces lives in `src/services/editor/chordDiagramSvg.ts`.

- Full render invalidation (`render.block`, `render.blocks`, `render.overBar`, `render.durations`, `render.chordDiagrams`, `render.deleteTrack`) is handled exclusively by `useTabRenderInvalidation.ts`.

- Modern playback-bar and selection presentation use Vue-owned state seams (`usePlaybackBarState`, `useSelectionSurfaceState`).

- `src/components/tab/GuitarTabView.vue` is smaller and more focused after extracting layout/data assembly into `src/composables/useGuitarTabLayout.ts` and edit command handling into `src/composables/useTabEditorCommands.ts`.

- Modern selection and render invalidation now use component-scoped compatibility bridges in `src/composables/useTabSelectionBridge.ts` and `src/composables/useTabRenderInvalidation.ts` instead of living as module-scope listeners inside state composables or the view.

- `src/components/tab/TabRow.vue` now reuses shared layout/hit-test helpers from `src/utils/tabLayout.ts`, and the new `tests/tabLayout.test.ts` covers short-note hit testing and scaled-SVG coordinate translation.

- current track and voice selection now flow through explicit reactive ownership in `src/composables/useEditorScopeState.ts` instead of the `ui.trackChanged` and `ui.voiceChanged` broadcast events

- `src/components/tab/TabEffects.vue` is now a thin renderer over the typed effect builder in `src/utils/tabEffects.ts`, which is independently testable

- `src/components/Menu.vue` now listens on typed menu events through `src/services/menuEventBridge.ts`, and key UI state such as tempo display, tuplet selection, and record-button state are Vue-owned instead of queried from the DOM

- `src/components/Menu.vue` now derives pressed and disabled toolbar state from selected beat and note data, and resynchronizes from the bridged song-data update flow after edits

- `src/composables/useTempoState.ts` gives the BPM display an explicit reactive owner so the sidebar tempo and rendered measure tempo stay aligned

- `src/composables/useSongData.ts` now consumes a typed song-data bridge through `src/services/songDataEventBridge.ts` and applies snapshots through focused helpers in `src/composables/songDataState.ts`

- first render-command adapters now exist in `src/services/editor/renderCommands.ts`, and metadata, effect, chord, and track-delete flows no longer call `svgDrawer.rerenderBlock` directly for invalidation

- Core renderer entity types in `src/types/tab.ts` now alias the canonical `songData.ts` model instead of duplicating parallel interfaces.

- Inline browser-global handlers and stale jQuery-era glue were reduced.

- Vuex is gone and Pinia is the active store path.

- Bundle structure is better after chunking and async component loading.

- Lint infrastructure now exists and can guide incremental cleanup rather than forcing a risky all-at-once rewrite.

- pure menu effect mutations now live in `src/services/menuEffectMutations.ts`, shared by `menuHandler.ts`, `menuHelper.ts`, and tests

- high-complexity toolbar action handlers now live in `src/composables/useMenuActions.ts`, leaving `Menu.vue` focused on reactive UI state and event wiring

- legacy `menuHandler.ts` DOM toggles for pressed/disabled toolbar buttons were replaced with typed menu resync events consumed by Vue

- `tab.ts` and `overlayHandler.ts` now request menu resync through the event bridge instead of calling DOM-oriented menu helpers directly

- keyboard note-length shortcuts now route through `src/services/menuActionCommands.ts` instead of legacy DOM-oriented `menuHandler.noteLengthSelect`

- chord diagram and track-delete invalidation now route through `src/services/editor/chordDiagramAdapter.ts` and typed render commands (`render.chordDiagrams`, `render.deleteTrack`)

- `Menu.vue` menu-state reads now go through `src/services/editor/editorCore.ts` instead of direct `songData.ts` access for beat, note, and tie-eligibility queries



## Status Snapshot



### Done



- root-cause visual fixes for white mode, tab sheet background, and string-line visibility

- typed legacy adapter seams for the modern renderer, track management, playback bar ownership, and layout ownership

- lazy-loaded classical notation entry through the adapter boundary

- modern beaming rules and focused renderer regressions for first-note visibility and beam grouping

- `GuitarTabView.vue` split into a layout composable and an editor-command composable

- component-scoped modern bridges for selection navigation and render invalidation

- shared `tabLayout.ts` ownership for row hit testing and selection geometry, backed by dedicated tests

- explicit reactive ownership for current track and current voice through `useEditorScopeState.ts`

- `TabEffects.vue` decomposition through the pure `tabEffects.ts` builder and dedicated tests

- `Menu.vue` migration onto typed menu-event listeners with a legacy bridge kept at the boundary

- reactive BPM ownership through `useTempoState.ts`, fixing the stale sidebar tempo source-of-truth problem

- `Menu.vue` pressed and disabled state derivation now lives in Vue-owned helper logic instead of local DOM class toggles

- typed song-data bridging through `src/services/songDataEventBridge.ts` and snapshot application helpers in `src/composables/songDataState.ts`

- render-command extraction through `src/services/editor/renderCommands.ts` for block, multi-block, over-bar, duration, chord-diagram, and track-delete invalidation

- modal rerender migration for metadata, note/beat effects, chord flows, and track deletion

- expanded focused tests for `tabEffects`, menu state derivation, song-data bridging, render-command emission, menu effect mutations, menu action commands, and tie-eligibility queries

- expanded lint coverage and maintainability rules for Menu and service-layer code

- pure menu effect mutations through `src/services/menuEffectMutations.ts`

- toolbar action extraction through `src/composables/useMenuActions.ts`

- legacy menu DOM ownership reduction in `menuHandler.ts`, `tab.ts`, and `overlayHandler.ts`

- keyboard note-length routing through `src/services/menuActionCommands.ts`

- chord diagram adapter boundary through `src/services/editor/chordDiagramAdapter.ts`

- complete removal of `src/assets/js/svgDrawer.ts` (~3,100 lines) and migration to `playbackController`, `navigationController`, `renderEventBridge`, and `svgPrimitives`

### In Progress

- the domain adapter layer is established but incomplete; `tab` is still the effective mutable core for layout-derived arrays and many mutations, while song data now lives in `songState` behind the legacy `Song` facade

- broadcast-event reduction is complete: production code uses `typedEventBus` only; legacy mitt relays are gone (`eventBus.ts` is a deprecated re-export)

- `useMenuActions.ts` still owns substantial mutation orchestration and remains a lint hotspot for function length

- end-to-end editor behavior coverage is better around command seams, but full editing-flow integration tests are still narrow

### Pending Next

Post-svgDrawer Steps 1–9 below are **done**. For the compact “what’s left” plan and the **next big 5**, see [IMPROVEMENTS.md](./IMPROVEMENTS.md) (testing/CI, classical/layout hardening, single event bus, god-module splits, Vue/launch polish).



## Main Architectural Problems



### 1. Mutable Global Core



`Song`, `tab`, and related modules still behave like mutable application singletons. That makes testing hard, increases hidden coupling, and forces Vue components to know too much about low-level editor internals.



### 2. Blurred Responsibility Boundaries

Some large tab components and composables still mix layout calculation, mutation orchestration, selection handling, event bridging, and legacy compatibility work in one place.

The legacy `tab.ts` class still combines width computation, note mutation, row assignment, and invalidation triggers.



### 3. Single Renderer, Dual Layout Sources

The app now has one tab renderer (Vue SVG), but layout data is still computed in two places: modern `editorCore.buildModernTabRows()` for display and legacy `tab.assignBlocksToRows()` for width/row breaking used by playback and overlays. These must converge.



### 4. Event Bus Overuse

`typedEventBus` is now the sole event bus. Remaining work is reducing broadcast-style coordination where direct state ownership or explicit commands would be clearer.



### 5. Incomplete Domain Typing



The modernization pass improved the core renderer files, but many manager and helper surfaces still rely on `any` or weak structural assumptions.



The remaining type-hierarchy problem is narrower now, but still visible:



- renderer-facing Vue files should consume `src/types/tab.ts` rather than importing `Note`, `Measure`, or `Track` types directly from `src/assets/js/songData.ts`

- legacy boundary modules such as `src/services/editor/editorCore.ts` and `src/services/editor/trackAdapter.ts` are the correct place to keep direct `songData.ts` imports

- the next cleanup targets are `src/composables/useMenuActions.ts`, `src/components/Sequencer.vue`, and `src/components/EffectsBar.vue` where legacy runtime access and UI-facing types are still mixed together



### 6. Legacy Module Concentration



`src/assets/js` is still both a compatibility layer and a live business-logic layer. That folder is too broad in responsibility and too central to safely evolve the codebase without a clearer boundary.



## Status-Tracked Refactor Plan



### 1. Domain Adapter Layer [in progress]



What is done:



- `src/services/editor/editorCore.ts` and `src/services/editor/trackAdapter.ts` already provide typed seams for major parts of the modern tab path.

- modern layout, playback bar, and selection presentation now flow through Vue-facing composables instead of raw DOM ownership in the view layer.

- tie-eligibility and menu-state reads in `Menu.vue` now use adapter queries instead of direct `Song` traversal.



What remains:



- consolidate more note mutation, navigation, and render query logic behind explicit adapter APIs

- continue moving remaining direct singleton assumptions out of Vue components and UI controllers



### 2. Classical Notation Isolation [partially done]



What is done:



- classical notation loading already moved behind the adapter boundary and no longer has to be imported directly by the modern tab surface



What remains:



- keep isolating notation-only behavior so tab editing does not carry notation concerns by default



### 3. `GuitarTabView.vue` Decomposition [mostly done]



What is done:



- row and page layout logic now lives in `src/composables/useGuitarTabLayout.ts`

- note edit and context-menu command handling now lives in `src/composables/useTabEditorCommands.ts`

- legacy event compatibility for selection navigation and render invalidation now lives in dedicated bridge composables instead of the view and state modules



What remains:



- keep the component focused on template wiring and lifecycle registration only



### 4. Typed Query and Geometry Ownership [in progress]



What is done:



- `src/utils/tabLayout.ts` now owns beat hit testing, SVG coordinate translation, and shared selection render-point calculation

- `src/components/tab/TabRow.vue` now consumes those helpers instead of duplicating the same math locally



What remains:



- extend the same query-first pattern to other interaction-heavy surfaces that still carry local geometry logic



### 5. Broadcast Event Reduction [mostly done]



What is done:



- selection navigation is no longer registered as a module-scope listener inside `useTabSelection.ts`

- modern render invalidation is no longer wired directly inside `GuitarTabView.vue`

- current track and voice ownership no longer depend on `ui.trackChanged` and `ui.voiceChanged`

- `Menu.vue` now subscribes through the typed menu bus while a boundary bridge keeps legacy emitters working

- song-data changes now have a typed bridge path, and `Menu.vue` and `useSongData.ts` consume that bridged event instead of depending on raw legacy listeners in the modern layer

- typed render-command seams now cover block, multi-block, over-bar, duration, chord-diagram, and track-delete invalidation

- modal rerender migration is complete for the metadata, effect, chord, and track-delete clusters

- keyboard note-length shortcuts now use the shared menu action command path



What remains:



- remove compatibility relays once the remaining legacy emitters stop targeting the old menu event bus



### 6. Test Expansion [in progress]



What is done:



- focused tests now exist for bridge behavior, beaming rules, shared tab layout geometry, menu state derivation, tab effects, render-command emission, menu effect mutations, menu action commands, and tie-eligibility adapter queries



What remains:



- add editor behavior tests for duration changes, context-menu effect actions, and broader note-edit flows

- expand coverage around row breaking and fallback width behavior



### 7. High-Value Remaining Cleanup [in progress]



Priority order for the next large implementation blocks:



1. split `useMenuActions.ts` into smaller typed command modules

2. migrate remaining Vue controllers off direct `songData.ts` reads where adapter queries already exist

3. broaden editor behavior tests for duration and effect flows

4. attack the next warning-heavy manager surfaces after the menu command path is thinner

The svgDrawer removal is complete. All tab rendering and invalidation now flow through Vue and typed events.



## Recommended Refactor Roadmap



### Phase 1: Stabilize the Bridge [done]



- shared renderer-facing types are in place for the main modern tab path

- modern layout, playback bar, and selection presentation already have Vue-owned seams

- secondary UI controllers now route menu sync and render invalidation through typed bridges instead of DOM mutation



### Phase 2: Extract Commands and Queries [in progress]



- command extraction is active in `useTabEditorCommands.ts`, `useMenuActions.ts`, and `menuActionCommands.ts`

- shared query ownership is active in `tabLayout.ts`, `menuUiState.ts`, and `editorCore.ts`

- render invalidation is active through `renderCommands.ts`, `useTabRenderInvalidation.ts`, and `renderEventBridge.ts` (navigation and page-mode events only; no DOM redraw listener)



### Phase 3: Decouple Heavy Features [partially done]



- notation loading is already more isolated

- the next step is continuing to split notation, audio, and export-only concerns away from the default editing path



### Phase 4: Raise Quality Gates [in progress]



- focused regression tests are growing with each seam extraction (157+ unit tests, 2 Playwright smoke tests)

- lint now actively reports long and complex functions in the refactor target areas

- the next step is expanding integration coverage before tightening lint or type strictness further



## Practical Conclusion



This project does not need a full rewrite. The highest-value path is an incremental one:



- keep the modern Vue renderer

- keep using TypeScript to wrap legacy structures

- progressively move business logic out of `src/assets/js`

- reduce direct singleton access

- lazy-load heavy notation features



That approach improves maintainability without throwing away the working editor and playback logic that already exists.



The planned cleanup block from the previous architecture pass is now complete, including full removal of `svgDrawer.ts`. What remains is consolidating the mutable legacy core (`Song`, `tab`) and unifying layout ownership.



## Next Big Steps (Post-svgDrawer)



With the legacy DOM renderer gone, the highest-value work shifts from “stop drawing twice” to “own state once.” Recommended order:



### Step 1: Unify Layout Ownership [done]

**Problem:** Row breaking and block widths were computed in `tab.assignBlocksToRows()` for legacy consumers, while the Vue renderer rebuilt rows independently via `editorCore.buildModernTabRows()`.

**Solution:** `src/services/editor/measureLayoutEngine.ts` is now the single layout pipeline. Both `buildModernTabRows()` and `tab.assignBlocksToRows()` delegate to it. The engine applies row breaking with stretched measure widths, writes `useTabRenderLayout` state, and syncs `tab.blocksPerRow`, `tab.finalBlockWidths`, `tab.blockToRow`, and `tab.measureOffset`.

### Step 2: Extract `tab.ts` Mutation Commands [done]

**Solution:** Note deletion/addition lives in `src/services/editor/noteCommands.ts`. Duration changes live in `src/services/editor/durationCommands.ts`. `tab.ts` delegates to these modules and keeps a thin facade for backward-compatible `Tab.*` static calls.

### Step 3: Vue Overlay Layer for Range Selection [done]

**Problem:** `overlayHandler.ts` still tracked loop/selection intervals logically, but the visual blue range overlay was tied to deleted legacy DOM. Sequencer and copy/paste relied on overlay state without visual feedback.

**Solution:** `src/utils/overlaySelectionLayout.ts` computes per-row overlay geometry from `overlayHandler` start/end positions and `renderBridge` layout queries (same math as the old `drawOverlayRow`). `src/composables/useOverlaySelection.ts` reacts to `tabStore.selectionVersion`; `TabRow.vue` renders the semi-transparent blue range rect. `overlayHandler.redrawOverlays()` now only invalidates Vue selection rendering instead of mutating DOM.

### Step 4: Replace `Song` Singleton with Reactive Store [done]

**Problem:** `Song` was a mutable global object. Vue synced via full JSON snapshots on every `song-data-changed` event.

**Solution:** `src/stores/songState.ts` holds the canonical reactive song data. `Song` is now a Proxy facade over `songState` (legacy imports keep working). `src/stores/songStore.ts` exposes Pinia getters/actions. `useSongData` reads `songState` directly — no clone-on-sync. `editorCore` and `tabStore` read/write through `songState`.

### Step 5: Playback Composable [done]

**Problem:** `playBackLogicNew.ts` owned transport timing, but Vue had no reactive playhead state and Menu/Sequencer imported the legacy singleton directly.

**Solution:** `playbackTransportState` + `usePlaybackEngine` expose reactive transport (`isPlaying`, block/beat position). `playbackEngineBridge.ts` publishes from legacy hooks in `playBackLogicNew.ts`. `Menu.vue` and `useMenuActions` call `usePlaybackEngine()` for play/stop/step.

### Step 5b: Tab Drag Range Selection [done]

**Problem:** Range overlay worked from the Sequencer but not from the tab surface; copy/paste in the Vue editor only handled a single beat.

**Solution:** `useTabRangeSelection` + `resolveTabPointerPosition()` wire drag-to-select on `TabRow` string areas. `useTabSelection` delegates copy/paste to `overlayHandler` when a range is active. Ctrl+C/V works when the tab SVG is focused.

### Dead Code Cleanup Session [done — pass 1]

Removed legacy DOM overlay/triangle code from `overlayHandler`, dead `noteDrawn` field and DOM teardown, no-op playback block marking (`lastMarkedBlock`/`updateMarkedBlock`), `lastBlock`/`lastFader` playback highlighting, duplicate note scheduling in `playNote`, ~50 lines of commented `svgDrawer` render path in `tab.drawTrackMain`, duplicate `usePlayback` state (now re-exports `usePlaybackEngine`), unused `applySongSnapshotToState`, `Helper.deleteDOMObject`, unused `.currentMarkedBlock` CSS, and the stale `dist-refactor-check/` build folder. `tab.drawTrackMain` now only re-syncs layout and emits `song-data-changed`.

**Remaining (pass 2):** audit modal handlers for direct `Song` imports (low priority).

### Step 6: Decouple VexFlow / Classical Notation [done]

**Problem:** `vexflowClassical.ts` shared layout queries and triggered full-track redraws on toggle.

**Solution:**
- `classicalNotationLayoutState.ts` — reactive layout slice (stave Y, row margin, beat widths) published by VexFlow when active
- `classicalNotationAdapter.ts` — lazy-loads VexFlow only when classical mode is on; layout queries read from the state store (no VexFlow import on the tab path)
- `ClassicalNotationLayer.vue` + `useClassicalNotation` — Vue HTML overlay renders `#vexFlowRow{N}` containers; redraws via `classical-notation-changed` event instead of `tab.drawTrackMain`
- Toggle no longer disables the menu button or forces a legacy full-track redraw; it re-syncs block layout and emits Vue invalidation events
- `overlaySelectionLayout` and `playbackController` read stave offsets from the layout store

### Step 7: Shrink `useMenuActions` and Finish Adapter Migration [done]

**Problem:** Menu toolbar orchestrated many legacy mutations through one ~590-line composable; `Sequencer.vue` and `EffectsBar.vue` read `songData.ts` directly.

**Solution:**
- Extracted `notationCommands.ts`, `dynamicsCommands.ts`, and `durationModifierCommands.ts` under `services/editor/`
- `useMenuActions.ts` reduced to ~145 lines — wires playback, note effects, and delegates to command modules
- Extended `editorCore` with playback-instrument helpers (`getPlayBackInstrument`, `setPlayBackInstrumentEffect`, `togglePlayBackInstrumentFlag`, `isBeatEmpty`, `setTrackName`, `canDeleteTrack`)
- `Sequencer.vue` and `EffectsBar.vue` no longer import `Song` directly

### Step 8: Quality Gates [done]

- **Layout convergence:** `tests/layoutConvergence.test.ts` asserts `tab.blockToRow`, `blocksPerRow`, and `finalBlockWidths` stay aligned with `useTabRenderLayout` after `assignBlocksToRows` and measure mutations
- **Integration mutations:** `tests/integrationMutations.test.ts` covers duration commands, dynamic toggles, undo stack pop, overlay copy/paste, and reactive playback bar positioning
- **Unit helpers:** `playbackPositionResolver.test.ts`, `tabEditorCommandHelpers.test.ts`, `dynamicsCommands.test.ts`
- **Complexity reduction:** extracted `tabEditorCommandHelpers.ts` and `playbackPositionResolver.ts` to bring `useTabEditorCommands` and `playbackController` under eslint complexity limits

**Total:** 157+ unit tests and 2 Playwright smoke tests (`npm test`, `npm run test:e2e`)



### Step 9: Beat coordinates, loop transport, cloud save, naming cleanup [done]

- **Beat positions:** `src/utils/beatPositionInRow.ts` + `renderBridge.getPositionInRow()` — single layout-backed coordinate API; `layoutConvergence.test.ts` includes beat-level assertions
- **Playback loop:** `src/services/playbackLoopController.ts`, `playbackLoopState`, loop boundary sync for the Vue playback bar
- **Cloud save UI:** `CloudSongsModal.vue`, Menu ☁ button, `?song=<id>` deep links, `cloudSongApi.ts` / `cloudSongLoader.ts`
- **Bundle CI:** `npm run build:check` enforces a production bundle budget
- **Naming:** `services/legacy/` → `services/editor/`, dropped `legacy*` export prefixes; removed unused duplicate `utils/settingsManager.ts` (app uses `assets/js/settingManager.ts` only)

### Suggested Phase Mapping

| Phase | Focus | Outcome |
|-------|-------|---------|
| A–C | Steps 1–9 | Done — see status above |
| D | [IMPROVEMENTS.md](./IMPROVEMENTS.md) next big 5 | CI/tests, classical hardening, typed bus only, thinner legacy cores, launch polish |


