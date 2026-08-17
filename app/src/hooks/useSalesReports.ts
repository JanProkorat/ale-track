import { useQuery } from '@tanstack/react-query';
import { api } from 'src/api/apiClient';
import { qk } from 'src/api/queryKeys';
import type { ReportGranularity } from 'src/generated/api-client';

/** Revenue, trend, payment split and outstanding invoices for the Tržby tab. Only fetched
 * while that tab is active (`enabled`), so switching tabs doesn't fire every query at once. */
export function useGarageSalesRevenue(
  from: string,
  to: string,
  granularity: ReportGranularity,
  enabled = true
) {
  return useQuery({
    queryKey: qk.salesReportRevenue({ from, to, granularity: String(granularity) }),
    queryFn: ({ signal }) =>
      api.getGarageSalesRevenueEndpoint(granularity, new Date(from), new Date(to), signal),
    enabled,
  });
}

/** Product movement, discounts and stock coverage for the Zboží tab. */
export function useGarageSalesProducts(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.salesReportProducts({ from, to }),
    queryFn: ({ signal }) => api.getGarageSalesProductsEndpoint(new Date(from), new Date(to), signal),
    enabled,
  });
}

/** Buyer mix and top clients for the Kupující tab. */
export function useGarageSalesBuyers(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.salesReportBuyers({ from, to }),
    queryFn: ({ signal }) => api.getGarageSalesBuyersEndpoint(new Date(from), new Date(to), signal),
    enabled,
  });
}
