# Import fixtures

All files here are authored for this project (no third-party songs).

| File | How it was made |
|---|---|
| `showcase.gp5` | `currentSongAsGp5()` (`src/services/gp5Export.ts`) on the effects showcase (`../effectsShowcase.ts`) |
| `showcase.gt` | `serializeSongToGtBytes()` on the same song |
| `showcase.expected.json` | `songFingerprintSource()` of the showcase before export |
| `open-road.gpx` | The demo song (`src/data/demoArrangement.ts`) exported with Download → Guitar Pro 6 (.gpx) |
| `showcase.gpif` | Hand-written GPIF (Guitar Pro 7 layout) with one of most effects |
| `two-bars.mid` | Written byte by byte: format 0, 480 ticks/quarter, 120 bpm, 4/4, eight quarter notes E2 G2 A2 B2 C3 B2 A2 G2 |

Regenerate the showcase files only on purpose (e.g. after adding an effect to the
showcase): a changed writer must still read these old files the same way.
