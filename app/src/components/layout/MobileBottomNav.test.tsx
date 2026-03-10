import userEvent from '@testing-library/user-event';

import { screen, renderWithProviders } from 'src/test/test-utils';

import MobileBottomNav from './MobileBottomNav';

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

describe('MobileBottomNav', () => {
     it('renders bottom navigation actions for mobile nav items', () => {
          renderWithProviders(<MobileBottomNav />);
          expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
          expect(screen.getByText('nav.clients')).toBeInTheDocument();
          expect(screen.getByText('nav.orders')).toBeInTheDocument();
          expect(screen.getByText('nav.breweries')).toBeInTheDocument();
     });

     it('renders "More" button', () => {
          renderWithProviders(<MobileBottomNav />);
          expect(screen.getByText('nav.more')).toBeInTheDocument();
     });

     it('shows user name in the more drawer after opening it', async () => {
          const user = userEvent.setup();
          renderWithProviders(<MobileBottomNav />);

          await user.click(screen.getByText('nav.more'));

          expect(screen.getByText('John Doe')).toBeInTheDocument();
     });

     it('shows logout button in more drawer', async () => {
          const user = userEvent.setup();
          renderWithProviders(<MobileBottomNav />);

          await user.click(screen.getByText('nav.more'));

          expect(screen.getByText('auth.logout')).toBeInTheDocument();
     });
});
