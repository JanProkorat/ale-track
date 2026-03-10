import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useContext, useCallback, createContext } from 'react';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CurrencyCode = 'CZK' | 'EUR';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
     CZK: 'Kč',
     EUR: '€',
};

export function currencySymbol(code: string): string {
     return CURRENCY_SYMBOLS[code as CurrencyCode] ?? code;
}

interface CurrencyContextValue {
     /** Currently selected currency */
     currency: CurrencyCode;
     /** Switch to a different currency */
     setCurrency: (code: CurrencyCode) => void;
     /**
      * Format a price value (assumed to be in CZK) to the selected currency.
      * Returns a formatted string like "123.45 CZK" or "5.12 EUR".
      */
     formatPrice: (czk: number | undefined | null) => string;
     /** Convert a CZK amount to the selected currency (raw number) */
     convert: (czk: number) => number;
     /** Convert an amount in the selected currency back to CZK */
     toCzk: (amount: number) => number;
     /** Whether exchange rates are still loading */
     isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
     currency: 'CZK',
     setCurrency: () => {},
     formatPrice: () => '-',
     convert: (v) => v,
     toCzk: (v) => v,
     isLoading: false,
});

export function useCurrency() {
     return useContext(CurrencyContext);
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'preferredCurrency';

function getInitialCurrency(): CurrencyCode {
     const stored = localStorage.getItem(STORAGE_KEY);
     if (stored === 'EUR' || stored === 'CZK') return stored;
     return 'CZK';
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function CurrencyProvider({ children }: { children: React.ReactNode }) {
     const [currency, setCurrencyState] = useState<CurrencyCode>(getInitialCurrency);

     const { data: rates = [], isLoading } = useQuery({
          queryKey: ['exchangeRates'],
          queryFn: ({ signal }) => apiClient.getExchangeRatesEndpoint(signal),
          staleTime: 1000 * 60 * 60, // 1 hour — rates update once per day
     });

     const eurRate = useMemo(() => {
          const eur = rates.find((r) => r.currencyCode === 'EUR');
          return eur?.rate ?? null;
     }, [rates]);

     const setCurrency = useCallback((code: CurrencyCode) => {
          setCurrencyState(code);
          localStorage.setItem(STORAGE_KEY, code);
     }, []);

     const convert = useCallback(
          (czk: number): number => {
               if (currency === 'CZK' || !eurRate) return czk;
               return czk / eurRate;
          },
          [currency, eurRate],
     );

     const toCzk = useCallback(
          (amount: number): number => {
               if (currency === 'CZK' || !eurRate) return amount;
               return amount * eurRate;
          },
          [currency, eurRate],
     );

     const formatPrice = useCallback(
          (czk: number | undefined | null): string => {
               if (czk == null) return '-';
               const value = convert(czk);
               return `${value.toFixed(2)} ${CURRENCY_SYMBOLS[currency]}`;
          },
          [convert, currency],
     );

     const value = useMemo<CurrencyContextValue>(
          () => ({ currency, setCurrency, formatPrice, convert, toCzk, isLoading }),
          [currency, setCurrency, formatPrice, convert, toCzk, isLoading],
     );

     return (
          <CurrencyContext.Provider value={value}>
               {children}
          </CurrencyContext.Provider>
     );
}
