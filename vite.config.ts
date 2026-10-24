import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const MODULE_CHUNKS: Record<string, string[]> = {
  // The shortcut table: the key handler needs it at startup, the Help sheet lists it.
  shortcuts: ['/src/utils/keyboardShortcuts.ts', '/src/stores/shortcutsHelpState.ts'],
  // The desktop toolbar. Still loaded at startup (in parallel); a named chunk so the entry
  // budget tracks the app shell. Splitting the toolbar itself is Big win 11 of the audit.
  toolbar: ['/src/components/Menu.vue'],
}

// The editor (song data, layout, edit commands, stores), playback and audio, the dialog
// handlers, the importers and the first-run riff, all loaded at startup. They import each
// other both ways (playback reads the stores, edits restart playback; the dialog registry
// builds its handlers on load and editor code opens dialogs; the importers write the song
// and startup imports), so they must share one chunk: split across chunks, a chunk runs
// before the one it reads from and fails with "Cannot access 'x' before initialization".
// To split one off again, first remove the imports back into it (scripts/check-bundle-budget.mjs
// fails on chunk cycles). The lazy services (exports, compact layout, cloud songs, the
// VexFlow drawing, the multi-track demo) are not in these folders.
const EDITOR_CORE_PATHS = [
  '/src/data/instrumentData.ts',
  '/src/data/demoSong.ts',
  '/src/stores/',
  '/src/utils/',
  '/src/services/editor/',
  '/src/services/notation/',
  '/src/services/audio/',
  '/src/services/playback/',
  '/src/services/midi/liveInput.ts',
  '/src/services/dialogs/',
  '/src/services/songImport.ts',
  '/src/services/import/',
  '/src/services/midiImport.ts',
  '/src/services/importErrors.ts',
  '/src/services/gpContainers.ts',
  '/src/services/gpifImport.ts',
  '/src/services/startup.ts',
  '/src/services/appEvents.ts',
  '/src/services/songAutosave.ts',
  '/src/services/songMigrations.ts',
  '/src/services/userNotifications.ts',
]

// The VexFlow code: loaded with the classical notation, never at startup.
const LAZY_NOTATION_MODULES = [
  '/src/services/notation/classicalNotation.ts',
  '/src/services/notation/vexflowNotes.ts',
]

function manualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  // Helper modules that Vite and the Vue plugin add to many chunks. Left unassigned, Rollup puts
  // each into the first chunk that needs it and every other user imports that chunk (a cycle).
  if (normalizedId.includes('plugin-vue:export-helper') || normalizedId.includes('vite/preload-helper')) {
    return 'framework'
  }

  if (normalizedId.includes('/node_modules/')) {
    if (normalizedId.includes('/vue/') || normalizedId.includes('/mitt/')) {
      return 'framework'
    }
    if (normalizedId.includes('/vexflow/')) {
      return 'notation'
    }
    if (
      normalizedId.includes('/interactjs/') ||
      normalizedId.includes('/fastdom/') ||
      normalizedId.includes('/tinycolor2/') ||
      normalizedId.includes('/vanilla-picker/')
    ) {
      return 'ui-vendor'
    }
    if (normalizedId.includes('/lz-string/')) {
      return 'serialization'
    }
    if (normalizedId.includes('/fflate/')) {
      // Unzips .gp files (importers, startup) and zips GP/GPX exports.
      return 'editor-core'
    }

    return 'vendor'
  }

  for (const [chunk, paths] of Object.entries(MODULE_CHUNKS)) {
    if (paths.some((path) => normalizedId.includes(path))) {
      return chunk
    }
  }

  if (
    EDITOR_CORE_PATHS.some((path) => normalizedId.includes(path)) &&
    !LAZY_NOTATION_MODULES.some((path) => normalizedId.includes(path))
  ) {
    return 'editor-core'
  }

  if (normalizedId.includes('/src/components/tab/')) {
    return 'tab-renderer'
  }

  // Studio panels open from ModalsContainer, which is lazy-loaded.
  if (
    normalizedId.includes('/src/components/Mixer.vue') ||
    normalizedId.includes('/src/components/Equalizer.vue') ||
    normalizedId.includes('/src/components/Compressor.vue') ||
    normalizedId.includes('/src/components/audio/VerticalFader.vue') ||
    normalizedId.includes('/src/components/audio/audioPlugin.css') ||
    normalizedId.includes('/src/services/drumMixer.ts') ||
    normalizedId.includes('/src/composables/useModalOpen.ts')
  ) {
    return 'studio-panels'
  }

  if (
    normalizedId.includes('/src/components/EffectsBar.vue') ||
    normalizedId.includes('/src/components/Sequencer.vue') ||
    normalizedId.includes('/src/components/Fader.vue') ||
    normalizedId.includes('/src/components/Knob.vue') ||
    normalizedId.includes('/src/components/audio/RotaryKnob.vue') ||
    normalizedId.includes('/src/components/PracticeControls.vue') ||
    normalizedId.includes('/src/components/SaveFormatMenu.vue')
  ) {
    return 'studio-ui'
  }

  return undefined
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
      // Floors a little under the measured coverage (2026-10-17); raise them as tests are added.
      thresholds: {
        'src/services/*.ts': { statements: 70, branches: 63, functions: 64, lines: 70 },
        'src/services/editor/**': { statements: 39, branches: 28, functions: 36, lines: 39 },
        'src/utils/**': { statements: 57, branches: 50, functions: 58, lines: 59 },
        'src/stores/**': { statements: 49, branches: 38, functions: 37, lines: 49 },
      },
    },
  },
})
