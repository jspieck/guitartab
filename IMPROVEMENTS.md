# GuitarTabVue — Compact Roadmap

**Updated:** September 2026  
**Status:** Hybrid Vue + `src/assets/js` architecture is stable enough for product work. Phases 1–9 in `ARCHITECTURE.md` (layout engine, song store, classical adapter, cloud UI, etc.) are largely done.

This file replaces the old Top-10 list. Use it as the short “what’s left” plan.

---

## Where we are

| Layer | State |
|-------|--------|
| Tab renderer | Vue-only (`GuitarTabView` … `TabEffects`) |
| Layout | Single pipeline: `measureLayoutEngine` |
| Song data | Reactive `songState` + `Song` proxy facade |
| Classical / VexFlow | Lazy adapter + overlay layer (still fragile under toggle/reload) |
| Commands | Many extracted (`noteCommands`, `durationCommands`, `measureStructureCommands`, `revertCommandHandlers`, …) |
| Tests | Vitest + Playwright + CI workflow (see #1) |
| Legacy core | Shrinking: facades remain in `tab.ts` / `audioEngine.ts` / `revertHandler.ts`; playback still concentrated |

---

## Next big 5

### 1. Testing & CI safety net *(in progress — first pass landed)*

**Why:** Recent classical/layout regressions were caught by hand. Unit coverage is good at *seams*, weak at *user flows*.

**Done (Sep 2026):**

- Shared Vitest setup: `tests/setup.ts` (AudioContext/Worker stubs + common heavy-module mocks)
- GitHub Actions: `.github/workflows/guitartab-ci.yml` (unit, typecheck, lint, build:check, Playwright)
- Layout fixtures: `tests/layoutFixtures.test.ts` (narrow wrap, wide single row, classical widening)
- E2E expansion: `e2e/tab-layout.spec.ts` (multi-row tab, note entry, classical row parity + toggle off)
- Shared E2E helpers: `e2e/helpers.ts`; `npm run test:ci`

**Still open:**

- Optional visual snapshots for one short score
- Cloud `?song=` E2E
- Range select / copy-paste E2E on tab
- More golden GP import fixtures

**Done when:** A classical or layout regression fails CI before merge.

---

### 2. Classical + layout regression hardening *(in progress — first pass landed)*

**Why:** Toggle/load order (compute VexFlow widths → layout → draw rows) still bites. Tab beat X must stay **block-local** (`measureBeatLayout`), never row-absolute inside a measure.

**Done (Sep 2026):**

- Documented lifecycle + helpers: `classicalNotationLifecycle.ts` (activate / deactivate / ensurePrepared order)
- Adapter + `useClassicalNotation` use that pipeline; draw only registered row surfaces
- Fixture tests: block-local beat X with classical on/off, toggle-off realignment (`layoutFixtures.test.ts`)
- Lifecycle unit tests: compute → sync → version order (`classicalNotationLifecycle.test.ts`)
- E2E: multi-row preserved on toggle, stave below matching tab row, toggle-off cleanup
- Clarified `Helper.getBeatPosX` as block-local; `renderBridge.getPositionInRow` documents fallback

**Still open:**

- Deeper stave↔measure horizontal alignment asserts in E2E (note X vs tab beat X)
- Audit any remaining `getDisplayWidth` hit-test fallbacks when layout is missing

**Done when:** Classical on/off and hard refresh produce matching multi-row tab + aligned staves in E2E.

---

### 3. One event bus (`typedEventBus` only) *(done — first pass)*

**Why:** Dual buses caused desync (“menu didn’t update”, “Vue didn’t redraw”).

**Done (Sep 2026):**

- All production `EventBus.emit/on` call sites migrated to `typedEventBus`
- `menuEventBridge` / `songDataEventBridge` reduced to no-ops (relays removed)
- `assets/js/eventBus.ts` is a deprecated re-export of `typedEventBus` only
- Tests updated to assert typed-bus delivery directly

**Done when:** `EventBus` has no production callers (or is deleted). ✅ (shim only)
---

### 4. Split remaining god modules *(in progress — first pass landed)*

**Why:** Mutations, undo, playback scheduling, and audio still concentrate risk.

| Module | Focus | Status |
|--------|--------|--------|
| `revertHandler.ts` | Typed undo snapshots / command replay | ✅ Stack + `revertCommandHandlers.ts` extracted; facade keeps push/dispatch |
| `tab.ts` | Keep as thin facade; push leftovers into `services/editor/*` | ✅ Measure structure → `measureStructureCommands.ts` (add/remove block, track init) |
| `audioEngine.ts` | Load / graph / effects boundaries | ✅ Modulation → `audioModulation.ts` (bend/trill/vibrato/distortion/mixer gains) |
| `playBackLogicNew.ts` | Scheduler vs transport (loop already partially extracted) | Still open — extract on next playback touch |

**Done (Sep 2026):**

- `services/editor/revertCommandHandlers.ts` — static undo/redo replay handlers
- `services/editor/audioModulation.ts` — pure pitch/gain modulation + effect-gain mapping
- `services/editor/measureStructureCommands.ts` — measure/track structure mutations
- Unit coverage: `tests/revertCommandHandlers.test.ts`, `audioModulation.test.ts`, `measureStructureCommands.test.ts`

**Done when:** New features rarely need edits in more than one of these files for a single concern.

---

### 5. Finish Vue migration + launch polish *(complete for current scope)*

**Why:** Remaining imperative DOM is a bug class unit tests miss; public release needs clearer failures.

**Done (Sep 2026):**

- Chord Manager / Tremolo / Bend → Vue SVG grids; modal `createElementNS` cleared
- User-facing banners for GP import, SF2 load, audio resume
- Export: `tabExportSvg.ts` composites tab + classical; PDF downloads printable pages **and** vector `guitartab.svg`
- Typed seams: `revertHandler` / bend handler `any` → `unknown` / explicit shapes; Note index sig → `unknown`
- ESLint now covers critical modal handlers + `revertHandler.ts` (negated from `assets/**` ignore)

**Still open (incremental):**

- True vector PDF page streams (today: vector SVG companion + raster PDF pages)
- Broader `any` cleanup across remaining `assets/js`

**Done when:** No modal uses `createElementNS` for editor UI; failed audio/import shows a banner, not only `console`. ✅

---

## Explicitly deferred (track, don’t start yet)

- Full rewrite of GP readers
- PWA / offline
- Auth model for cloud songs
- Server-side PDF

---

## Suggested order (next 4–6 weeks)

1. **#1** CI + test harness + 3–4 high-value E2E/layout fixtures  
2. **#2** classical/layout fixtures locked to that harness  
3. **#3** event-bus consolidation (parallel-friendly)  
4. **#4** / **#5** as capacity allows (extract on touch; migrate one modal at a time)

---

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, completed Steps 1–9, strengths/problems
- [../DEPLOYMENT.md](../DEPLOYMENT.md) — static hosting
- [../server/README.md](../server/README.md) — cloud API
