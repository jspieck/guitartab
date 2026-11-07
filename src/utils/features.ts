/**
 * Build-time feature switches (Vite env, fixed per build).
 *
 * Cloud songs need the `server/` API, which the static deployment doesn't have: the button and
 * `?song=` links stay off unless the build sets `VITE_ENABLE_CLOUD=true`.
 */
export const CLOUD_ENABLED = import.meta.env.VITE_ENABLE_CLOUD === 'true'
