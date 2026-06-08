import { describe, it, expect } from 'vitest';
import { getLocaleFromPath } from '@/src/shared/util/locale';

describe('getLocaleFromPath', () => {
  it('should return "en" when path is empty or undefined', () => {
    expect(getLocaleFromPath('')).toBe('en');
    expect(getLocaleFromPath(undefined)).toBe('en');
    expect(getLocaleFromPath(null)).toBe('en');
  });

  it('should return the correct locale when present in path', () => {
    expect(getLocaleFromPath('/fr/some/page')).toBe('fr');
    expect(getLocaleFromPath('/en/dashboard')).toBe('en');
  });

  it('should default to "en" when path does not start with a known locale', () => {
    expect(getLocaleFromPath('/unknown/path')).toBe('en');
    expect(getLocaleFromPath('/about-us')).toBe('en');
  });
});
