import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// ESLint enforces this too (no-restricted-imports in eslint.config.mjs); this test also
// catches it when lint isn't run, and keeps the legacy core folder from coming back.
const LOWER_LAYERS = ['src/services', 'src/stores', 'src/utils', 'src/types', 'src/data']
const VUE_LAYER = /from\s+['"][^'"]*\/(components|composables)\/|from\s+['"][^'"]+\.vue['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

describe('layering', () => {
  it('services, stores, utils, types and data import no components or composables', () => {
    const offenders = LOWER_LAYERS.flatMap((dir) => sourceFiles(dir)).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => VUE_LAYER.test(line) && !/^\s*import\s+type\b/.test(line))
        .map((line) => `${relative('.', file)}: ${line.trim()}`),
    )
    expect(offenders).toEqual([])
  })

  it('has no legacy core left in src/assets/js', () => {
    expect(existsSync('src/assets/js')).toBe(false)
  })
})
