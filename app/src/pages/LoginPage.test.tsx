import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { LoginPage } from './LoginPage';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const signIn = vi.fn();
vi.mock('src/auth/AuthProvider', () => ({ useAuth: () => ({ signIn }) }));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('src/theme/ThemeProvider', () => ({ useThemeMode: () => ({ resolved: 'dark', toggle: vi.fn() }) }));

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /Přihlásit se/ }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The regression this guards: the failure used to render as an inline Alert carrying
   * whatever string the API sent — in practice .NET's "Exception of type '...' was thrown."
   */
  it('reports a failed sign-in as an error toast, not an inline banner', async () => {
    signIn.mockRejectedValue(new Error('Nesprávné uživatelské jméno nebo heslo.'));

    renderPage();
    submit();

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Nesprávné uživatelské jméno nebo heslo.', {
        variant: 'error',
      })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to a Czech message when the failure carries none', async () => {
    signIn.mockRejectedValue('not an Error');

    renderPage();
    submit();

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Přihlášení selhalo.', { variant: 'error' })
    );
  });

  it('navigates on a successful sign-in without toasting', async () => {
    signIn.mockResolvedValue(undefined);

    renderPage();
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('re-enables the submit button after a failure so the user can retry', async () => {
    signIn.mockRejectedValue(new Error('Nesprávné uživatelské jméno nebo heslo.'));

    renderPage();
    submit();

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Přihlásit se/ })).not.toBeDisabled();
  });
});
