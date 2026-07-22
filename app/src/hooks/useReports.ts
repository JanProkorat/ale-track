import { useQuery } from '@tanstack/react-query';
import { api } from 'src/api/apiClient';
import { qk } from 'src/api/queryKeys';

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
