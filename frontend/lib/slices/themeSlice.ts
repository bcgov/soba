import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getDefaultThemeId } from '@/src/shared/theme/registry';
import type { ThemeMode } from '@/src/shared/theme/types';

export type ThemeState = {
  mode: ThemeMode;
  themeId: string;
};

const initialState: ThemeState = {
  // Keep initial render deterministic for SSR/CSR hydration.
  // Client preference is applied in `useDark()` after mount.
  mode: 'light',
  themeId: getDefaultThemeId(),
};

const slice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setMode(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
    },
    toggleMode(state) {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
    },
    setTheme(state, action: PayloadAction<string>) {
      state.themeId = action.payload;
    },
  },
});

export const { setMode, toggleMode, setTheme } = slice.actions;

export default slice.reducer;
