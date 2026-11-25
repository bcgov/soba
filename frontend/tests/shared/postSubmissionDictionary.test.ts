import { describe, it, expect } from 'vitest';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';

/** Each key path in a dictionary section, with its text. */
const entries = (node: unknown, path = ''): [string, string][] =>
  typeof node === 'string'
    ? [[path, node]]
    : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        entries(value, path ? `${path}.${key}` : key),
      );

// The type checks the French dictionary against nothing, so a missing French key shows in the page
// as undefined. These hold the After Submission tab's copy in both languages.
describe('After Submission copy', () => {
  it('has the same keys in English and French', () => {
    const keys = (section: unknown) => entries(section).map(([path]) => path);
    expect(keys(fr.postSubmission)).toEqual(keys(en.postSubmission));
  });

  it.each([
    ['en', en.postSubmission],
    ['fr', fr.postSubmission],
  ])('%s has text for every key', (_language, section) => {
    expect(entries(section).every(([, text]) => text.trim().length > 0)).toBe(true);
  });

  it.each([
    ['en', en.postSubmission],
    ['fr', fr.postSubmission],
  ])('%s keeps the placeholders the tab fills in', (_language, section) => {
    expect(section.addressList.count).toContain('{count}');
    expect(section.addressList.count).toContain('{max}');
    expect(section.addressList.tooMany).toContain('{max}');
    expect(section.addressList.added).toContain('{addresses}');
    expect(section.addressList.duplicate).toContain('{addresses}');
    expect(section.addressList.removed).toContain('{address}');
    expect(section.status).toContain('{status}');
    expect(section.log.noteHelp).toContain('{max}');
    expect(section.log.noteValue).toContain('{note}');
  });
});
