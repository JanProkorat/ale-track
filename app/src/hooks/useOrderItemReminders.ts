import { useQuery } from '@tanstack/react-query';

import { apiClient } from 'src/api/apiClient';

const ORDER_ITEM_REMINDERS_KEY = 'orderItemReminders';

export function useOrderItemReminders() {
     return useQuery({
          queryKey: [ORDER_ITEM_REMINDERS_KEY],
          queryFn: ({ signal }) => apiClient.getOrderItemsRemindersListEndpoint(signal),
          staleTime: 2 * 60 * 1000,
     });
}
