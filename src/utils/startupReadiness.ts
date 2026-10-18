export type StartupStep = 'editor' | 'soundfont'

/**
 * Marks a startup step as done with `<html data-editor-ready>` / `data-soundfont-ready`,
 * so end-to-end tests can wait for exactly what they need instead of network silence.
 */
export function markStartupStepDone(step: StartupStep): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset[`${step}Ready`] = 'true'
}
