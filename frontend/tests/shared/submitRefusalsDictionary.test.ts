import { describe, it, expect } from 'vitest';
import { SubmitRefusal } from '@soba/lib';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';

// The pages show these by the server's refusal code, so each language needs one for every code.
describe('submit refusal messages', () => {
  it.each([
    ['en', en.submitRefusals],
    ['fr', fr.submitRefusals],
  ])('%s has a message for every refusal code', (_language, messages) => {
    expect(Object.keys(messages).sort()).toEqual(Object.values(SubmitRefusal).sort());
    expect(Object.values(messages).every((text) => text.trim().length > 0)).toBe(true);
  });
});
