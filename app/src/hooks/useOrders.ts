// Orders CRUD — same shape as useClients.ts/useVehicles.ts (list/detail/create/
// update/delete through the active data source), plus a read-only lookup for the
// order editor's history-first catalog (per-client product history).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateOrderDto, type UpdateOrderDto } from 'src/generated/api-client';

export function useOrders(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.orders.list(params),
    queryFn: ({ signal }) => ds.getOrdersListEndpoint(params, signal),
  });
}

/** Orders of a single client — the client detail's Objednávky tab. Filters
 * server-side on the client's public id rather than the denormalized name,
 * which two clients are free to share. */
export function useClientOrders(clientId: string | undefined) {
  const ds = useDataSource();
  const params = { clientId: `eq:${clientId}` };
  return useQuery({
    queryKey: qk.orders.list(params),
    queryFn: ({ signal }) => ds.getOrdersListEndpoint(params, signal),
    enabled: Boolean(clientId),
  });
}

export function useOrder(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.orders.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getOrderDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderDto) => ds.createOrderEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders.all }),
  });
}

export function useUpdateOrder() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderDto }) =>
      ds.updateOrderEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: qk.orders.detail(id) });
      // The write can also propagate the address onto (and stamp) the
      // order's shipment stop server-side. With staleTime 30s and no
      // refetch-on-focus, an editor → shipment-detail navigation inside that
      // window would otherwise show the pre-propagation address and no
      // banner — so shipment queries need invalidating too, not just orders'.
      qc.invalidateQueries({ queryKey: qk.shipments.all });
    },
  });
}

export function useDeleteOrder() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    // The endpoint is a hard "delete" by name, but per the prototype the
    // action actually cancels the order (state -> Cancelled) rather than
    // removing its history — the demo slice mirrors that.
    mutationFn: (id: string) => ds.deleteOrderEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders.all }),
  });
}

/** History-first catalog for the order editor: recently-ordered products for
 * this client plus the full catalog grouped by brewery/kind/package size. */
export function useClientProductHistory(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.productHistory(clientId ?? ''),
    queryFn: ({ signal }) => ds.getProductsByClientHistoryEndpoint(clientId!, {}, signal),
    enabled: Boolean(clientId),
  });
}
