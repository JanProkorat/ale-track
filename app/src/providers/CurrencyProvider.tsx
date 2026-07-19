import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Currency = 'CZK' | 'EUR';

const STORAGE_KEY = 'aletrack.currency';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** CZK per 1 EUR. Static in P1; sourced from GET /exchange-rates in P2. */
  eurRate: number;
  rateUpdatedAt: string; // ISO date
  /** Format a CZK-base amount into the active display currency. */
  formatMoney: (czk: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const EUR_RATE = 25.3;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(STORAGE_KEY) as Currency) || 'CZK'
  );

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
        }).format(czk / EUR_RATE)} €`;
      }
      return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(czk)} Kč`;
    };
    return {
      currency,
      setCurrency,
      eurRate: EUR_RATE,
      rateUpdatedAt: new Date().toISOString().slice(0, 10),
      formatMoney,
    };
  }, [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within <CurrencyProvider>');
  return ctx;
}
