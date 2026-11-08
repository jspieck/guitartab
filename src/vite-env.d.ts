/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows Cloud songs and opens `?song=` links (needs the server/ API). */
  readonly VITE_ENABLE_CLOUD?: string
  /** Where the cloud API lives when it isn't on the same origin. */
  readonly VITE_API_BASE_URL?: string
}

/** Title of the newest CHANGELOG.md entry, set at build time by site/vitePlugin.ts (Big win 34). */
declare const __CHANGELOG_LATEST__: string

/**
 * `public/audio/manifest.json` as the build read it (Big win 32; vite.config.ts): the hashed
 * SoundFont to stream, or null to load the SF2 whole.
 */
declare const __SOUND_FONT_MANIFEST__: import('./services/audio/soundFont/streaming').SoundFontManifest | null
