import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { latestChangelogTitle } from '../src/utils/changelog'
import { SITE_PAGES } from './pages'
import { indexHeadTags, normalizeSiteUrl, renderSitePage, robotsTxt, sitemapXml } from './sitePages'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

/** Where index.html wants the tags that need the public address. */
const HEAD_MARKER = '<!-- site:head -->'

/**
 * The static site around the app (Big win 34). In the build it writes the pages of
 * `site/pages.ts`, robots.txt and (with `SITE_URL`) sitemap.xml next to index.html; the dev
 * server serves the same from memory. It also tells the app the newest CHANGELOG.md entry
 * (`__CHANGELOG_LATEST__`), so the startup check needn't load the changelog.
 */
export function sitePlugin(siteUrlSetting = process.env.SITE_URL): Plugin {
  const siteUrl = normalizeSiteUrl(siteUrlSetting)

  const files = (): Map<string, string> => {
    const out = new Map<string, string>()
    for (const page of SITE_PAGES) {
      out.set(`${page.slug}.html`, renderSitePage(page, read(`./pages/${page.slug}.html`), siteUrl))
    }
    out.set('robots.txt', robotsTxt(siteUrl))
    if (siteUrl) out.set('sitemap.xml', sitemapXml(siteUrl, new Date().toISOString().slice(0, 10)))
    return out
  }

  return {
    name: 'serenetab-site',
    config() {
      return {
        define: { __CHANGELOG_LATEST__: JSON.stringify(latestChangelogTitle(read('../CHANGELOG.md')) ?? '') },
      }
    },
    transformIndexHtml(html) {
      if (!html.includes(HEAD_MARKER)) throw new Error(`index.html lost its ${HEAD_MARKER} marker`)
      return html.replace(HEAD_MARKER, indexHeadTags(siteUrl))
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].replace(/^\//, '') ?? ''
        if (!/^[\w-]+\.(html|txt|xml)$/.test(name) || name === 'index.html') return next()
        const body = files().get(name)
        if (body == null) return next()
        const type = name.endsWith('.html')
          ? 'text/html'
          : name.endsWith('.xml')
            ? 'application/xml'
            : 'text/plain'
        res.setHeader('Content-Type', `${type}; charset=utf-8`)
        res.end(body)
      })
    },
    generateBundle() {
      for (const [fileName, source] of files()) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}
