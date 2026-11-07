import type { Beat, Note } from '../stores/song'
import type { GpifSong } from '../services/gpifImport'
import {
  assembleSong,
  b,
  BASS,
  CRASH,
  d,
  diagramOf,
  type DrumHit,
  g,
  GUITAR,
  HAT,
  KICK,
  type NoteSpec,
  plainBars,
  type Shape,
  SNARE,
  TOM_HIGH,
  TOM_LOW,
  track,
} from './songBuilder'

/**
 * "Back Porch Shuffle": an example song written for GuitarTab (no third-party music).
 * One chorus of a 12-bar blues in A, shuffled, plus an ending bar; 96 BPM.
 *
 *   | A7 | A7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7 | A7 |
 *
 * Rhythm guitar plays the boogie pattern (5th and 6th over the root), the lead answers
 * with A minor pentatonic licks, the organ comes in at the IV chord, the bass walks.
 * The shuffle is written as triplets: a long (quarter triplet) and a short (eighth triplet)
 * note per beat.
 */

const CHORDS = ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'] as const
type ChordName = (typeof CHORDS)[number]

const OPEN_SHAPES: Record<ChordName, Shape> = {
  A7: { 1: 0, 2: 2, 3: 0, 4: 2, 5: 0 },
  D7: { 2: 0, 3: 2, 4: 1, 5: 2 },
  E7: { 0: 0, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0 },
}
const diagram = (name: ChordName) => diagramOf(name, OPEN_SHAPES[name])

/** One shuffled beat: the same notes long, then short. */
function shuffle(make: (duration: 'q' | 'e', extra: Partial<Beat>) => Beat, first: Partial<Beat> = {}) {
  return [make('q', { tuplet: 3, ...first }), make('e', { tuplet: 3 })]
}

// ---------------------------------------------------------------------------
// Rhythm guitar: root with 5th, 6th, 5th, 6th (string of the root, string above)

const BOOGIE: Record<ChordName, number> = { A7: 1, D7: 2, E7: 0 }

function boogieBar(name: ChordName, first: Partial<Beat> = {}): Beat[] {
  const root = BOOGIE[name]
  const pm: Partial<Note> = { palmMute: true }
  return [2, 4, 2, 4].flatMap((top, i) =>
    shuffle(
      (duration, extra) =>
        g(
          duration,
          [
            [root, 0, pm],
            [root + 1, top, pm],
          ],
          extra,
        ),
      i === 0 ? { chord: diagram(name), ...first } : {},
    ),
  )
}

const rhythm: Beat[][] = [
  ...CHORDS.map((name, i) => {
    const changed = i === 0 || CHORDS[i - 1] !== name
    const first: Partial<Beat> =
      i === 0 ? { text: 'boogie, palm muted', dynamic: 'mf', dynamicPresent: true } : {}
    const bar = boogieBar(name, first)
    if (!changed) delete bar[0].chord
    return bar
  }),
  [
    g(
      'w',
      Object.entries(OPEN_SHAPES.A7).map(([string, fret]) => [Number(string), fret, { letRing: true }]),
      {
        chord: diagram('A7'),
      },
    ),
  ],
]

// ---------------------------------------------------------------------------
// Lead guitar (overdrive): A minor pentatonic at the 5th fret

const bend = (value: number) => ({
  bendObj: [
    { bendPosition: 0, bendValue: 0, vibrato: 0 },
    { bendPosition: 20, bendValue: value, vibrato: 0 },
    { bendPosition: 60, bendValue: value, vibrato: 0 },
  ],
})
const vib = { vibrato: true }
const t3 = (notes: NoteSpec[], extra: Partial<Beat> = {}) => g('e', notes, { tuplet: 3, ...extra })

const lead: Beat[][] = [
  [g('w')],
  [g('w')],
  [
    t3([[5, 8]], { dynamic: 'f', dynamicPresent: true, text: 'answer the rhythm' }),
    t3([[5, 5]]),
    t3([[4, 8]]),
    t3([[4, 5]]),
    t3([[3, 7]]),
    t3([[3, 5]]),
    g('h', [[3, 7, { ...bend(100), ...vib }]], { text: 'full bend' }),
  ],
  [g('q', [[3, 7]]), t3([[3, 5]]), t3([[2, 7]]), t3([[2, 5]]), g('h', [[2, 7, vib]])],
  [g('w')],
  [g('w')],
  [
    g('q', [[3, 7, { slide: true }]], { text: 'slide' }),
    t3([[3, 9]]),
    t3([[4, 8]]),
    t3([[4, 5]]),
    g('h', [[5, 5, vib]]),
  ],
  [g('q', [[5, 8, bend(50)]], { text: 'half bend' }), g('q', [[5, 5]]), g('h', [[4, 5, vib]])],
  [t3([[5, 5]]), t3([[4, 8]]), t3([[4, 5]]), t3([[3, 7]]), t3([[3, 5]]), t3([[2, 7]]), g('h', [[3, 9, vib]])],
  [g('w', [[4, 7, { ...vib, letRing: true }]])],
  [
    t3([[5, 5]], { text: 'turnaround' }),
    t3([[4, 8]]),
    t3([[4, 5]]),
    t3([[3, 7]]),
    t3([[3, 5]]),
    t3([[2, 7]]),
    t3([[2, 5]]),
    t3([[1, 7]]),
    t3([[1, 5]]),
    g('q', [[1, 4]]),
  ],
  [g('h', [[2, 6, vib]]), g('h')],
  [
    g('w', [
      [2, 7, { ...vib, letRing: true }],
      [4, 5, { letRing: true }],
    ]),
  ],
]

