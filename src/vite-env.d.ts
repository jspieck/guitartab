/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows Cloud songs and opens `?song=` links (needs the server/ API). */
  readonly VITE_ENABLE_CLOUD?: string
  /** Where the cloud API lives when it isn't on the same origin. */
  readonly VITE_API_BASE_URL?: string
}
