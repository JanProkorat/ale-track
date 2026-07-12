import type { CreateVehicleDto, UpdateVehicleDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const VEHICLES_KEY = 'vehicles';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVehicles(search?: string) {
     return useQuery({
          queryKey: [VEHICLES_KEY, search],
          queryFn: ({ signal }) =>
               apiClient.getVehiclesListEndpoint(search ? { Name: `contains:${search}` } : {}, signal),
     });
}

export function useVehicle(id: string) {
     return useQuery({
          queryKey: [VEHICLES_KEY, id],
          queryFn: ({ signal }) => apiClient.getVehicleDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVehicle() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateVehicleDto) => apiClient.createVehicleEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [VEHICLES_KEY] });
               notifyCreate('vehicles');
          },
          onError: () => {
               notifyCreateError('vehicles');
          },
     });
}

export function useUpdateVehicle() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDto }) =>
               apiClient.updateVehicleEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [VEHICLES_KEY] });
               notifyUpdate('vehicles');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteVehicle() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteVehicleEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [VEHICLES_KEY] });
               notifyDelete('vehicles');
          },
          onError: () => {
               notifyDeleteError('vehicles');
          },
     });
}
