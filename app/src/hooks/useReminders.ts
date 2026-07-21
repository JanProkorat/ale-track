// Generic reminder detail lookup (the endpoint isn't entity-scoped) — used by
// the reminder form to prefill on edit.

import { useQuery } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';

export function useReminderDetail(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: [...qk.reminders, 'detail', id ?? ''] as const,
    queryFn: ({ signal }) => ds.getReminderDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}
