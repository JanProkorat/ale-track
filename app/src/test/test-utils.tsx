import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react';

import { render } from '@testing-library/react';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// renderWithProviders — wraps with ThemeProvider
// ---------------------------------------------------------------------------

const theme = createTheme();

function AllProviders({ children }: { children: React.ReactNode }) {
     return (
          <ThemeProvider theme={theme}>
               <CssBaseline />
               {children}
          </ThemeProvider>
     );
}

export function renderWithProviders(
     ui: ReactElement,
     options?: Omit<RenderOptions, 'wrapper'>,
) {
     return render(ui, { wrapper: AllProviders, ...options });
}
