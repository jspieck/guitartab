import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// ESLint enforces this for services/, stores/, utils/ and types/ (no-restricted-imports in
// eslint.config.mjs); the legacy core in src/assets/js isn't linted, so it is checked here.
const LOWER_LAYERS = ['src/assets/js', 'src/services', 'src/stores', 'src/utils', 'src/types']
const VUE_LAYER = /from\s+['"][^'"]*\/(components|composables)\/|from\s+['"][^'"]+\.vue['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

describe('layering', () => {
  it('the legacy core, services, stores and utils import no components or composables', () => {
    const offenders = LOWER_LAYERS.flatMap((dir) => sourceFiles(dir)).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => VUE_LAYER.test(line) && !/^\s*import\s+type\b/.test(line))
        .map((line) => `${relative('.', file)}: ${line.trim()}`),
    )
    expect(offenders).toEqual([])
  })
})
