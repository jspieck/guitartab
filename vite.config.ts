import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// File readers: Guitar Pro 3-8, MIDI, typed import errors
const IMPORTER_MODULES = [
  '/src/assets/js/GProReader.ts',
  '/src/assets/js/GP3Reader.ts',
  '/src/assets/js/GP4Reader.ts',
  '/src/assets/js/GP5Reader.ts',
  '/src/services/midiImport.ts',
  '/src/services/importErrors.ts',
  '/src/assets/js/MidiReader.ts',
  '/src/services/gpContainers.ts',
  '/src/services/gpifImport.ts',
]

const MODULE_CHUNKS: Record<string, string[]> = {
  'pdf-export': [
    '/src/assets/js/pdfkit.js',
    '/src/assets/js/blob-stream.js',
    '/src/assets/js/svgToPdf.js',
    '/src/assets/js/jspdf.debug.js',
  ],
  importers: IMPORTER_MODULES,
  // First-visit check and the small test riff; the multi-track demo itself is lazy-loaded.
  'first-run': ['/src/data/demoSong.ts', '/src/stores/firstRunHintState.ts'],
  // The shortcut table: the key handler needs it at startup, the Help sheet lists it.
  shortcuts: ['/src/utils/keyboardShortcuts.ts', '/src/stores/shortcutsHelpState.ts'],
  // The desktop toolbar. Still loaded at startup (in parallel); a named chunk so the entry
  // budget tracks the app shell. Splitting the toolbar itself is Big win 11 of the audit.
  toolbar: ['/src/components/Menu.vue'],
}

function manualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('/node_modules/')) {
    if (
      normalizedId.includes('/vue/') ||
      normalizedId.includes('/pinia/') ||
      normalizedId.includes('/mitt/')
    ) {
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
      return 'importers'
    }

    return 'vendor'
  }

  for (const [chunk, paths] of Object.entries(MODULE_CHUNKS)) {
    if (paths.some((path) => normalizedId.includes(path))) {
      return chunk
    }
  }

  if (
    normalizedId.includes('/src/assets/js/audioEngine.ts') ||
    normalizedId.includes('/src/assets/js/chorus.ts') ||
    normalizedId.includes('/src/assets/js/compositeAudioNode.ts') ||
    normalizedId.includes('/src/assets/js/combFilter.ts') ||
    normalizedId.includes('/src/assets/js/freeverb.ts') ||
    normalizedId.includes('/src/assets/js/lowpassCombFilter.ts') ||
    normalizedId.includes('/src/assets/js/midiReceiver.ts') ||
    normalizedId.includes('/src/assets/js/playbackEngine.ts') ||
    normalizedId.includes('/src/assets/js/sf2parser.ts')
  ) {
    return 'audio-engine'
  }

  if (normalizedId.includes('/src/assets/js/modals/')) {
    return 'modal-handlers'
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
      exclude: ['src/**/*.d.ts', 'src/assets/js/pdfkit.js', 'src/assets/js/jspdf.debug.js'],
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
