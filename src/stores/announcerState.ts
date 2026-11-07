import { reactive } from 'vue'

/**
 * What screen readers should say next: the text of the hidden `aria-live` region in App.vue
 * ("Bar 3, beat 2, string 5, fret 7", "Undo: Note").
 */
export const announcerState = reactive({ text: '' })

// A follow-up within this time joins the message before it instead of replacing it.
const JOIN_MS = 500
let lastSpoken = { text: '', at: -Infinity, followUp: false }

/**
 * Speaks `text` (politely: after what is being read). The same text twice in a row is
 * spoken again, so it alternates a trailing no-break space that readers don't pronounce.
 * `followUp` (the cursor after an undo) is added to a message that was just set, unless
 * that one was a follow-up too (two cursor moves replace each other).
 */
export function announce(text: string, { followUp = false }: { followUp?: boolean } = {}): void {
  if (text === '') return
  const now = Date.now()
  const join = followUp && !lastSpoken.followUp && now - lastSpoken.at < JOIN_MS
  const joined = join ? `${lastSpoken.text}. ${text}` : text
  lastSpoken = { text: joined, at: now, followUp }
  announcerState.text = announcerState.text === joined ? `${joined}\u00a0` : joined
}
