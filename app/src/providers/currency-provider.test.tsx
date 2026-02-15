import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ExchangeRateDto } from 'src/api/Client';
import { act, waitFor, renderHook } from 'src/test/test-utils';

import { useCurrency, CurrencyProvider } from './currency-provider';

const mockUser = { id: 'u1', name: 'Test' };
vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}));

const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCallWithDefault: mockExecuteApiCallWithDefault,
    }),
}));

const mockGetExchangeRates = vi.fn();
vi.mock('../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        getExchangeRatesEndpoint = mockGetExchangeRates;
    },
}));

describe('CurrencyProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetExchangeRates.mockResolvedValue([
            new ExchangeRateDto({ currencyCode: 'EUR', rate: 25.5 }),
        ]);
    });

    it('should have CZK as default currency', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
        });
    });

    it('should have CZK as defaultCurrency', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.defaultCurrency.currencyCode).toBe('CZK');
            expect(result.current.defaultCurrency.rate).toBe(1);
        });
    });

    it('should fetch exchange rates on mount', async () => {
        renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(mockGetExchangeRates).toHaveBeenCalled();
        });
    });

    it('should include fetched rates plus CZK', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        const codes = result.current.rates.map(r => r.currencyCode);
        expect(codes).toContain('EUR');
        expect(codes).toContain('CZK');
    });

    it('should change currency', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        act(() => {
            result.current.changeCurrency('EUR');
        });

        expect(result.current.selectedCurrency.currencyCode).toBe('EUR');
    });

    it('should persist selected currency to localStorage', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        act(() => {
            result.current.changeCurrency('EUR');
        });

        const stored = JSON.parse(localStorage.getItem('selectedCurrency')!);
        expect(stored.currencyCode).toBe('EUR');
    });

    it('should restore currency from localStorage', async () => {
        localStorage.setItem('selectedCurrency', JSON.stringify({ currencyCode: 'EUR', rate: 25.5 }));

        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('EUR');
        });
    });

    it('should format price in CZK', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
        });

        const formatted = result.current.formatPrice(100);
        expect(formatted).toContain('100.00');
        expect(formatted).toContain('Kč');
    });

    it('should format price in EUR', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        act(() => {
            result.current.changeCurrency('EUR');
        });

        const formatted = result.current.formatPrice(255);
        expect(formatted).toContain('€');
    });

    it('should return undefined for formatPriceValue with 0', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
        });

        expect(result.current.formatPriceValue(0)).toBeUndefined();
    });

    it('should format price value in CZK (rate 1)', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
        });

        expect(result.current.formatPriceValue(100)).toBe(100);
    });

    it('should convert price to default currency', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        act(() => {
            result.current.changeCurrency('EUR');
        });

        // 10 * 25.5 = 255
        expect(result.current.formatPriceToDefault(10)).toBe(255);
    });

    it('should return empty string for undefined price', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
        });

        const formatted = result.current.formatPrice(undefined);
        expect(formatted).toContain('');
    });

    it('should fall back to CZK when unknown currency code is used', async () => {
        const { result } = renderHook(() => useCurrency(), {
            wrapper: CurrencyProvider,
        });

        await waitFor(() => {
            expect(result.current.rates.length).toBe(2);
        });

        act(() => {
            result.current.changeCurrency('GBP');
        });

        expect(result.current.selectedCurrency.currencyCode).toBe('CZK');
    });

    it('should throw error when useCurrency is used outside provider', () => {
        expect(() => {
            renderHook(() => useCurrency());
        }).toThrow('useCurrency must be used within a CurrencyProvider');
    });
});
