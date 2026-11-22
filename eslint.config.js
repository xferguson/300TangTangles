import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const pureDomain = [
  'src/core/**',
  'src/lexicon/**',
  'src/engine/**',
  'src/tangle/**',
  'src/speech/grade/**',
];

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Domain logic is pure: no React, no DOM.
    files: pureDomain,
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', 'react/*', 'react-dom/*', '@testing-library/*'] },
      ],
    },
  },
  prettier,
);
