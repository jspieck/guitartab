import type { Clef } from '../utils/clefs'

/**
 * The example songs offered in "Example songs" (File menu, phone menu, first-run card).
 * The two band songs are written in code for GuitarTab (`demoArrangement.ts`,
 * `exampleShuffle.ts`); the others are each a MIDI file in `public/examples/` from the Mutopia
 * Project (public domain or Creative Commons), converted to tab by the MIDI importer when
 * opened. Credits and licences are listed here, shown in the dialog and written into the
 * song info; `public/examples/CREDITS.md` repeats them for the files themselves.
 */

export interface ExampleCredit {
  /** Who typeset (and, if any, arranged) the edition the file comes from. */
  by: string
  license: string
  licenseUrl: string
  /** The piece's page at the source. */
  sourceUrl: string
}

export interface ExampleTrack {
  name: string
  /** General MIDI program, 0-based (24 = nylon-string guitar). */
  program: number
  /** Open-string pitches, lowest first, for instruments that aren't a guitar (default: guitar or bass). */
  strings?: number[]
  /** Staff clef for the whole track (default: by string count). */
  clef?: Clef
}

/** The dialog's sections. */
export type ExampleKind = 'band' | 'ensemble' | 'solo'

export const EXAMPLE_KINDS: { kind: ExampleKind; label: string }[] = [
  { kind: 'band', label: 'Band' },
  { kind: 'ensemble', label: 'Duos and ensembles' },
  { kind: 'solo', label: 'Solo guitar' },
]

export interface ExampleSong {
  id: string
  kind: ExampleKind
  title: string
  composer: string
  /** One line on what you hear. */
  description: string
  /** File in `public/examples/`; or, for songs written in code, which one to build. */
  file?: string
  build?: 'open-road' | 'shuffle'
  /** Which of the file's tracks to keep (indexes in import order), and how to name and voice them. */
  tracks?: { index: number; track: ExampleTrack }[]
  /** Semitones; for editions typeset in plain treble clef, which sound an octave above a guitar. */
  transpose?: number
  credit?: ExampleCredit
}

const MUTOPIA = 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id='
const PUBLIC_DOMAIN = {
  license: 'Public domain',
  licenseUrl: 'https://www.mutopiaproject.org/legal.html',
}
const GUITAR: ExampleTrack = { name: 'Guitar', program: 24 }

