/**
 * The static pages built with the site (Big win 34): plain HTML outside the app, for people
 * who search ("open gp5 online") and for help. Each page's body is `site/pages/<slug>.html`;
 * `sitePages.ts` wraps it in the shared layout and writes it next to `index.html`.
 */
export interface SitePage {
  /** File name without `.html`; also the URL path. */
  slug: string
  title: string
  description: string
  /** Listed in sitemap.xml and the footer links. */
  indexed: boolean
  /** Short label for the footer and the intro in index.html. */
  navLabel: string
}

export const SITE_PAGES: readonly SitePage[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    description:
      'How to enter notes, play, open Guitar Pro files and practise with SereneTab, plus every keyboard shortcut.',
    indexed: true,
    navLabel: 'Getting started',
  },
  {
    slug: 'open-guitar-pro-files',
    title: 'Open Guitar Pro files in the browser',
    description:
      'Open .gp, .gpx, .gp5, .gp4 and .gp3 files online without installing anything: see the tab and notation, play it back, edit it and save it again.',
    indexed: true,
    navLabel: 'Open Guitar Pro files',
  },
  {
    slug: 'guitar-tab-editor-for-phones',
    title: 'A guitar tab editor for your phone',
    description:
      'Read, play and write guitar tabs on a phone: a touch fret pad, pinch to zoom, swipe between beats, and files that stay on your device.',
    indexed: true,
    navLabel: 'Tabs on your phone',
  },
  {
    slug: 'practice-with-loops',
    title: 'Practise guitar with loops and a speed trainer',
    description:
      'Loop a passage, slow it down and let the speed trainer bring it up to tempo, with a count-in, metronome and tuner in the browser.',
    indexed: true,
    navLabel: 'Practise with loops',
  },
  {
    slug: 'privacy',
    title: 'Privacy in short',
    description:
      'SereneTab runs in your browser: no account, no cookies, no tracking, and your files stay on your device.',
    indexed: true,
    navLabel: 'Privacy',
  },
]
