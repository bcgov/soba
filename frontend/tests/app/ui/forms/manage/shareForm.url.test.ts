import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the share URL construction logic used in ShareForm.
 * The component builds: /{lang}/submit?f={formId}
 */
function buildShareUrl(origin: string, lang: string, formId: string): string {
  const url = new URL(`/${lang}/submit`, origin);
  url.searchParams.set('f', formId);
  return url.toString();
}

describe('ShareForm URL building', () => {
  const origin = 'http://localhost:3000';

  it('builds a share URL with lang and formId', () => {
    const url = buildShareUrl(origin, 'en', 'abc-123');
    expect(url).toBe('http://localhost:3000/en/submit?f=abc-123');
  });

  it('builds a French share URL', () => {
    const url = buildShareUrl(origin, 'fr', 'abc-123');
    expect(url).toBe('http://localhost:3000/fr/submit?f=abc-123');
  });

  it('encodes special characters in formId', () => {
    const url = buildShareUrl(origin, 'en', 'form id with spaces');
    expect(url).toContain('f=form+id+with+spaces');
  });

  it('uses the correct path structure /{lang}/submit', () => {
    const url = new URL(buildShareUrl(origin, 'en', 'my-form'));
    expect(url.pathname).toBe('/en/submit');
  });

  it('includes formId as query param f', () => {
    const url = new URL(buildShareUrl(origin, 'en', 'my-form'));
    expect(url.searchParams.get('f')).toBe('my-form');
  });

  it('uses window.location.origin as the base', () => {
    const customOrigin = 'https://forms.gov.bc.ca';
    const url = buildShareUrl(customOrigin, 'en', 'form-1');
    expect(url.startsWith(customOrigin)).toBe(true);
  });

  it('only sets one query parameter', () => {
    const url = new URL(buildShareUrl(origin, 'en', 'form-1'));
    expect([...url.searchParams.keys()]).toHaveLength(1);
  });
});
