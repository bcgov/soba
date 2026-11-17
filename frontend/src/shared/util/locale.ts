/**
 * Supported locales
 */
const knownLocales = ['en', 'fr'] as const;

/** The supported locale `value` names, or null. Returns the list's own value, never `value`. */
export function knownLocale(value?: string | null): (typeof knownLocales)[number] | null {
  return knownLocales.find((locale) => locale === value) ?? null;
}

/**
 * Small client-side utility to extract locale (en|fr) from a pathname.
 * Designed for use in useClient components.
 */
export function getLocaleFromPath(path?: string | null): string {
  try {
    const firstSegment = path?.split('/').find(Boolean);
    return knownLocale(firstSegment) ?? 'en';
  } catch {
    return 'en';
  }
}