export const EXAMPLE_SONGS: readonly ExampleSong[] = [
  {
    id: 'open-road',
    kind: 'band',
    title: 'Open Road',
    composer: 'GuitarTab demo',
    description: 'Guitars, bass and drums; shows bends, slides, harmonics, tapping and more.',
    build: 'open-road',
  },
  {
    id: 'back-porch-shuffle',
    kind: 'band',
    title: 'Back Porch Shuffle',
    composer: 'GuitarTab',
    description: 'A 12-bar blues: boogie rhythm guitar, lead licks, organ, walking bass, shuffle drums.',
    build: 'shuffle',
  },
  {
    id: 'eine-kleine-nachtmusik',
    kind: 'ensemble',
    title: 'Eine kleine Nachtmusik, 1st movement',
    composer: 'Wolfgang Amadeus Mozart',
    description: 'String quartet: two violins, viola and cello, each on its own strings.',
    file: 'eine-kleine-nachtmusik.mid',
    tracks: [
      { index: 0, track: { name: 'Violin I', program: 40, strings: [55, 62, 69, 76], clef: 'treble' } },
      { index: 1, track: { name: 'Violin II', program: 40, strings: [55, 62, 69, 76], clef: 'treble' } },
      { index: 2, track: { name: 'Viola', program: 41, strings: [48, 55, 62, 69], clef: 'alto' } },
      { index: 3, track: { name: 'Cello', program: 42, strings: [36, 43, 50, 57], clef: 'bass' } },
    ],
    credit: { by: 'an anonymous contributor', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}900` },
  },
  {
    id: 'fur-elise-duo',
    kind: 'ensemble',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    description: 'The piano piece arranged for two guitars: melody and accompaniment.',
    file: 'fur-elise-duo.mid',
    tracks: [
      { index: 0, track: { name: 'Guitar 1', program: 24 } },
      { index: 1, track: { name: 'Guitar 2', program: 24 } },
    ],
    credit: { by: 'Jeffrey Olson (arrangement)', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}2059` },
  },
  {
    id: 'bach-air',
    kind: 'ensemble',
    title: 'Air on the G String, BWV 1068',
    composer: 'J. S. Bach',
    description: 'Flute melody over a walking guitar accompaniment.',
    file: 'bach-air.mid',
    tracks: [
      { index: 0, track: { name: 'Flute', program: 73 } },
      { index: 1, track: GUITAR },
    ],
    credit: { by: 'Mike Blackstock', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}1534` },
  },
  {
    id: 'spanish-romance',
    kind: 'solo',
    title: 'Spanish Romance',
    composer: 'Anonymous',
    description: 'Triplet arpeggios over a melody on the high string.',
    file: 'spanish-romance.mid',
    tracks: [{ index: 0, track: GUITAR }],
    credit: {
      by: 'Jeff Covey',
      license: 'CC BY-SA 2.5',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/',
      sourceUrl: `${MUTOPIA}795`,
    },
  },
  {
    id: 'minuet-in-g',
    kind: 'solo',
    title: 'Minuet in G, BWV Anh. 114',
    composer: 'Christian Petzold (long attributed to J. S. Bach)',
    description: 'A first classical piece: melody over a simple bass line.',
    file: 'minuet-in-g.mid',
    // The edition has a staff and a tab staff; the tab one sounds in the guitar's octave.
    tracks: [{ index: 1, track: GUITAR }],
    credit: { by: 'Yannick Kirschhoffer', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}695` },
  },
  {
    id: 'bach-prelude-bwv999',
    kind: 'solo',
    title: 'Prelude in D minor, BWV 999',
    composer: 'J. S. Bach',
    description: 'Sixteenth-note arpeggios over held bass notes.',
    file: 'bach-prelude-bwv999.mid',
    tracks: [{ index: 0, track: GUITAR }],
    credit: { by: 'Jakob Bagterp', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}60` },
  },
  {
    id: 'carcassi-etude-7',
    kind: 'solo',
    title: 'Étude Op. 60 No. 7',
    composer: 'Matteo Carcassi',
    description: 'A study in fast arpeggios across all strings.',
    file: 'carcassi-etude-7.mid',
    tracks: [{ index: 0, track: GUITAR }],
    credit: { by: 'Jeff Covey', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}300` },
  },
  {
    id: 'faure-sicilienne',
    kind: 'solo',
    title: 'Sicilienne, Op. 78',
    composer: 'Gabriel Fauré',
    description: 'A gentle 6/8 melody, transcribed for solo guitar.',
    file: 'faure-sicilienne.mid',
    tracks: [{ index: 0, track: GUITAR }],
    credit: {
      by: 'Ludovic Alexandre Morin (transcription), Olivier Flatrs, Federico Bruni',
      ...PUBLIC_DOMAIN,
      sourceUrl: `${MUTOPIA}636`,
    },
  },
  {
    id: 'galilei-saltarello',
    kind: 'solo',
    title: 'Saltarello',
    composer: 'Vincenzo Galilei',
    description: 'A lively Renaissance dance, originally for lute.',
    file: 'galilei-saltarello.mid',
    tracks: [{ index: 0, track: GUITAR }],
    credit: { by: 'Emre Akbas, Federico Bruni', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}110` },
  },
  {
    id: 'brahms-lullaby',
    kind: 'ensemble',
    title: 'Lullaby (Wiegenlied)',
    composer: 'Johannes Brahms',
    description: 'A duet: recorder melody with guitar accompaniment.',
    file: 'brahms-lullaby.mid',
    tracks: [
      { index: 0, track: { name: 'Recorder', program: 74 } },
      { index: 1, track: GUITAR },
    ],
    credit: { by: 'Diego F. Guillen (arrangement)', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}481` },
  },
  {
    id: 'silent-night',
    kind: 'solo',
    title: 'Silent Night (Stille Nacht)',
    composer: 'Franz Xaver Gruber',
    description: 'The carol arranged for solo guitar, melody with chords.',
    file: 'silent-night.mid',
    tracks: [{ index: 0, track: GUITAR }],
    transpose: -12,
    credit: {
      by: 'Daniel Widyanto (arrangement)',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl: `${MUTOPIA}521`,
    },
  },
  {
    id: 'last-rose-of-summer',
    kind: 'solo',
    title: 'The Last Rose of Summer',
    composer: 'Felix Horetzky',
    description: 'An Irish air set for guitar, short and slow.',
    file: 'last-rose-of-summer.mid',
    tracks: [{ index: 0, track: GUITAR }],
    transpose: -12,
    credit: { by: 'Stan Sanderson', ...PUBLIC_DOMAIN, sourceUrl: `${MUTOPIA}1093` },
  },
]

/** The credit as one line, for the song info and the dialog. */
export function creditLine(credit: ExampleCredit): string {
  return `Typeset by ${credit.by} for the Mutopia Project (${credit.sourceUrl}). ${credit.license}; converted to tablature by GuitarTab.`
}
