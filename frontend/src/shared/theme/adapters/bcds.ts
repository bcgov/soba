import type { ThemeAdapter } from '@/src/shared/theme/types';

export const bcdsThemeAdapter: ThemeAdapter = {
  id: 'bcds',
  displayName: 'BC Design System',
  tokens: {
    light: {
      background: '#f6f9fc',
      surface: '#ffffff',
      text: '#1a1a1a',
      textMuted: '#474543',
      border: '#d8dee3',
      primary: '#003366',
      primaryText: '#ffffff',
      focusRing: '#1a5a96',
      danger: '#ce3e39',
    },
    dark: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      text: '#f8f8f8',
      textMuted: '#d7d7d7',
      border: '#606060',
      primary: '#4f9fe8',
      primaryText: '#0f0f0f',
      focusRing: '#6eb6ff',
      danger: '#ff8080',
    },
  },
};
