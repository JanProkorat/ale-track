// Product deliveries (Dovozy zboží) CRUD — same list/detail/create/update/
// delete pattern as useShipments.ts. Incoming goods: drivers drive to breweries,
// pick up products, and stock them into inventory. Setting state to Finished on
// update auto-fills inventory (backend CreateInventoryItemsAsync).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateProductsDeliveryDto, type UpdateProductDeliveryDto } from 'src/generated/api-client';

export function useDeliveries(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.deliveries.list(params),
    queryFn: ({ signal }) => ds.getProductDeliveryListEndpoint(params, signal),
  });
}

export function useDelivery(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.deliveries.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getProductDeliveryDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateDelivery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductsDeliveryDto) => ds.createProductsDeliveryEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.deliveries.all }),
  });
}

export function useUpdateDelivery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDeliveryDto }) =>
      ds.updateProductDeliveryEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.deliveries.all });
      qc.invalidateQueries({ queryKey: qk.deliveries.detail(id) });
      // Finishing a delivery stocks inventory — keep those views fresh too.
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useDeleteDelivery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteProductDeliveryEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.deliveries.all }),
  });
}
