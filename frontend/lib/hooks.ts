import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { setMode, setTheme, toggleMode } from './slices/themeSlice';
import type { ThemeMode } from '@/src/shared/theme/types';
import { getDefaultThemeId } from '@/src/shared/theme/registry';

// useDark hook: provides current value and toggles, persists to localStorage and applies document attribute
export function useDark() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.theme.mode);
  const themeId = useAppSelector((state) => state.theme.themeId);
  const isDark = mode === 'dark';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMode = window.localStorage.getItem('theme-mode');
      const storedTheme = window.localStorage.getItem('theme-id');

      if (storedMode === 'light' || storedMode === 'dark') {
        dispatch(setMode(storedMode));
      } else {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        dispatch(setMode(mq.matches ? 'dark' : 'light'));
      }

      dispatch(setTheme(storedTheme ?? getDefaultThemeId()));
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme-mode', mode);
      window.localStorage.setItem('theme-id', themeId);
    }
  }, [mode, themeId]);

  const toggle = () => dispatch(toggleMode());
  const setColorMode = (value: ThemeMode) => dispatch(setMode(value));
  const setThemeId = (value: string) => dispatch(setTheme(value));

  return { isDark, mode, themeId, toggle, setDark: (v: boolean) => setColorMode(v ? 'dark' : 'light'), setThemeId };
}
