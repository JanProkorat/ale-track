import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { renderWithProviders } from 'src/test/test-utils';

// ------------------------------------
// Mocks — all references must be stable (defined at module level)
// to avoid infinite useEffect loops in CurrencyPopover.
// ------------------------------------
const mockRates = [
    { currencyCode: 'CZK', rate: 1 },
    { currencyCode: 'EUR', rate: 0.04 },
];
const mockSelectedCurrency = { currencyCode: 'CZK', rate: 1 };
const mockChangeCurrency = vi.fn();

vi.mock('../../providers/currency-provider', () => ({
    useCurrency: () => ({
        rates: mockRates,
        selectedCurrency: mockSelectedCurrency,
        changeCurrency: mockChangeCurrency,
    }),
}));

const mockOnClose = vi.fn();
const mockOnOpen = vi.fn();

vi.mock('minimal-shared/hooks', () => ({
    usePopover: () => ({
        open: false,
        anchorEl: null,
        onClose: mockOnClose,
        onOpen: mockOnOpen,
    }),
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

// Stable reference — passing data inline or relying on the default `[]` param
// creates a new array each render and triggers an infinite useEffect loop.
const currencies = [
    { code: 'CZK', icon: '/flags/cs.svg' },
    { code: 'EUR', icon: '/flags/eu.svg' },
];

const emptyData: { code: string; icon: string }[] = [];

// ------------------------------------
// Tests
// ------------------------------------
describe('CurrencyPopover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Currencies button', async () => {
        const { CurrencyPopover } = await import('./currency-popover');
        const { getByLabelText } = renderWithProviders(
            <CurrencyPopover data={currencies} />,
            { theme: cssVarsTheme }
        );

        expect(getByLabelText('Currencies button')).toBeInTheDocument();
    });

    it('renders a flag image for the selected currency', async () => {
        const { CurrencyPopover } = await import('./currency-popover');
        const { container } = renderWithProviders(
            <CurrencyPopover data={currencies} />,
            { theme: cssVarsTheme }
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('alt', 'CZK');
    });

    it('renders with empty data array', async () => {
        const { CurrencyPopover } = await import('./currency-popover');
        const { getByLabelText } = renderWithProviders(
            <CurrencyPopover data={emptyData} />,
            { theme: cssVarsTheme }
        );

        expect(getByLabelText('Currencies button')).toBeInTheDocument();
    });

    it('renders the icon button as a button element', async () => {
        const { CurrencyPopover } = await import('./currency-popover');
        const { getByLabelText } = renderWithProviders(
            <CurrencyPopover data={currencies} />,
            { theme: cssVarsTheme }
        );

        const button = getByLabelText('Currencies button');
        expect(button.tagName).toBe('BUTTON');
    });
});
