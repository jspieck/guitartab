import { reactive } from 'vue'

/**
 * Lyric entry at the edit cursor (`services/editor/lyricsEntry.ts`): whether the lyric field
 * is open and which verse it writes. The beat is the cursor's beat.
 */
export const lyricsEntryState = reactive({
  active: false,
  /** 0-based verse (lyric line). */
  verse: 0,
})
