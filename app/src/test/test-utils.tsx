import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Create a default theme for testing
const defaultTheme = createTheme();

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: ReturnType<typeof createTheme>;
}

/**
 * Custom render function that wraps components with necessary providers
 * for testing (ThemeProvider, etc.)
 */
export function renderWithProviders(
  ui: ReactElement,
  { theme = defaultTheme, ...renderOptions }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
