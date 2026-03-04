/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  // pnpm stores deps under node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>.
  // Keep most node_modules ignored, but allow transforming uuid (ESM package).
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|uuid/)',
    'node_modules/.pnpm/(?!(uuid)@)',
  ],
  rootDir: __dirname,
};
