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
