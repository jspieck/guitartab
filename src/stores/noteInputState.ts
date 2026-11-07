import { reactive } from 'vue'
import type { NoteLengthCode } from '../types/tab'

/**
 * Settings for entering notes: the length a newly typed note gets, and the tuplet the
 * toolbar's tuplet button applies (its count select; reset to fit the beat at the cursor).
 */
export const noteInputState = reactive<{ noteLength: NoteLengthCode; tuplet: string }>({
  noteLength: 'e',
  tuplet: '3',
})
