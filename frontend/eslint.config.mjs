import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  // Disallow console in app code. Error logging goes through the notification
  // store's `consoleError` option (the single sanctioned logging sink).
  {
    rules: {
      'no-console': 'error',
    },
  },
  // Tests and test/build config legitimately use/wrap console.
  {
    files: ['tests/**', '**/*.test.{ts,tsx}', 'vitest.setup.ts', 'vitest.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);

export default eslintConfig;
