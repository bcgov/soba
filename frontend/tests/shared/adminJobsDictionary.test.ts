import { describe, it, expect } from 'vitest';
import { JOB_STATUSES } from '@soba/lib';
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
// as undefined. These hold the Jobs tab's copy in both languages.
describe('Jobs tab copy', () => {
  it('has the same keys in English and French', () => {
    const keys = (section: unknown) => entries(section).map(([path]) => path);
    expect(keys(fr.admin.jobs)).toEqual(keys(en.admin.jobs));
  });

  it.each([
    ['en', en.admin.jobs],
    ['fr', fr.admin.jobs],
  ])('%s has text for every key and every job status', (_language, section) => {
    expect(entries(section).every(([, text]) => text.trim().length > 0)).toBe(true);
    expect(Object.keys(section.statuses).sort()).toEqual([...JOB_STATUSES].sort());
  });

  it.each([
    ['en', en.admin.jobs],
    ['fr', fr.admin.jobs],
  ])('%s keeps the placeholders the tab fills in', (_language, section) => {
    expect(section.attemptsValue).toContain('{attempts}');
    expect(section.attemptsValue).toContain('{max}');
    expect(section.viewLabel).toContain('{type}');
    expect(section.viewLabel).toContain('{created}');
    expect(section.detail.byValue).toContain('{at}');
    expect(section.detail.byValue).toContain('{by}');
    expect(section.detail.rerunsValue).toContain('{count}');
    expect(section.detail.rerunsValue).toContain('{at}');
    expect(section.detail.rerunsValue).toContain('{by}');
    expect(section.detail.rerunEmails).toContain('{count}');
    expect(section.detail.refused).toContain('{reason}');
  });
});
