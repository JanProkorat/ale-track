import { useQuery } from '@tanstack/react-query';

import { apiClient } from 'src/api/apiClient';

const EXCHANGE_RATES_KEY = 'exchangeRates';

export function useExchangeRates() {
     return useQuery({
          queryKey: [EXCHANGE_RATES_KEY],
          queryFn: ({ signal }) => apiClient.getExchangeRatesEndpoint(signal),
          staleTime: 10 * 60 * 1000,
     });
}
