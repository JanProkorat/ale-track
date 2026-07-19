import { type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { theme } from './theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <MuiThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      {children}
    </MuiThemeProvider>
  );
}

/** Toggle between light and dark. `mode` may be 'system' initially. */
export function useThemeMode() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = mode === 'system' ? (systemMode ?? 'light') : (mode ?? 'light');
  const toggle = () => setMode(resolved === 'dark' ? 'light' : 'dark');
  return { resolved, toggle };
}
