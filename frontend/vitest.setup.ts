import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// The design-system components render styled-jsx `<style jsx global>` nodes,
// which React (no styled-jsx transform under jsdom) reports as "Received `true`
// for a non-boolean attribute `jsx`/`global`". This is library noise, not a bug
// in our code — filter just those two messages and pass everything else through.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
  if (text.includes('non-boolean attribute') && (text.includes('jsx') || text.includes('global'))) {
    return;
  }
  originalConsoleError(...args);
};

// Automatically clean up after each test
afterEach(() => {
  cleanup();
});
