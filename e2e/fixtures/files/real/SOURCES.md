# Real files (audit Big win 23)

Files written by other programs, so the importers are tested against more than our own
writers. `tests/realFiles.test.ts` opens every file in `alphatab/` and `mutopia/` through
`importSongFile` and pins what it opens as (`tests/__snapshots__/realFiles/`, one readable
line per bar and voice). No copyrighted songs: only feature test files and public-domain or
Creative Commons music.

Files are unchanged copies of the originals, renamed only where noted.

## `alphatab/` — alphaTab test files (MPL-2.0)

From [CoderLine/alphaTab](https://github.com/CoderLine/alphaTab), folder
`packages/alphatab/test-data/` (fetched 2026-11-01, branch `main`). Saved by Guitar Pro 3, 4,
5, 6, 7 and 8 and by MusicXML writers; each shows one feature (bends, tuplets, repeats …).
Licensed under the Mozilla Public License 2.0, copyright Daniel Kuschny and contributors; the
licence text is in `LICENSE-alphaTab-MPL-2.0.txt`. Renamed `<folder>-<name>` (for example
`guitarpro5/bends.gp5` → `guitarpro5-bends.gp5`).

Left out on purpose: `guitarpro5/canon.gp5` ("Canon Rock" by JerryC), `guitarpro5/nightwish.gp5`
and the `serenade.*` files ("Serenade to a Dream" by Suidakra): real copyrighted songs.

## `mutopia/` — Mutopia Project MIDI files

MIDI written by LilyPond from editions on the [Mutopia Project](https://www.mutopiaproject.org).
The number in front of each name is the piece id: `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=<id>`.

| File | Piece | Typeset by | Licence |
|---|---|---|---|
| `102-anna-magdalena-04-guitar.mid` | Menuet in G, BWV Anh. 114 | Emre Akbas | Public domain |
| `695-anna-magdalena-04-guitar-tab.mid` | Menuet in G, BWV Anh. 114 (staff + tab) | Yannick Kirschhoffer | Public domain |
| `1092-horetzky3.mid` | F. Horetzky: Andante by Beethoven | Stan Sanderson | Public domain |
| `1093-horetzky4.mid` | F. Horetzky: The Last Rose of Summer | Stan Sanderson | Public domain |
| `110-saltarello.mid` | V. Galilei: Saltarello | Emre Akbas, Federico Bruni | Public domain |
| `13-carcassi-op60-01.mid` | M. Carcassi: Étude Op. 60 No. 1 | Jeff Covey | Public domain |
| `300-carcassi-op60-07.mid` | M. Carcassi: Étude Op. 60 No. 7 | Jeff Covey | Public domain |
| `2209-CarcassiMethodPreludes.mid` | M. Carcassi: Preludes from the Méthode, Op. 59 | Jeffrey Olson | Public domain |
| `1329-giuliani-op50n01.mid` | M. Giuliani: Op. 50 No. 1 | Stephen Rhen | CC BY 3.0 |
| `481-LullabyBrahms-C.mid` | J. Brahms: Lullaby, recorder and guitar (arr. Diego F. Guillen) | Diego Guillen | Public domain |
| `521-stille-nacht.mid` | F. X. Gruber: Stille Nacht (arr. D. Widyanto) | Daniel Widyanto | CC BY-SA 2.0 |
| `60-Bach_Prelude_BWV999.mid` | J. S. Bach: Prelude in D minor, BWV 999 | Jakob Bagterp | Public domain |
| `636-faure-sicilienne-guitare-doigtee.mid` | G. Fauré: Sicilienne, Op. 78 (transcr. L. A. Morin) | Olivier Flatrs, Federico Bruni | Public domain |
| `795-spanish-romance.mid` | Anonymous: Spanish Romance | Jeff Covey | CC BY-SA 2.5 |
| `900-eine-kleine-nachtmusik-mvt1.mid` | W. A. Mozart: Eine kleine Nachtmusik, 1st mvt (string quartet) | anonymous | Public domain |
| `2059-fur-elise-guitar-duo.mid` | L. van Beethoven: Für Elise, two guitars (arr. J. J. Olson) | Jeffrey Olson | Public domain |
| `1534-bach_air_bmv_1068.mid` | J. S. Bach: Air, BWV 1068, flute and guitar | Mike Blackstock | Public domain |

Twelve of them are also the app's example songs (`public/examples/`, `src/data/exampleSongs.ts`).
