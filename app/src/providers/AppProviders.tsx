import { type ReactNode } from 'react';
import { SnackbarProvider } from 'notistack';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/cs';
import { ThemeProvider } from 'src/theme/ThemeProvider';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from 'src/auth/AuthProvider';
import { CurrencyProvider } from './CurrencyProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
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
      </LocalizationProvider>
    </ThemeProvider>
  );
}
