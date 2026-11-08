import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SITE_PAGES } from '../site/pages'
import {
  escapeHtml,
  indexHeadTags,
  normalizeSiteUrl,
  renderSitePage,
  robotsTxt,
  shortcutTableHtml,
  sitemapXml,
} from '../site/sitePages'
import { SHORTCUTS } from '../src/utils/keyboardShortcuts'

const body = (slug: string) => readFileSync(`site/pages/${slug}.html`, 'utf8')
const page = (slug: string) => SITE_PAGES.find((entry) => entry.slug === slug)!

describe('static site pages (Big win 34)', () => {
  it('normalizes the site URL and rejects what is not one', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull()
    expect(normalizeSiteUrl('  ')).toBeNull()
    expect(normalizeSiteUrl('https://tabs.example.org/')).toBe('https://tabs.example.org')
    expect(() => normalizeSiteUrl('tabs.example.org')).toThrow(/SITE_URL/)
  })

  it('lists every shortcut on the getting-started page, from the same table as the Help sheet', () => {
    const html = renderSitePage(page('getting-started'), body('getting-started'), null)
    for (const shortcut of SHORTCUTS) expect(html).toContain(escapeHtml(shortcut.description))
    expect(html).not.toContain('<!-- shortcuts -->')
    expect(shortcutTableHtml()).toContain('<kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd>')
  })

  it('fails the build when the shortcut marker is gone', () => {
    expect(() => renderSitePage(page('getting-started'), '<h1>Getting started</h1>', null)).toThrow(/marker/)
  })

  it('renders every page with its title, a way into the app and absolute URLs only when known', () => {
    for (const entry of SITE_PAGES) {
      const withoutUrl = renderSitePage(entry, body(entry.slug), null)
      expect(withoutUrl).toContain(`<title>${escapeHtml(entry.title)} – SereneTab</title>`)
      expect(withoutUrl).toContain('href="./">Open the editor</a>')
      expect(withoutUrl).not.toContain('rel="canonical"')

      const withUrl = renderSitePage(entry, body(entry.slug), 'https://tabs.example.org')
      expect(withUrl).toContain(`<link rel="canonical" href="https://tabs.example.org/${entry.slug}.html" />`)
      expect(withUrl).toContain('content="https://tabs.example.org/og-image.png"')
    }
  })

  it('links only to pages and files that exist', () => {
    const known = new Set([...SITE_PAGES.map((entry) => `${entry.slug}.html`), './'])
    for (const entry of SITE_PAGES) {
      const html = renderSitePage(entry, body(entry.slug), null)
      for (const [, target] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
        if (/^https?:/.test(target) || known.has(target)) continue
        expect(existsSync(`public/${target}`), `${entry.slug}: ${target}`).toBe(true)
      }
    }
  })

  it('points crawlers at the sitemap, which lists the start page and the indexed pages', () => {
    expect(robotsTxt(null)).not.toContain('Sitemap')
    expect(robotsTxt('https://tabs.example.org')).toContain('Sitemap: https://tabs.example.org/sitemap.xml')
    const sitemap = sitemapXml('https://tabs.example.org', '2026-11-07')
    expect(sitemap).toContain('<loc>https://tabs.example.org/</loc>')
    for (const entry of SITE_PAGES.filter((item) => item.indexed)) {
      expect(sitemap).toContain(`<loc>https://tabs.example.org/${entry.slug}.html</loc>`)
    }
    expect(sitemap).not.toContain('impressum')
  })

  it('gives index.html a canonical link and an absolute preview image when the address is known', () => {
    expect(indexHeadTags(null)).not.toContain('canonical')
    expect(indexHeadTags(null)).toContain('content="/og-image.png"')
    const tags = indexHeadTags('https://tabs.example.org')
    expect(tags).toContain('<link rel="canonical" href="https://tabs.example.org/" />')
    expect(tags).toContain('content="https://tabs.example.org/og-image.png"')
  })

  it('keeps index.html readable before the app runs', () => {
    const index = readFileSync('index.html', 'utf8')
    expect(index).toContain('<!-- site:head -->')
    expect(index).toMatch(/<div id="app">\s*<div class="site-intro">/)
    expect(index).toContain('<noscript>')
    const jsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index)![1]
    expect(JSON.parse(jsonLd)).toMatchObject({ '@type': 'SoftwareApplication', isAccessibleForFree: true })
    for (const entry of SITE_PAGES) expect(index).toContain(`href="${entry.slug}.html"`)
  })
})
