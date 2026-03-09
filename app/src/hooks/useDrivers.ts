import type { CreateDriverDto, UpdateDriverDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const DRIVERS_KEY = 'drivers';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDrivers(search?: string) {
     return useQuery({
          queryKey: [DRIVERS_KEY, search],
          queryFn: ({ signal }) =>
               apiClient.getDriversListEndpoint(
                    search ? { LastName: `contains:${search}` } : {},
                    signal,
               ),
     });
}

export function useDriver(id: string) {
     return useQuery({
          queryKey: [DRIVERS_KEY, id],
          queryFn: ({ signal }) => apiClient.getDriverDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDriver() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateDriverDto) => apiClient.createDriverEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [DRIVERS_KEY] });
               notifyCreate('drivers');
          },
          onError: () => {
               notifyCreateError('drivers');
          },
     });
}

export function useUpdateDriver() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateDriverDto }) =>
               apiClient.updateDriverEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [DRIVERS_KEY] });
               notifyUpdate('drivers');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteDriver() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteDriverEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [DRIVERS_KEY] });
               notifyDelete('drivers');
          },
          onError: () => {
               notifyDeleteError('drivers');
          },
     });
}
