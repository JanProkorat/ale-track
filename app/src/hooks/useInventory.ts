import type { CreateInventoryItemDto, UpdateInventoryItemDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const INVENTORY_KEY = 'inventory';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInventoryItems() {
     return useQuery({
          queryKey: [INVENTORY_KEY],
          queryFn: ({ signal }) => apiClient.getInventoryItemsListEndpoint({}, signal),
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateInventoryItemDto) => apiClient.createInventoryItemEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyCreate('inventory');
          },
          onError: () => {
               notifyCreateError('inventory');
          },
     });
}

export function useUpdateInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
               apiClient.updateInventoryItemEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyUpdate('inventory');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteInventoryItemEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyDelete('inventory');
          },
          onError: () => {
               notifyDeleteError('inventory');
          },
     });
}