// ---------------------------------------------------------------------------
// Organ: sustained 7th chords from the IV chord on

const VOICINGS: Record<ChordName, NoteSpec[]> = {
  A7: [
    [2, 7],
    [3, 6],
    [4, 5],
    [5, 3],
  ],
  D7: [
    [2, 10],
    [3, 7],
    [4, 7],
    [5, 5],
  ],
  E7: [
    [2, 6],
    [3, 7],
    [4, 5],
    [5, 7],
  ],
}

const organ: Beat[][] = [
  ...CHORDS.map((name, i) =>
    i < 4
      ? [g('w')]
      : [
          g(
            'w',
            VOICINGS[name],
            i === 4 ? { text: 'organ enters', dynamic: 'mp', dynamicPresent: true } : {},
          ),
        ],
  ),
  [g('w', VOICINGS.A7)],
]

// ---------------------------------------------------------------------------
// Bass: walking quarters up and down the chord (root, 3rd, 5th, 6th / b7, 6th, 5th, 3rd)

const WALK: Record<ChordName, [NoteSpec[], NoteSpec[]]> = {
  A7: [
    [
      [1, 0],
      [1, 4],
      [2, 2],
      [2, 4],
    ],
    [
      [2, 5],
      [2, 4],
      [2, 2],
      [1, 4],
    ],
  ],
  D7: [
    [
      [2, 0],
      [2, 4],
      [3, 2],
      [3, 4],
    ],
    [
      [3, 5],
      [3, 4],
      [3, 2],
      [2, 4],
    ],
  ],
  E7: [
    [
      [0, 0],
      [0, 4],
      [1, 2],
      [1, 4],
    ],
    [
      [1, 5],
      [1, 4],
      [1, 2],
      [0, 4],
    ],
  ],
}

/** How many bars of the same chord come before bar `i`. */
function barsIntoChord(i: number): number {
  let count = 0
  while (i - count - 1 >= 0 && CHORDS[i - count - 1] === CHORDS[i]) count += 1
  return count
}

// Up through a chord's odd bars, back down through its even ones.
const bass: Beat[][] = [
  ...CHORDS.map((name, i) => WALK[name][barsIntoChord(i) % 2].map((note) => b('q', [note]))),
  [b('w', [[1, 0, { letRing: true }]])],
]

// ---------------------------------------------------------------------------
// Drums: shuffled hi-hat, kick on 1 and 3, snare on 2 and 4

const accentCrash: DrumHit = [CRASH, { accentuated: true }]

function shuffleBar({ crash = false } = {}): Beat[] {
  return [0, 1, 2, 3].flatMap((beatIndex) => {
    const long: DrumHit[] = [beatIndex === 0 && crash ? accentCrash : HAT]
    long.push(beatIndex % 2 === 0 ? KICK : SNARE)
    const short: DrumHit[] = [HAT, ...(beatIndex === 3 ? [KICK] : [])]
    return [d('q', long, { tuplet: 3 }), d('e', short, { tuplet: 3 })]
  })
}

const fill: Beat[] = [
  ...shuffleBar().slice(0, 4),
  ...[SNARE, SNARE, TOM_HIGH, TOM_HIGH, TOM_LOW, TOM_LOW].map((drum, i) =>
    d('e', [drum, ...(i === 5 ? [KICK] : [])], { tuplet: 3, ...(i === 0 ? { text: 'fill' } : {}) }),
  ),
]

const drums: Beat[][] = [
  shuffleBar({ crash: true }),
  ...CHORDS.slice(1, -1).map((_, i) => shuffleBar({ crash: i === 3 })),
  fill,
  [d('q', [accentCrash, KICK]), d('h'), d('q')],
]

// ---------------------------------------------------------------------------

function bars() {
  return plainBars(CHORDS.length + 1, (meta, i) => {
    if (i === 0) {
      meta.bpm = 96
      meta.marker = { text: 'Shuffle', color: { red: 200, green: 120, blue: 30 } }
    }
    if (i === 10) meta.marker = { text: 'Turnaround', color: { red: 40, green: 120, blue: 200 } }
    if (i === CHORDS.length) meta.marker = { text: 'Ending', color: { red: 90, green: 90, blue: 90 } }
  })
}

/** The shuffle as song data, ready for `applyGpifSong`. */
export function buildShuffle(): GpifSong {
  const tracks = [
    track('Rhythm Guitar', GUITAR, 27, 0, { red: 60, green: 140, blue: 90 }),
    track('Lead Guitar', GUITAR, 29, 1, { red: 220, green: 60, blue: 60 }),
    track('Organ', GUITAR, 16, 2, { red: 150, green: 90, blue: 190 }),
    track('Bass', BASS, 33, 3, { red: 70, green: 90, blue: 200 }),
    track('Drums', new Array(6).fill(0), 0, 9, { red: 120, green: 120, blue: 120 }),
  ]
  return assembleSong(
    {
      title: 'Back Porch Shuffle',
      subtitle: '12-bar blues in A',
      artist: 'GuitarTab',
      author: 'GuitarTab',
      music: 'GuitarTab',
      instructions: 'Switch tracks in the sequencer at the bottom; mute one and play it yourself.',
    },
    96,
    bars(),
    tracks,
    [rhythm, lead, organ, bass, drums],
  )
}
