# Third-party notices

SereneTab's own code is under the MIT licence (`LICENSE`). The parts below come from others and
keep their own licences. The About dialog in the app (File → About, credits and legal) shows the
same list to users.

## Software shipped in the app

| Package | Licence | Use |
|---|---|---|
| [Vue](https://vuejs.org) | MIT | UI framework |
| [VexFlow](https://www.vexflow.com) | MIT | Classical notation; its bundled music fonts (Bravura, Petaluma: SIL Open Font License 1.1; Gonville) keep their licences |
| [fflate](https://github.com/101arrowz/fflate) | MIT | ZIP and compression (Guitar Pro 7/8 files, `.gt`) |
| [lz-string](https://github.com/pieroxy/lz-string) | MIT | Compression |
| [mitt](https://github.com/developit/mitt) | MIT | Event bus |
| [fastdom](https://github.com/wilsonpage/fastdom) | MIT | Layout scheduling |
| [tinycolor2](https://github.com/bgrins/TinyColor) | MIT | Colours |
| [vanilla-picker](https://github.com/Sphinxxxx/vanilla-picker) | ISC | Colour picker |
| [@wasm-audio-decoders/ogg-vorbis](https://github.com/eshaz/wasm-audio-decoders) | MIT | Ogg Vorbis decoding for SF3 SoundFonts (fallback) |

## Fonts

| Font | Licence |
|---|---|
| Source Sans Pro (Adobe) | SIL Open Font License 1.1 |
| `musicFont.ttf` (tab and effect symbols) | Made for this project |

## Sounds

| SoundFont | Licence | Notes |
|---|---|---|
| [GeneralUser GS 2.0.3](https://github.com/mrbumpy409/GeneralUser-GS) by S. Christian Collins | GeneralUser GS License v2.0 (free use, redistribution and modification) | Not in the repository; served from `/audio/` with `GeneralUser-GS-LICENSE.txt` |
| [MuseScore_General](https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/) (optional, `?soundfont=musescore`) | MIT, acknowledgements in `MuseScore_General-LICENSE.md` | Not deployed by default |

## Example songs

MIDI files from the [Mutopia Project](https://www.mutopiaproject.org): public domain or Creative
Commons BY-SA (credits per file in `public/examples/CREDITS.md`). The demo songs "Open Road" and
"Back Porch Shuffle" are written for this project.

## Test fixtures (not shipped)

Guitar Pro and MusicXML test files from [alphaTab](https://github.com/CoderLine/alphaTab) under the
Mozilla Public License 2.0 (`e2e/fixtures/files/real/SOURCES.md`).
