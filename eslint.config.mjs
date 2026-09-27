import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const lintTargets = [
  'vite.config.ts',
  'src/App.vue',
  'src/components/BaseModal.vue',
  'src/components/CloudSongsModal.vue',
  'src/components/Compressor.vue',
  'src/components/Equalizer.vue',
  'src/components/Footer.vue',
  'src/components/Menu.vue',
  'src/components/AddChordModal.vue',
  'src/components/ChordManagerModal.vue',
  'src/components/ChordThumbnail.vue',
  'src/components/TremoloBarModal.vue',
  'src/components/BendModal.vue',
  'src/components/tab/**/*.vue',
  'src/composables/**/*.ts',
  'src/services/**/*.ts',
  'src/types/**/*.ts',
  'src/utils/**/*.ts',
  'src/assets/js/revertHandler.ts',
  'src/assets/js/modals/bendModalHandler.ts',
  'src/assets/js/modals/tremoloBarModalHandler.ts',
  'src/assets/js/modals/chordModalHandler.ts',
  'tests/**/*.ts',
]

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      // Vendored / legacy assets — except critical editor handlers below
      'src/assets/js/pdfkit.js',
      'src/assets/js/jspdf.debug.js',
      'src/assets/js/blob-stream.js',
      'src/assets/js/svgToPdf.js',
      'src/assets/js/pdfCreationWorker.js',
      'src/assets/images/**',
      'src/assets/css/**',
      'src/assets/fonts/**',
      'src/assets/index.html',
      'src/assets/main.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: lintTargets,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
]