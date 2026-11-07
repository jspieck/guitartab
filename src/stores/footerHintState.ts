import { reactive } from 'vue'

/**
 * What the control under the pointer (or with keyboard focus) does, shown in the footer.
 * Small controls like the sequencer's knobs have no room for a label, and tooltips are
 * clipped by the bottom bars.
 */
export const footerHintState = reactive({ text: '' })

export function showFooterHint(text: string): void {
  footerHintState.text = text
}

export function clearFooterHint(text?: string): void {
  // (only the hint that is still shown: leaving one control after entering the next)
  if (text == null || footerHintState.text === text) footerHintState.text = ''
}
