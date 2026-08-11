// Role capability visibility — one module hook, following the useUsers CRUD
// pattern. There is no per-role or per-capability endpoint: the backend
// always reads/writes the whole set, so this module mirrors that shape.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { RoleCapabilityDto, SetRoleCapabilitiesDto } from 'src/generated/api-client';

export function useRoleCapabilities() {
  const api = useDataSource();
  return useQuery({
    queryKey: qk.roleCapabilities.all,
    queryFn: async ({ signal }) => (await api.getRoleCapabilitiesEndpoint(signal)).items ?? [],
  });
}

export function useSetRoleCapabilities() {
  const api = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: RoleCapabilityDto[]) =>
      api.setRoleCapabilitiesEndpoint(new SetRoleCapabilitiesDto({ items })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.roleCapabilities.all }),
  });
}
