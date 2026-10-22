import { reactive } from 'vue'
import type { NoteLengthCode } from '../types/tab'

/** Settings for entering notes: the length a newly typed note gets. */
export const noteInputState = reactive<{ noteLength: NoteLengthCode }>({
  noteLength: 'e',
})
