import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const lintTargets = [
  'vite.config.ts',
  'src/components/NoteContextMenu.vue',
  'src/components/tab/**/*.vue',
  'src/composables/**/*.ts',
  'src/types/**/*.ts',
  'src/utils/**/*.ts',
]

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'src/assets/**',
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
]