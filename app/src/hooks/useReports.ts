import { useQuery } from '@tanstack/react-query';
import { api } from 'src/api/apiClient';
import { qk } from 'src/api/queryKeys';
import type { ReportGranularity } from 'src/generated/api-client';

/** Dashboard module counts. */
export function useModuleCounts() {
  return useQuery({
    queryKey: qk.reports,
    queryFn: ({ signal }) => api.getNumberOfRecordsInEachModuleEndpoint(signal),
  });
}

/** Upcoming (unresolved) reminders across breweries and clients, grouped by
 * section — for the dashboard "Připomínky" card and the header drawer. Pass
 * `enabled` (e.g. the drawer's open flag) to defer the fetch until needed. */
export function useUpcomingReminders(enabled = true) {
  return useQuery({
    queryKey: [...qk.reminders, 'upcoming'] as const,
    queryFn: ({ signal }) => api.getUpcomingRemindersEndpoint(signal),
    enabled,
    refetchOnWindowFocus: false,
  });
}

/** Delivered volume for the Objem tab. Only fetched while that tab is active
 * (`enabled`), so switching tabs doesn't fire every report's query at once. */
export function useDeliveryVolume(
  from: string,
  to: string,
  granularity: ReportGranularity,
  enabled = true
) {
  return useQuery({
    queryKey: qk.reportVolume({ from, to, granularity: String(granularity) }),
    queryFn: ({ signal }) => api.getDeliveryVolumeEndpoint(granularity, new Date(from), new Date(to), signal),
    enabled,
  });
}

/** Per-client and per-region delivered volume for the Klienti tab. */
export function useClientVolume(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.reportClients({ from, to }),
    queryFn: ({ signal }) => api.getClientVolumeEndpoint(new Date(from), new Date(to), signal),
    enabled,
  });
}

/** Operational figures (shipment states, punctuality, returns, drivers) for
 * the Provoz tab. */
export function useOperationsReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.reportOperations({ from, to }),
    queryFn: ({ signal }) => api.getOperationsEndpoint(new Date(from), new Date(to), signal),
    enabled,
  });
}
