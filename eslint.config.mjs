import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const lintTargets = [
  'vite.config.ts',
  'site/**/*.ts',
  'src/**/*.vue',
  'src/**/*.ts',
  'tests/**/*.ts',
  'e2e/**/*.ts',
  'scripts/**/*.mjs',
  'eslint.config.mjs',
  'playwright.config.ts',
]

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'src/vue-shims.d.ts',
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
      'max-lines-per-function': [
        'warn',
        {
          max: 80,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/multi-word-component-names': 'off',
      // TypeScript already reports undefined names, and knows DOM types such as BiquadFilterType.
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Layering: the lower layers must not import the Vue layer. Shared state belongs
    // in src/stores.
    files: [
      'src/services/**/*.ts',
      'src/stores/**/*.ts',
      'src/utils/**/*.ts',
      'src/types/**/*.ts',
      'src/data/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/components/**', '**/composables/**', '*.vue'],
              allowTypeImports: true,
              message:
                'services/, stores/, utils/, types/ and data/ must not import components or composables.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    // Command-line scripts and benchmarks report on the console.
    files: ['scripts/**/*.mjs', 'e2e/perf-*.spec.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
