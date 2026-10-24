import { setFret } from '../services/editor/noteCommands'
import Song from '../stores/song'

const FIRST_VISIT_KEY = 'guitartab:firstVisitDone'
// End-to-end tests set this to 'riff' to get the small one-track riff below instead of
// the multi-track demo, so they don't depend on the demo's content.
const DEMO_VARIANT_KEY = 'guitartab:demoSong'

export function wantsSmallDemo(): boolean {
  return localStorage.getItem(DEMO_VARIANT_KEY) === 'riff'
}

export function hasCompletedFirstVisit(): boolean {
  return localStorage.getItem(FIRST_VISIT_KEY) === '1'
}

export function markFirstVisitComplete(): void {
  localStorage.setItem(FIRST_VISIT_KEY, '1')
}

/**
 * Seeds a short playable riff so first-time users see something real instead of blank measures.
 */
export function seedDemoNotes(): void {
  Song.songDescription.title = 'Blues in E'
  Song.songDescription.author = 'Demo'
  Song.tracks[0].name = 'Guitar'

  // [bar, beat, string, fret]; string 0 is the low E (bottom tab line).
  const notes: Array<[number, number, number, number]> = [
    [0, 0, 0, 0],
    [0, 1, 0, 3],
    [0, 2, 1, 2],
    [0, 3, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 0, 3],
    [1, 2, 1, 2],
    [1, 3, 2, 2],
  ]

  notes.forEach(([blockId, beatId, string, fret]) => {
    setFret(0, blockId, 0, beatId, string, fret, true)
  })
}
