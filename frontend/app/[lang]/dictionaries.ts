import 'server-only';

const dictionaries = {
  en: () => import('../../dictionaries/en.json').then((module) => module.default),
  fr: () => import('../../dictionaries/fr.json').then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;

export const hasLocale = (locale: string): locale is Locale => locale in dictionaries;

/** Server-only: use for `generateMetadata` / RSC instead of mutating `params.lang`. */
export function resolveLocale(lang: string): Locale {
  return hasLocale(lang) ? lang : 'en';
}

export const getDictionary = async (locale: Locale) => dictionaries[locale]();
