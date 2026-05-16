import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

function manualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('/node_modules/')) {
    if (normalizedId.includes('/vue/') || normalizedId.includes('/pinia/') || normalizedId.includes('/mitt/')) {
      return 'framework'
    }
    if (normalizedId.includes('/vexflow/')) {
      return 'notation'
    }
    if (
      normalizedId.includes('/interactjs/')
      || normalizedId.includes('/fastdom/')
      || normalizedId.includes('/tinycolor2/')
      || normalizedId.includes('/vanilla-picker/')
    ) {
      return 'ui-vendor'
    }
    if (normalizedId.includes('/lz-string/')) {
      return 'serialization'
    }

    return 'vendor'
  }

  if (
    normalizedId.includes('/src/assets/js/pdfkit.js')
    || normalizedId.includes('/src/assets/js/blob-stream.js')
    || normalizedId.includes('/src/assets/js/svgToPdf.js')
    || normalizedId.includes('/src/assets/js/jspdf.debug.js')
  ) {
    return 'pdf-export'
  }

  if (
    normalizedId.includes('/src/assets/js/audioEngine.ts')
    || normalizedId.includes('/src/assets/js/chorus.ts')
    || normalizedId.includes('/src/assets/js/compositeAudioNode.ts')
    || normalizedId.includes('/src/assets/js/combFilter.ts')
    || normalizedId.includes('/src/assets/js/freeverb.ts')
    || normalizedId.includes('/src/assets/js/lowpassCombFilter.ts')
    || normalizedId.includes('/src/assets/js/midiReceiver.ts')
    || normalizedId.includes('/src/assets/js/playBackLogicNew.ts')
    || normalizedId.includes('/src/assets/js/sf2parser.ts')
  ) {
    return 'audio-engine'
  }

  if (normalizedId.includes('/src/assets/js/modals/')) {
    return 'modal-handlers'
  }

  if (normalizedId.includes('/src/components/tab/')) {
    return 'tab-renderer'
  }

  if (
    normalizedId.includes('/src/components/EffectsBar.vue')
    || normalizedId.includes('/src/components/Sequencer.vue')
    || normalizedId.includes('/src/components/Fader.vue')
    || normalizedId.includes('/src/components/Knob.vue')
    || normalizedId.includes('/src/components/Mixer.vue')
    || normalizedId.includes('/src/components/Equalizer.vue')
    || normalizedId.includes('/src/components/Compressor.vue')
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
  },
})
