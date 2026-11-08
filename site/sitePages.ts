import {
  displayKeys,
  groupShortcuts,
  SHORTCUTS,
  type ShortcutDefinition,
} from '../src/utils/keyboardShortcuts'
import { SITE_PAGES, type SitePage } from './pages'

/**
 * Builds the static site around the app (Big win 34): the help and search pages, robots.txt,
 * sitemap.xml and the absolute-URL tags of index.html. Pure string functions, so the Vite
 * plugin (`vitePlugin.ts`) and the unit tests (`tests/sitePages.test.ts`) share them.
 *
 * `siteUrl` is the public address (`SITE_URL` at build time, e.g. `https://serenetab.example`).
 * Without it the build still works, but leaves out what needs an absolute URL: the canonical
 * link, `og:url`, the sitemap and its line in robots.txt.
 */

export const SITE_NAME = 'SereneTab'
export const OG_IMAGE = 'og-image.png'
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const

/** `https://example.org/` → `https://example.org` (one form, so paths join with one slash). */
export function normalizeSiteUrl(siteUrl: string | undefined): string | null {
  const trimmed = siteUrl?.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (!/^https?:\/\/[^/\s]+/.test(trimmed))
    throw new Error(`SITE_URL must be an http(s) URL, got "${siteUrl}"`)
  return trimmed
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function absolute(siteUrl: string, path: string): string {
  return path === '' ? `${siteUrl}/` : `${siteUrl}/${path}`
}

/** Tags for index.html that need the public address (canonical, og:url, absolute og:image). */
export function indexHeadTags(siteUrl: string | null): string {
  const image = siteUrl ? absolute(siteUrl, OG_IMAGE) : `/${OG_IMAGE}`
  const tags = [
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_SIZE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_SIZE.height}" />`,
    `<meta property="og:image:alt" content="The SereneTab editor showing a four-track song as tab and notation" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]
  if (siteUrl) {
    tags.unshift(
      `<link rel="canonical" href="${absolute(siteUrl, '')}" />`,
      `<meta property="og:url" content="${absolute(siteUrl, '')}" />`,
    )
  }
  return tags.join('\n    ')
}

/** One `<kbd>` per key; Mod reads "Ctrl/⌘" because the page is the same for every platform. */
function keysHtml(keys: string[]): string {
  const pc = displayKeys(keys, false)
  return pc.map((key) => `<kbd>${escapeHtml(key === 'Ctrl' ? 'Ctrl/⌘' : key)}</kbd>`).join('+')
}

/** The shortcut list of the getting-started page, from the same table as the in-app Help sheet. */
export function shortcutTableHtml(shortcuts: readonly ShortcutDefinition[] = SHORTCUTS): string {
  return groupShortcuts(shortcuts)
    .map(({ name, items }) => {
      const rows = items
        .map(
          (item) =>
            `<tr><td class="keys">${item.keys.map(keysHtml).join(' or ')}</td><td>${escapeHtml(item.description)}</td></tr>`,
        )
        .join('\n')
      return `<h3>${escapeHtml(name)}</h3>\n<table class="shortcuts">\n<tbody>\n${rows}\n</tbody>\n</table>`
    })
    .join('\n')
}

const SHORTCUTS_MARKER = '<!-- shortcuts -->'

function footerHtml(current: string | null): string {
  const pageLinks = SITE_PAGES.filter((page) => page.indexed)
    .map((page) =>
      page.slug === current
        ? `<a href="${page.slug}.html" aria-current="page">${escapeHtml(page.navLabel)}</a>`
        : `<a href="${page.slug}.html">${escapeHtml(page.navLabel)}</a>`,
    )
    .join('\n        ')
  return `<footer class="site-footer">
      <nav aria-label="More about SereneTab">
        ${pageLinks}
      </nav>
      <p>
        <a href="impressum.html">Impressum</a>
        <a href="datenschutz.html">Datenschutz</a>
        <a href="https://github.com/jspieck/guitartab">Source code (MIT)</a>
      </p>
    </footer>`
}

/** A whole page: shared head, header with the way into the app, the page body, footer. */
export function renderSitePage(page: SitePage, body: string, siteUrl: string | null): string {
  if (page.slug === 'getting-started' && !body.includes(SHORTCUTS_MARKER)) {
    throw new Error('getting-started.html lost its <!-- shortcuts --> marker')
  }
  const content = body.replace(SHORTCUTS_MARKER, shortcutTableHtml())
  const url = siteUrl ? absolute(siteUrl, `${page.slug}.html`) : null
  const image = siteUrl ? absolute(siteUrl, OG_IMAGE) : OG_IMAGE
  const title = `${page.title} – ${SITE_NAME}`
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    ${url ? `<link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />` : ''}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#2558c8" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="stylesheet" href="legal.css" />
  </head>
  <body class="site-page">
    <header class="site-header">
      <a class="site-brand" href="./"><img src="favicon.svg" alt="" width="28" height="28" />${SITE_NAME}</a>
      <a class="site-button" href="./">Open the editor</a>
    </header>
    <main>
${content.trim()}
    </main>
    ${footerHtml(page.slug)}
  </body>
</html>
`
}

export function robotsTxt(siteUrl: string | null): string {
  // /assets/ stays open: search engines run the app's scripts to render the page.
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /audio/']
  if (siteUrl) lines.push('', `Sitemap: ${absolute(siteUrl, 'sitemap.xml')}`)
  return `${lines.join('\n')}\n`
}

/** The start page and the indexed static pages (the legal pages are `noindex`). */
export function sitemapXml(siteUrl: string, lastModified: string): string {
  const paths = ['', ...SITE_PAGES.filter((page) => page.indexed).map((page) => `${page.slug}.html`)]
  const urls = paths
    .map((path) => `  <url><loc>${absolute(siteUrl, path)}</loc><lastmod>${lastModified}</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
