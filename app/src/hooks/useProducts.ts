import type { UpdateProductDto, CreateProductsDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PRODUCTS_KEY = 'products';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useProducts(search?: string) {
     return useQuery({
          queryKey: [PRODUCTS_KEY, search],
          queryFn: ({ signal }) =>
               apiClient.getProductsListEndpoint(search ? { Name: `contains:${search}` } : {}, signal),
     });
}

export function useProduct(id: string) {
     return useQuery({
          queryKey: [PRODUCTS_KEY, id],
          queryFn: ({ signal }) => apiClient.getProductDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateProducts() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: ({ breweryId, data }: { breweryId: string; data: CreateProductsDto }) =>
               apiClient.createProductsEndpoint(breweryId, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
               queryClient.invalidateQueries({ queryKey: ['breweries'] });
               notifyCreate('products');
          },
          onError: () => {
               notifyCreateError('products');
          },
     });
}

export function useUpdateProduct() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) =>
               apiClient.updateProductEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
               queryClient.invalidateQueries({ queryKey: ['breweries'] });
               notifyUpdate('products');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteProduct() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteProductEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
               queryClient.invalidateQueries({ queryKey: ['breweries'] });
               notifyDelete('products');
          },
          onError: () => {
               notifyDeleteError('products');
          },
     });
}
