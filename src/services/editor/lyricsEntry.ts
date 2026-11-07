import Song from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import { lyricsEntryState } from '../../stores/lyricsEntryState'
import { showNotification } from '../../stores/notificationState'
import {
  beatLyric,
  flowLyrics,
  lyricBeats,
  MAX_LYRIC_VERSES,
  nextLyricBeats,
  parseLyricChunks,
  type LyricBeatRef,
} from '../../utils/lyrics'
import { typedEventBus } from '../../utils/typedEventBus'
import { recordBarEdit } from './editCommands'

/**
 * Typing lyrics at the edit cursor. The lyric field (`components/tab/LyricsEntryField.vue`)
 * edits the syllable of the cursor's beat; Space or Tab stores it and moves to the next
 * note, `-` hyphenates, and a typed or pasted line flows one syllable per note onto the
 * beats that follow. Each stored entry is one undo step.
 */

function cursorBars() {
  const { trackId } = selectionState.cursor
  return Song.measures[trackId] ?? []
}

function cursorRef(): LyricBeatRef {
  const { blockId, beatId } = selectionState.cursor
  return { blockId, beatId }
}

function moveCursorTo(ref: LyricBeatRef): void {
  const { trackId, voiceId, blockId, string } = selectionState.cursor
  if (ref.blockId !== blockId) {
    typedEventBus.emit('navigation.scrollToBlock', { trackId, voiceId, blockId: ref.blockId })
  }
  typedEventBus.emit('navigation.setClickedPos', { trackId, voiceId, ...ref, string })
}

/** The note beat at or after (`1`) / before (`-1`) the cursor. */
function lyricBeatFrom(from: LyricBeatRef, direction: 1 | -1): LyricBeatRef | null {
  const { voiceId } = selectionState.cursor
  for (const ref of lyricBeats(cursorBars(), voiceId, from, direction)) return ref
  return null
}

function stepFrom(ref: LyricBeatRef, direction: 1 | -1): LyricBeatRef | null {
  const bars = cursorBars()
  const { voiceId } = selectionState.cursor
  const beats = bars[ref.blockId]?.[voiceId] ?? []
  const beatId = ref.beatId + direction
  if (beatId >= 0 && beatId < beats.length) return lyricBeatFrom({ blockId: ref.blockId, beatId }, direction)
  const blockId = ref.blockId + direction
  if (blockId < 0 || blockId >= bars.length) return null
  const beatIdInBar = direction === 1 ? 0 : (bars[blockId]?.[voiceId]?.length ?? 1) - 1
  return lyricBeatFrom({ blockId, beatId: beatIdInBar }, direction)
}

/** Opens the lyric field at the cursor's note (or the next one, when the cursor is on a rest). */
export function startLyricsEntry(verse = lyricsEntryState.verse): boolean {
  const target = lyricBeatFrom(cursorRef(), 1) ?? lyricBeatFrom(cursorRef(), -1)
  if (target == null) {
    showNotification('Lyrics go on notes. Enter some notes first.', 'info')
    return false
  }
  selectionState.hasExplicitSelection = true
  if (target.blockId !== selectionState.cursor.blockId || target.beatId !== selectionState.cursor.beatId) {
    moveCursorTo(target)
  }
  lyricsEntryState.verse = Math.max(0, Math.min(MAX_LYRIC_VERSES - 1, verse))
  lyricsEntryState.active = true
  return true
}

export function stopLyricsEntry(): void {
  lyricsEntryState.active = false
}

export function toggleLyricsEntry(): void {
  if (lyricsEntryState.active) stopLyricsEntry()
  else startLyricsEntry()
}

/** The syllable at the cursor in the current verse. */
export function cursorLyric(): string {
  const { trackId, blockId, voiceId, beatId } = selectionState.cursor
  return beatLyric(Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId], lyricsEntryState.verse)
}

/**
 * Stores what was typed for the cursor's beat: one syllable, or a line that flows onto the
 * following notes. `''` clears the beat. Returns the last beat written (null: nothing to write on).
 */
export function enterLyrics(text: string): LyricBeatRef | null {
  const syllables = text.trim() === '' ? [''] : parseLyricChunks(text)
  if (syllables.length === 0) syllables.push('')
  const { trackId, voiceId } = selectionState.cursor
  const bars = cursorBars()
  const targets = nextLyricBeats(bars, voiceId, cursorRef(), syllables.length)
  if (targets.length === 0) return null
  const verse = lyricsEntryState.verse
  const blockIds = [...new Set(targets.map((ref) => ref.blockId))]
  recordBarEdit('Lyrics', { trackId, blockIds }, () => {
    flowLyrics(bars, voiceId, verse, targets[0], syllables)
  })
  return targets[targets.length - 1]
}

/** Moves the cursor to the next / previous note. False at the end of the track. */
export function moveLyricCursor(direction: 1 | -1, from: LyricBeatRef = cursorRef()): boolean {
  const target = stepFrom(from, direction)
  if (target == null) return false
  moveCursorTo(target)
  return true
}

/** Stores `text` and moves on to the note after the last syllable written. */
export function enterLyricsAndAdvance(text: string): boolean {
  const last = enterLyrics(text) ?? cursorRef()
  return moveLyricCursor(1, last)
}

export function setLyricVerse(verse: number): void {
  lyricsEntryState.verse = Math.max(0, Math.min(MAX_LYRIC_VERSES - 1, verse))
}
