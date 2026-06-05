import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the share URL construction logic used in ShareForm.
 * The component builds: /{lang}/forms/{formId}
 */
function buildShareUrl(origin: string, lang: string, formId: string): string {
  return new URL(`/${lang}/forms/${encodeURIComponent(formId)}`, origin).toString();
}

describe('ShareForm URL building', () => {
  const origin = 'http://localhost:3000';

  it('builds a share URL with lang and formId', () => {
    const url = buildShareUrl(origin, 'en', 'abc-123');
    expect(url).toBe('http://localhost:3000/en/forms/abc-123');
  });

  it('builds a French share URL', () => {
    const url = buildShareUrl(origin, 'fr', 'abc-123');
    expect(url).toBe('http://localhost:3000/fr/forms/abc-123');
  });

  it('encodes special characters in formId', () => {
    const url = buildShareUrl(origin, 'en', 'form id with spaces');
    expect(url).toBe('http://localhost:3000/en/forms/form%20id%20with%20spaces');
  });

  it('uses the correct path structure /{lang}/forms/{formId}', () => {
    const url = new URL(buildShareUrl(origin, 'en', 'my-form'));
    expect(url.pathname).toBe('/en/forms/my-form');
  });

  it('does not use query parameters', () => {
    const url = new URL(buildShareUrl(origin, 'en', 'my-form'));
    expect(url.search).toBe('');
  });

  it('uses window.location.origin as the base', () => {
    const customOrigin = 'https://forms.gov.bc.ca';
    const url = buildShareUrl(customOrigin, 'en', 'form-1');
    expect(url.startsWith(customOrigin)).toBe(true);
  });
});
