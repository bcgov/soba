import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import json from '@eslint/json';
import css from '@eslint/css';
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  pluginPrettierRecommended,
  tseslint.configs.recommended,
  { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  { files: ['**/*.css'], plugins: { css }, language: 'css/css', extends: ['css/recommended'] },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'max-nested-callbacks': ['error', { max: 4 }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="describe"] CallExpression[callee.name="describe"]',
          message:
            'Nested describe is not allowed. Use a single top-level describe and flat it() only.',
        },
      ],
    },
  },
  globalIgnores(['dist', 'node_modules', 'package-lock.json', 'coverage']),
]);
