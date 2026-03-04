import { bcdsThemeAdapter } from '@/src/shared/theme/adapters/bcds';
import type { ThemeAdapter } from '@/src/shared/theme/types';

const FALLBACK_THEME_ID = 'bcds';

const themeMap: Record<string, ThemeAdapter> = {
  [bcdsThemeAdapter.id]: bcdsThemeAdapter,
};

export function getThemeAdapter(themeId: string | undefined): ThemeAdapter {
  if (!themeId) return themeMap[FALLBACK_THEME_ID];
  return themeMap[themeId] ?? themeMap[FALLBACK_THEME_ID];
}

export function getDefaultThemeId(): string {
  return process.env.NEXT_PUBLIC_THEME_ID ?? FALLBACK_THEME_ID;
}

export function listAvailableThemes(): ThemeAdapter[] {
  return Object.values(themeMap);
}
