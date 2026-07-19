import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateProductsDto, type UpdateProductDto } from 'src/generated/api-client';

/** The brewery's ceník (price list). */
export function useBreweryProducts(breweryId: string | undefined, params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweryProducts(breweryId ?? '', params),
    queryFn: ({ signal }) => ds.getBreweryProductsListEndpoint(breweryId!, params, signal),
    enabled: Boolean(breweryId),
  });
}

/** Create one or more products under a brewery (the API takes a batch). */
export function useCreateProducts(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductsDto) => ds.createProductsEndpoint(breweryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

export function useUpdateProduct(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) => ds.updateProductEndpoint(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

export function useDeleteProduct(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteProductEndpoint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}
