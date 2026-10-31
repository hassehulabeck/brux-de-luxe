import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: globals.browser,
    },
  },

  {
    files: ['apps/sim/**/*.ts', '**/*.config.{js,ts}', '**/test/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Hard rule 3 in CLAUDE.md: the engine is pure. No Node APIs, no DOM,
  // and no Math.random (all randomness goes through ChanceOracle).
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'os'],
              message: 'The engine must not use Node APIs.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'The engine must not use Node APIs.' },
        { name: 'window', message: 'The engine must not use the DOM.' },
        { name: 'document', message: 'The engine must not use the DOM.' },
        { name: 'localStorage', message: 'The engine must not use browser storage.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the ChanceOracle for all randomness.' },
      ],
    },
  },

  prettier,
);
