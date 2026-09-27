#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets')

const BUDGETS_KB = {
  'index-': 40,
  'framework-': 12,
  'vendor-': 90,
  'tab-renderer-': 60,
  'studio-ui-': 45,
  'modal-handlers-': 70,
  'audio-engine-': 250,
  'notation-': 1100,
  'pdf-export-': 500,
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

console.log(`Bundle budgets passed for ${assets.length} JS assets.`)
