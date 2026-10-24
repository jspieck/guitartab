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
  // editor, playback and audio, dialog handlers, importers (vite.config.ts EDITOR_CORE_PATHS)
  'editor-core-': 280,
  'notation-': 1100,
  'shortcuts-': 4,
  // AppIcon + the generated icon map (scripts/build-icons.mjs)
  'icons-': 40,
  'toolbar-': 32,
  'demoArrangement-': 10,
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
  process.exit(1)
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

console.log(`Bundle budgets passed for ${assets.length} JS assets.`)
