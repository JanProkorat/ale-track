import type { CreateOrderDto, UpdateOrderDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const ORDERS_KEY = 'orders';
const MODULE_COUNTS_KEY = 'moduleCounts';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOrders() {
     return useQuery({
          queryKey: [ORDERS_KEY],
          queryFn: ({ signal }) => apiClient.getOrdersListEndpoint({}, signal),
     });
}

export function useOrder(id: string) {
     return useQuery({
          queryKey: [ORDERS_KEY, id],
          queryFn: ({ signal }) => apiClient.getOrderDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateOrder() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateOrderDto) => apiClient.createOrderEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyCreate('orders');
          },
          onError: () => {
               notifyCreateError('orders');
          },
     });
}

export function useUpdateOrder() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateOrderDto }) =>
               apiClient.updateOrderEndpoint(id, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
               queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, variables.id] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyUpdate('orders');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteOrder() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteOrderEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyDelete('orders');
          },
          onError: () => {
               notifyDeleteError('orders');
          },
     });
}
