// Drivers (Řidiči) module hooks — same CRUD pattern as useVehicles.ts.
// list → useQuery, detail → useQuery(enabled), create/update/delete → useMutation
// invalidating the resource root. Calls go through useDataSource() so the same
// hooks serve both live (API) and demo (in-memory) sessions.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateDriverDto, type UpdateDriverDto } from 'src/generated/api-client';

export function useDrivers(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.drivers.list(params),
    queryFn: ({ signal }) => ds.getDriversListEndpoint(params, signal),
  });
}

export function useDriver(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.drivers.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getDriverDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateDriver() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDriverDto) => ds.createDriverEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.drivers.all }),
  });
}

export function useUpdateDriver() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDriverDto }) =>
      ds.updateDriverEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.drivers.all });
      qc.invalidateQueries({ queryKey: qk.drivers.detail(id) });
    },
  });
}

export function useDeleteDriver() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteDriverEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.drivers.all }),
  });
}
