import { watch } from 'vue'
import Settings from '../stores/settingsState'

/** The theme is the id on <body>: tokens.css keys the dark values on `#darkMode`. */
export function applyTheme(dark: boolean): void {
  if (typeof document === 'undefined') return
  document.body.setAttribute('id', dark ? 'darkMode' : 'lightMode')
}

let watching = false

/** Keeps <body> in step with `Settings.darkMode`; call once at startup. */
export function watchTheme(): void {
  if (watching) return
  watching = true
  watch(() => Settings.darkMode, applyTheme, { immediate: true })
}

export function toggleTheme(): void {
  Settings.darkMode = !Settings.darkMode
  applyTheme(Settings.darkMode)
}
