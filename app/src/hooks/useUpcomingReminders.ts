import { useQuery } from '@tanstack/react-query';

import { apiClient } from 'src/api/apiClient';

const UPCOMING_REMINDERS_KEY = 'upcomingReminders';

export function useUpcomingReminders() {
     return useQuery({
          queryKey: [UPCOMING_REMINDERS_KEY],
          queryFn: ({ signal }) => apiClient.getUpcomingRemindersEndpoint(signal),
          staleTime: 2 * 60 * 1000,
     });
}
