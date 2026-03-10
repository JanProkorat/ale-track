import type { UpdateProductDeliveryDto, CreateProductsDeliveryDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PRODUCT_DELIVERIES_KEY = 'productDeliveries';
const MODULE_COUNTS_KEY = 'moduleCounts';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useProductDeliveries() {
     return useQuery({
          queryKey: [PRODUCT_DELIVERIES_KEY],
          queryFn: ({ signal }) => apiClient.getProductDeliveryListEndpoint({}, signal),
     });
}

export function useProductDelivery(id: string) {
     return useQuery({
          queryKey: [PRODUCT_DELIVERIES_KEY, id],
          queryFn: ({ signal }) => apiClient.getProductDeliveryDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateProductDelivery() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateProductsDeliveryDto) =>
               apiClient.createProductsDeliveryEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [PRODUCT_DELIVERIES_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyCreate('productDeliveries');
          },
          onError: () => {
               notifyCreateError('productDeliveries');
          },
     });
}

export function useUpdateProductDelivery() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateProductDeliveryDto }) =>
               apiClient.updateProductDeliveryEndpoint(id, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: [PRODUCT_DELIVERIES_KEY] });
               queryClient.invalidateQueries({ queryKey: [PRODUCT_DELIVERIES_KEY, variables.id] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyUpdate('productDeliveries');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteProductDelivery() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteProductDeliveryEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [PRODUCT_DELIVERIES_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyDelete('productDeliveries');
          },
          onError: () => {
               notifyDeleteError('productDeliveries');
          },
     });
}
