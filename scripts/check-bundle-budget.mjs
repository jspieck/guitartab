#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets')

const BUDGETS_KB = {
  'index-': 16,
  'framework-': 12,
  'vendor-': 90,
  'tab-renderer-': 60,
  'studio-ui-': 45,
  'studio-panels-': 40,
  // editor, playback and audio, dialog handlers, importers (vite.config.ts EDITOR_CORE_PATHS);
  // 284 KB with the play order, navigation signs and SoundFont loading state of audit Big win 5;
  // 294 KB with the SoundFont engine (envelopes, filters, LFOs, stereo voices, sends, SF3);
  // 302.5 KB with the amp settings, bus routing and GP tone hints of Big win 21 (the DSP is lazy);
  // 307 KB with clef changes, slash beats, rhythm on stems and multi-bar rests of Big win 24
  // (their file-format parts live in the lazy format chunks); 228 KB after Big win 30 moved
  // the dialog handlers, the Guitar Pro readers and fflate into lazy chunks.
  'editor-core-': 240,
  'notation-': 1100,
  // The shortcut table; the key handler matches every key against it, so it can't be lazy
  // (6.9 KB with the selection, rhythm, voice and transpose keys of audit Big win 8;
  // 8.5 KB with the drum editor's keys)
  'shortcuts-': 10,
  // AppIcon + the generated icon map (scripts/build-icons.mjs)
  'icons-': 40,
  'toolbar-': 32,
  // Rhythm keys, keyboard selection, transpose (vite.config.ts MODULE_CHUNKS)
  'editing-tools-': 8,
  'demoArrangement-': 10,
  // Amp and cabinet simulation (audit Big win 21), loaded when a track's amp is on
  'amp-sim-': 4,
  // The MIDI file reader and the example song list (audit Big win 23), both loaded on use
  'midi-import-': 12,
  'example-songs-': 10,
  // Dialog handlers, the Guitar Pro readers and fflate (audit Big win 30), all loaded on use
  'dialog-handlers-': 24,
  'gp-import-': 34,
  'zip-': 8,
  // The dialog shell; each dialog is its own chunk now
  'ModalsContainer-': 20,
}

function listJsAssets(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({
      name,
      bytes: statSync(join(dir, name)).size,
    }))
}

function findBudgetPrefix(fileName) {
  return Object.keys(BUDGETS_KB).find((prefix) => fileName.startsWith(prefix))
}

const assets = listJsAssets(DIST_ASSETS)
const violations = []

for (const asset of assets) {
  const prefix = findBudgetPrefix(asset.name)
  if (!prefix) {
    continue
  }

  const limitBytes = BUDGETS_KB[prefix] * 1024
  if (asset.bytes > limitBytes) {
    violations.push({
      file: asset.name,
      sizeKb: Math.round(asset.bytes / 1024),
      limitKb: BUDGETS_KB[prefix],
    })
  }
}

if (violations.length > 0) {
  console.error('Bundle budget violations:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.sizeKb} KB (limit ${violation.limitKb} KB)`)
  }
  // Keep going: a chunk cycle (below) crashes the app and must not hide behind a size overrun.
  process.exitCode = 1
}

// Two chunks that import each other statically run in an order where one reads the other's
// bindings before they exist ("Cannot access 'x' before initialization" at startup).
function findChunkCycles(fileNames) {
  const imports = new Map(
    fileNames.map((name) => {
      const code = readFileSync(join(DIST_ASSETS, name), 'utf8')
      const targets = [...code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)].map(
        (match) => match[1],
      )
      return [name, new Set(targets)]
    }),
  )
  const cycles = []
  const done = new Set()
  const stack = []
  const visit = (name) => {
    const index = stack.indexOf(name)
    if (index >= 0) {
      cycles.push([...stack.slice(index), name].join(' -> '))
      return
    }
    if (done.has(name)) return
    stack.push(name)
    for (const target of imports.get(name) ?? []) visit(target)
    stack.pop()
    done.add(name)
  }
  for (const name of imports.keys()) visit(name)
  return cycles
}

const cycles = findChunkCycles(assets.map((asset) => asset.name))
if (cycles.length > 0) {
  console.error('Chunks that import each other (see manualChunks in vite.config.ts):')
  for (const cycle of cycles) console.error(`- ${cycle}`)
  process.exit(1)
}

// What every visit downloads before the app runs: the entry and the chunks it imports
// statically (transitively). 525 KB after audit Big win 11 (was 676 KB: interactjs, the colour
// picker and the editing tools were in it; the dialogs and studio panels followed during mount).
// 472 KB after Big win 30 (dialog handlers and the Guitar Pro readers became lazy).
const STARTUP_BUDGET_KB = 500
// Chunks that must be loaded on demand; a static import from startup code pulls them in.
const LAZY_CHUNKS = [
  'ModalsContainer-',
  'studio-panels-',
  'dialog-handlers-',
  'dialog-shell-',
  'gp-import-',
  'zip-',
  'color-picker-',
  'editing-tools-',
  'amp-sim-',
  'tuner-',
  'print-',
  'notation-',
  'classicalNotation-',
  'songExport-',
  'musicXmlImport-',
  'midi-import-',
  'example-songs-',
  'NoteMenu-',
  'CompactBar-',
]

function startupChunks(fileNames) {
  const entry = fileNames.find((name) => name.startsWith('index-'))
  const seen = new Set()
  const visit = (name) => {
    if (seen.has(name) || !fileNames.includes(name)) return
    seen.add(name)
    const code = readFileSync(join(DIST_ASSETS, name), 'utf8')
    // Static imports only: `import(` (dynamic) doesn't match.
    for (const match of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) visit(match[1])
  }
  visit(entry)
  return [...seen]
}

const startup = startupChunks(assets.map((asset) => asset.name))
const startupBytes = startup.reduce((sum, name) => sum + assets.find((asset) => asset.name === name).bytes, 0)
const eagerLazy = startup.filter((name) => LAZY_CHUNKS.some((prefix) => name.startsWith(prefix)))
if (eagerLazy.length > 0 || startupBytes > STARTUP_BUDGET_KB * 1024) {
  if (eagerLazy.length > 0) console.error(`Lazy chunks loaded at startup: ${eagerLazy.join(', ')}`)
  console.error(
    `Startup JS: ${Math.round(startupBytes / 1024)} KB (limit ${STARTUP_BUDGET_KB} KB) in ${startup.join(', ')}`,
  )
  process.exit(1)
}

if (process.exitCode === 1) process.exit(1)

console.log(
  `Bundle budgets passed for ${assets.length} JS assets; startup JS ${Math.round(startupBytes / 1024)} KB of ${STARTUP_BUDGET_KB} KB in ${startup.length} chunks.`,
)
