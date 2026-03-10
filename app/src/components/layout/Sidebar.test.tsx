
import { screen, renderWithProviders } from 'src/test/test-utils';

import Sidebar from './Sidebar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
     useLocation: () => ({ pathname: '/' }),
     useNavigate: () => mockNavigate,
}));

vi.mock('src/hooks/useAuth', () => ({
     default: () => ({
          user: { firstName: 'John', lastName: 'Doe', userName: 'jdoe' },
          isAdmin: true,
          logout: mockLogout,
     }),
}));

vi.mock('src/providers/UnsavedChangesProvider', () => ({
     useUnsavedChanges: () => ({
          isDirty: false,
          setDirty: vi.fn(),
          navigate: (cb: () => void) => cb(),
     }),
}));

vi.mock('src/components/layout/ThemeModeSwitcher', () => ({
     default: () => <div data-testid="theme-mode-switcher" />,
}));

vi.mock('src/components/layout/InlineLanguageSwitcher', () => ({
     default: () => <div data-testid="inline-language-switcher" />,
}));

vi.mock('src/components/layout/InlineCurrencySwitcher', () => ({
     default: () => <div data-testid="inline-currency-switcher" />,
}));

beforeEach(() => {
     vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
     const defaultProps = {
          open: true,
          onClose: vi.fn(),
          variant: 'permanent' as const,
     };

     it('renders "AleTrack" logo text when not mini', () => {
          renderWithProviders(<Sidebar {...defaultProps} />);
          expect(screen.getByText('AleTrack')).toBeInTheDocument();
     });

     it('renders nav items with translated labels', () => {
          renderWithProviders(<Sidebar {...defaultProps} />);
          expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
          expect(screen.getByText('nav.clients')).toBeInTheDocument();
     });

     it('shows user initials "JD" in avatar', () => {
          renderWithProviders(<Sidebar {...defaultProps} />);
          expect(screen.getByText('JD')).toBeInTheDocument();
     });

     it('shows logout button with "auth.logout" text', () => {
          renderWithProviders(<Sidebar {...defaultProps} />);
          expect(screen.getByText('auth.logout')).toBeInTheDocument();
     });

     it('hides admin-only items when isAdmin is false', async () => {
          const useAuthModule = await import('src/hooks/useAuth');
          const useAuthSpy = vi.spyOn(useAuthModule, 'default');
          useAuthSpy.mockReturnValue({
               user: { firstName: 'John', lastName: 'Doe', userName: 'jdoe' },
               isAdmin: false,
               logout: mockLogout,
          } as any);

          renderWithProviders(<Sidebar {...defaultProps} />);
          expect(screen.queryByText('nav.users')).not.toBeInTheDocument();

          useAuthSpy.mockRestore();
     });

     it('renders badge count when badgeCounts provided', () => {
          renderWithProviders(<Sidebar {...defaultProps} badgeCounts={{ clients: 5 }} />);
          expect(screen.getByText('5')).toBeInTheDocument();
     });
});
