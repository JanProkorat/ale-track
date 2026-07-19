// Clients CRUD — same shape as useBreweries.ts (list/detail/create/update/delete
// through the active data source, invalidating the `clients` resource root).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateClientDto, type UpdateClientDto } from 'src/generated/api-client';

export function useClients(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clients.list(params),
    queryFn: ({ signal }) => ds.getClientListEndpoint(params, signal),
  });
}

export function useClient(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clients.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getClientDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientDto) => ds.createClientEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients.all }),
  });
}

export function useUpdateClient() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
      ds.updateClientEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.clients.all });
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
    },
  });
}

export function useDeleteClient() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteClientEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients.all }),
  });
}
