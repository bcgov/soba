export type ThemeMode = 'light' | 'dark';

export type ThemeTokens = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  focusRing: string;
  danger: string;
};

export type ThemeAdapter = {
  id: string;
  displayName: string;
  tokens: Record<ThemeMode, ThemeTokens>;
};
