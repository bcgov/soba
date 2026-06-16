import { describe, it, expect } from 'vitest';
import { buildExportFilename, kebab } from '@/src/features/designer/exportFilename';

describe('buildExportFilename', () => {
  it('builds name-v{n}-{state} for a saved, clean design', () => {
    expect(buildExportFilename('Intake Form', 2, 'published', false)).toBe(
      'intake-form-v2-published.json',
    );
  });

  it('adds -in-design when there are unsaved edits', () => {
    expect(buildExportFilename('Intake Form', 3, 'draft', true)).toBe(
      'intake-form-v3-draft-in-design.json',
    );
  });

  it('uses v0-new for a brand-new unsaved form (no version/state)', () => {
    expect(buildExportFilename('Intake Form', null, null, true)).toBe('intake-form-v0-new.json');
  });

  it('falls back to "form" when the name is empty', () => {
    expect(buildExportFilename('', 1, 'draft', false)).toBe('form-v1-draft.json');
  });
});

describe('kebab', () => {
  it('lowercases and hyphenates, trimming stray separators', () => {
    expect(kebab('  My Form (v2)!! ')).toBe('my-form-v2');
  });
});
