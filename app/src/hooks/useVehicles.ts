// TEMPLATE module hooks — the CRUD pattern every module copies (P4–P12).
// list → useQuery, detail → useQuery(enabled), create/update/delete → useMutation
// invalidating the resource root. Filter params flow through as the dict the
// backend expects (apiClient patches the NSwag serialization).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from 'src/api/apiClient';
import { qk } from 'src/api/queryKeys';
import { type CreateVehicleDto, type UpdateVehicleDto } from 'src/generated/api-client';

export function useVehicles(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: qk.vehicles.list(params),
    queryFn: ({ signal }) => api.getVehiclesListEndpoint(params, signal),
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: qk.vehicles.detail(id ?? ''),
    queryFn: ({ signal }) => api.getVehicleDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVehicleDto) => api.createVehicleEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vehicles.all }),
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDto }) =>
      api.updateVehicleEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.vehicles.all });
      qc.invalidateQueries({ queryKey: qk.vehicles.detail(id) });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteVehicleEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vehicles.all }),
  });
}
