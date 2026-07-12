import LoginPage from 'src/pages/LoginPage';
import { screen, waitFor, userEvent, renderWithProviders } from 'src/test/test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockShowError = vi.fn();

vi.mock('react-router-dom', async () => {
     const actual = await vi.importActual('react-router-dom');
     return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('src/hooks/useAuth', () => ({
     default: () => ({ login: mockLogin }),
}));

vi.mock('src/hooks/useNotification', () => ({
     useNotification: () => ({ showError: mockShowError }),
}));

vi.mock('src/components/layout/LanguageSwitcher', () => ({
     default: () => <div data-testid="language-switcher" />,
}));

vi.mock('src/components/layout/ThemeModeSwitcher', () => ({
     default: () => <div data-testid="theme-switcher" />,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('renders login form with username and password fields', () => {
          renderWithProviders(<LoginPage />);

          expect(screen.getByLabelText('auth.username')).toBeInTheDocument();
          expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
     });

     it('submit button is disabled when fields are empty', () => {
          renderWithProviders(<LoginPage />);

          const button = screen.getByRole('button', { name: 'auth.login' });
          expect(button).toBeDisabled();
     });

     it('submit button is disabled when only username is filled', async () => {
          const user = userEvent.setup();
          renderWithProviders(<LoginPage />);

          await user.type(screen.getByLabelText('auth.username'), 'testuser');

          const button = screen.getByRole('button', { name: 'auth.login' });
          expect(button).toBeDisabled();
     });

     it('submit button is enabled when both fields are filled', async () => {
          const user = userEvent.setup();
          renderWithProviders(<LoginPage />);

          await user.type(screen.getByLabelText('auth.username'), 'testuser');
          await user.type(screen.getByLabelText('auth.password'), 'password123');

          const button = screen.getByRole('button', { name: 'auth.login' });
          expect(button).toBeEnabled();
     });

     it('toggles password visibility when clicking the eye icon', async () => {
          const user = userEvent.setup();
          renderWithProviders(<LoginPage />);

          const passwordInput = screen.getByLabelText('auth.password');
          expect(passwordInput).toHaveAttribute('type', 'password');

          const toggleButton = passwordInput.closest('.MuiInputBase-root')!.querySelector('button')!;
          await user.click(toggleButton);

          expect(passwordInput).toHaveAttribute('type', 'text');

          await user.click(toggleButton);

          expect(passwordInput).toHaveAttribute('type', 'password');
     });

     it('calls login and navigates on successful submit', async () => {
          mockLogin.mockResolvedValueOnce(undefined);
          const user = userEvent.setup();
          renderWithProviders(<LoginPage />);

          await user.type(screen.getByLabelText('auth.username'), 'testuser');
          await user.type(screen.getByLabelText('auth.password'), 'password123');
          await user.click(screen.getByRole('button', { name: 'auth.login' }));

          await waitFor(() => {
               expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
          });

          await waitFor(() => {
               expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
          });
     });

     it('shows error notification on login failure', async () => {
          mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
          const user = userEvent.setup();
          renderWithProviders(<LoginPage />);

          await user.type(screen.getByLabelText('auth.username'), 'testuser');
          await user.type(screen.getByLabelText('auth.password'), 'wrongpass');
          await user.click(screen.getByRole('button', { name: 'auth.login' }));

          await waitFor(() => {
               expect(mockShowError).toHaveBeenCalledWith('auth.loginError');
          });

          expect(mockNavigate).not.toHaveBeenCalled();
     });

     it('renders theme mode switcher', () => {
          renderWithProviders(<LoginPage />);

          expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
     });

     it('renders language switcher', () => {
          renderWithProviders(<LoginPage />);

          expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
     });
});
