'use client';

import { useEffect } from 'react';
import { useAppSelector } from '@/lib/store';
import { getThemeAdapter } from '@/src/shared/theme/registry';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, themeId } = useAppSelector((state) => state.theme);

  useEffect(() => {
    const adapter = getThemeAdapter(themeId);
    const tokens = adapter.tokens[mode];
    const root = document.documentElement;

    root.dataset.theme = adapter.id;
    root.dataset.themeMode = mode;
    root.style.setProperty('--app-bg', tokens.background);
    root.style.setProperty('--app-surface', tokens.surface);
    root.style.setProperty('--app-text', tokens.text);
    root.style.setProperty('--app-text-muted', tokens.textMuted);
    root.style.setProperty('--app-border', tokens.border);
    root.style.setProperty('--app-primary', tokens.primary);
    root.style.setProperty('--app-primary-text', tokens.primaryText);
    root.style.setProperty('--app-focus-ring', tokens.focusRing);
    root.style.setProperty('--app-danger', tokens.danger);
    root.style.setProperty('color-scheme', mode);
  }, [mode, themeId]);

  return <>{children}</>;
}
