import { useQuery } from '@tanstack/react-query';
import { api } from 'src/api/apiClient';
import { qk } from 'src/api/queryKeys';

/** Daily exchange rates (CZK base). Wired into CurrencyProvider in P3. */
export function useExchangeRates(enabled = true) {
  return useQuery({
    queryKey: qk.exchangeRates,
    queryFn: ({ signal }) => api.getExchangeRatesEndpoint(signal),
    enabled,
    staleTime: 1000 * 60 * 60, // an hour — it changes at most daily
  });
}

/** CZK per 1 EUR from the rates list, or a fallback. */
export function eurRateFromList(
  rates: { currencyCode?: string; rate?: number }[] | undefined,
  fallback = 25.3
): number {
  return rates?.find((r) => r.currencyCode === 'EUR')?.rate ?? fallback;
}
