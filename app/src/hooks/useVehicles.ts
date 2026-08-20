// TEMPLATE module hooks — the CRUD pattern every module copies (P4–P12).
// list → useQuery, detail → useQuery(enabled), create/update/delete → useMutation
// invalidating the resource root. Calls go through useDataSource() so the same
// hooks serve both live (API) and demo (in-memory) sessions.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateVehicleDto, type UpdateVehicleDto } from 'src/generated/api-client';

export function useVehicles(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.vehicles.list(params),
    queryFn: ({ signal }) => ds.getVehiclesListEndpoint(params, signal),
  });
}

export function useVehicle(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.vehicles.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getVehicleDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateVehicle() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVehicleDto) => ds.createVehicleEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vehicles.all }),
  });
}

export function useUpdateVehicle() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDto }) =>
      ds.updateVehicleEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.vehicles.all });
      qc.invalidateQueries({ queryKey: qk.vehicles.detail(id) });
    },
  });
}

export function useDeleteVehicle() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteVehicleEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vehicles.all }),
  });
}
