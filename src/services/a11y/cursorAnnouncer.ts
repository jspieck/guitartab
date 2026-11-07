import { computed, toRaw, watch } from 'vue'
import Song from '../../stores/song'
import { selectionState, type RangeEndpoint } from '../../stores/selectionState'
import { playbackTransportState } from '../../stores/playbackTransportState'
import { announce } from '../../stores/announcerState'
import { speakCursorPosition } from './spokenPosition'

/**
 * Tells screen readers where the cursor is after each move or edit ("Bar 3, beat 2,
 * string 5, fret 7") and what a range selection covers. Loaded after startup (startup.ts),
 * not part of the editor chunk.
 */

// Holding an arrow key moves many beats; only the place where it stops is spoken.
const SETTLE_MS = 120

function cursorText(): string {
  const { trackId, voiceId, blockId, beatId, string } = selectionState.cursor
  const track = Song.tracks[trackId]
  if (track == null) return ''
  const beat = Song.findBeat({ trackId, blockId, voiceId, beatId })
  if (beat == null) return ''
  const note = beat.notes[string] ?? null
  const rest = Array.from(beat.notes).every((entry) => entry == null)
  return speakCursorPosition({ blockId, beatId, string, voiceId }, track.numStrings, {
    fret: note?.fret,
    dead: note?.dead,
    tied: note?.tied,
    rest,
  })
}

function endpointText(end: RangeEndpoint): string {
  return `bar ${end.blockId + 1} beat ${end.beatId + 1}`
}

function rangeText(): string {
  const { rangeStart, rangeEnd } = selectionState
  if (rangeStart == null || rangeEnd == null) return ''
  const [from, to] = [toRaw(rangeStart), toRaw(rangeEnd)].sort(
    (a, b) => a.blockId - b.blockId || a.beatId - b.beatId,
  )
  if (from.blockId === to.blockId && from.beatId === to.beatId) return ''
  return `Selected ${endpointText(from)} to ${endpointText(to)}`
}

let stop: (() => void) | null = null

export function startCursorAnnouncements(): void {
  if (stop != null) return
  // Reads the song through the reactive proxy, so typing a fret re-announces the note.
  const spoken = computed(() => rangeText() || cursorText())
  let timer: ReturnType<typeof setTimeout> | undefined
  stop = watch(spoken, (text) => {
    clearTimeout(timer)
    // The playhead doesn't move the cursor, but a song loaded while playing would chatter.
    if (playbackTransportState.isPlaying || !selectionState.hasExplicitSelection) return
    timer = setTimeout(() => announce(text, { followUp: true }), SETTLE_MS)
  })
}

export function stopCursorAnnouncements(): void {
  stop?.()
  stop = null
}
