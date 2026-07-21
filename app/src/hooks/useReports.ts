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
 * section — for the dashboard "Připomínky" card. */
export function useUpcomingReminders() {
  return useQuery({
    queryKey: [...qk.reminders, 'upcoming'] as const,
    queryFn: ({ signal }) => api.getUpcomingRemindersEndpoint(signal),
  });
}
