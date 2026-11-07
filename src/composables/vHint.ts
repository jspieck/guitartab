import type { Directive } from 'vue'
import { clearFooterHint, showFooterHint } from '../stores/footerHintState'

/**
 * `v-hint="text"`: shows what a control does in the footer while it is hovered or focused.
 * The text follows the value (a knob being turned) while the control is still active.
 */

interface HintElement extends HTMLElement {
  hintText?: string
  hintActive?: boolean
  hintListeners?: [string, () => void][]
}

export const vHint: Directive<HintElement, string> = {
  mounted(el, binding) {
    el.hintText = binding.value
    const show = () => {
      el.hintActive = true
      showFooterHint(el.hintText ?? '')
    }
    const hide = () => {
      el.hintActive = false
      clearFooterHint(el.hintText)
    }
    el.hintListeners = [
      ['pointerenter', show],
      ['focusin', show],
      ['pointerleave', hide],
      ['focusout', hide],
    ]
    for (const [type, listener] of el.hintListeners) el.addEventListener(type, listener)
  },
  updated(el, binding) {
    if (binding.value === el.hintText) return
    const previous = el.hintText
    el.hintText = binding.value
    if (el.hintActive) {
      clearFooterHint(previous)
      showFooterHint(binding.value)
    }
  },
  beforeUnmount(el) {
    for (const [type, listener] of el.hintListeners ?? []) el.removeEventListener(type, listener)
    if (el.hintActive) clearFooterHint(el.hintText)
  },
}
