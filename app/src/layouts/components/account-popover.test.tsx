import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { fireEvent, renderWithProviders } from 'src/test/test-utils';

import { AccountPopover } from './account-popover';

// ------------------------------------
// Mocks
// ------------------------------------
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn();

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        signOut: mockSignOut,
        user: { name: 'admin', role: 'Admin' },
    }),
}));

vi.mock('src/routes/hooks', () => ({
    useRouter: () => ({ push: mockPush }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../dashboard', () => ({
    languages: [{ value: 'en', label: 'English', icon: '/flags/en.svg' }],
    currencies: [{ code: 'CZK', icon: '/flags/cs.svg' }],
}));

vi.mock('./language-popover', () => ({
    LanguagePopover: () => <div data-testid="language-popover" />,
}));

vi.mock('./currency-popover', () => ({
    CurrencyPopover: () => <div data-testid="currency-popover" />,
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

// ------------------------------------
// Tests
// ------------------------------------
describe('AccountPopover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the avatar button', () => {
        const { getByRole } = renderWithProviders(<AccountPopover />, { theme: cssVarsTheme });

        expect(getByRole('button')).toBeInTheDocument();
    });

    it('shows avatar with user name', () => {
        const { getByAltText } = renderWithProviders(<AccountPopover />, { theme: cssVarsTheme });

        expect(getByAltText('admin')).toBeInTheDocument();
    });

    it('opens popover when button is clicked', () => {
        const { getByRole, getByText } = renderWithProviders(
            <AccountPopover />,
            { theme: cssVarsTheme }
        );

        fireEvent.click(getByRole('button'));

        // User name should be capitalized
        expect(getByText('Admin')).toBeInTheDocument();
    });

    it('shows language and currency labels in popover', () => {
        const { getByRole, getByText } = renderWithProviders(
            <AccountPopover />,
            { theme: cssVarsTheme }
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('languages.language')).toBeInTheDocument();
        expect(getByText('common.currency')).toBeInTheDocument();
    });

    it('shows language and currency popovers in the popover', () => {
        const { getByRole, getByTestId } = renderWithProviders(
            <AccountPopover />,
            { theme: cssVarsTheme }
        );

        fireEvent.click(getByRole('button'));

        expect(getByTestId('language-popover')).toBeInTheDocument();
        expect(getByTestId('currency-popover')).toBeInTheDocument();
    });

    it('shows Logout button in popover', () => {
        const { getByRole, getByText } = renderWithProviders(
            <AccountPopover />,
            { theme: cssVarsTheme }
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('Logout')).toBeInTheDocument();
    });

    it('calls signOut when Logout is clicked', async () => {
        const { getByRole, getByText } = renderWithProviders(
            <AccountPopover />,
            { theme: cssVarsTheme }
        );

        fireEvent.click(getByRole('button'));
        fireEvent.click(getByText('Logout'));

        expect(mockSignOut).toHaveBeenCalled();
    });
});
