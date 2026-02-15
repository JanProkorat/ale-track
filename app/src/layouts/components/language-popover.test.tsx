import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { renderWithProviders } from 'src/test/test-utils';

import { LanguagePopover } from './language-popover';

// ------------------------------------
// Mocks
// ------------------------------------
const mockChangeLanguage = vi.fn();
vi.mock('i18next', () => ({
    default: {
        language: 'en',
        changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args),
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('minimal-shared/hooks', () => {
    let openState = false;
    let anchorState: HTMLElement | null = null;
    return {
        usePopover: () => ({
            open: openState,
            anchorEl: anchorState,
            onClose: () => {
                openState = false;
                anchorState = null;
            },
            onOpen: (e: React.MouseEvent<HTMLElement>) => {
                openState = true;
                anchorState = e.currentTarget;
            },
        }),
    };
});

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

const languages = [
    { value: 'en', label: 'English', icon: '/flags/en.svg' },
    { value: 'cs', label: 'Czech', icon: '/flags/cs.svg' },
    { value: 'de', label: 'German', icon: '/flags/de.svg' },
];

// ------------------------------------
// Tests
// ------------------------------------
describe('LanguagePopover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders the Languages button', () => {
        const { getByLabelText } = renderWithProviders(
            <LanguagePopover data={languages} />,
            { theme: cssVarsTheme }
        );

        expect(getByLabelText('Languages button')).toBeInTheDocument();
    });

    it('renders a flag image for the current language', () => {
        const { container } = renderWithProviders(
            <LanguagePopover data={languages} />,
            { theme: cssVarsTheme }
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
    });

    it('uses localStorage value as initial locale', () => {
        localStorage.setItem('i18nextLng', 'cs');

        const { container } = renderWithProviders(
            <LanguagePopover data={languages} />,
            { theme: cssVarsTheme }
        );

        const img = container.querySelector('img');
        expect(img).toHaveAttribute('alt', 'Czech');
    });

    it('renders with empty data array', () => {
        const { getByLabelText } = renderWithProviders(
            <LanguagePopover />,
            { theme: cssVarsTheme }
        );

        expect(getByLabelText('Languages button')).toBeInTheDocument();
    });
});
