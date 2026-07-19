import { type ReactNode } from 'react';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from 'src/theme/ThemeProvider';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from 'src/auth/AuthProvider';
import { CurrencyProvider } from './CurrencyProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <CurrencyProvider>
            <SnackbarProvider
              maxSnack={3}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              autoHideDuration={2800}
            >
              {children}
            </SnackbarProvider>
          </CurrencyProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
