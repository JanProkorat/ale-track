import type { ThemeProviderProps as MuiThemeProviderProps } from '@mui/material/styles';

import { useMemo } from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as ThemeVarsProvider } from '@mui/material/styles';

import { createTheme } from './create-theme';

import type {} from './extend-theme-types';
import type { ThemeOptions } from './types';

// ----------------------------------------------------------------------

export type ThemeProviderProps = Partial<MuiThemeProviderProps> & {
  themeOverrides?: ThemeOptions;
  locales?: object[];
};

export function ThemeProvider({ themeOverrides, locales, children, ...other }: ThemeProviderProps) {
  const theme = useMemo(() => createTheme({ themeOverrides, locales }), [themeOverrides, locales]);

  return (
    <ThemeVarsProvider disableTransitionOnChange theme={theme} {...other}>
      <CssBaseline />
      {children}
    </ThemeVarsProvider>
  );
}
