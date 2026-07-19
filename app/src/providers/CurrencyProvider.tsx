import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from 'src/auth/AuthProvider';
import { useExchangeRates, eurRateFromList } from 'src/hooks/useExchangeRates';

export type Currency = 'CZK' | 'EUR';

const STORAGE_KEY = 'aletrack.currency';
const FALLBACK_EUR_RATE = 25.3;

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** CZK per 1 EUR — live from GET /exchange-rates when signed in, else fallback. */
  eurRate: number;
  rateUpdatedAt: string;
  /** Format a CZK-base amount into the active display currency. */
  formatMoney: (czk: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isDemo } = useAuth();
  const { data: rates } = useExchangeRates(isAuthenticated && !isDemo);
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(STORAGE_KEY) as Currency) || 'CZK'
  );

  const eurRate = eurRateFromList(rates, FALLBACK_EUR_RATE);

  const value = useMemo<CurrencyContextValue>(() => {
    const setCurrency = (c: Currency) => {
      localStorage.setItem(STORAGE_KEY, c);
      setCurrencyState(c);
    };
    const formatMoney = (czk: number | null | undefined) => {
      if (czk == null) return '—';
      if (currency === 'EUR') {
        return `${new Intl.NumberFormat('cs-CZ', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(czk / eurRate)} €`;
      }
      return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(czk)} Kč`;
    };
    return {
      currency,
      setCurrency,
      eurRate,
      rateUpdatedAt: new Date().toISOString().slice(0, 10),
      formatMoney,
    };
  }, [currency, eurRate]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within <CurrencyProvider>');
  return ctx;
}
