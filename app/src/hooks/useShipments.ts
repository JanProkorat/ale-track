// Outgoing shipments (Vývozy) CRUD — same list/detail/create/update/delete
// pattern as useOrders.ts, plus a read-only lookup for the shipment editor's
// "Objednávky k rozvozu" picker (orders not already riding another shipment).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateOutgoingShipmentDto, type UpdateOutgoingShipmentDto } from 'src/generated/api-client';

export function useShipments(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.shipments.list(params),
    queryFn: ({ signal }) => ds.getOutgoingShipmentsListEndpoint(params, signal),
  });
}

export function useShipment(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.shipments.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getOutgoingShipmentDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateShipment() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOutgoingShipmentDto) => ds.createOutgoingShipmentEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipments.all }),
  });
}

export function useUpdateShipment() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOutgoingShipmentDto }) =>
      ds.updateOutgoingShipmentEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.shipments.all });
      qc.invalidateQueries({ queryKey: qk.shipments.detail(id) });
    },
  });
}

export function useDeleteShipment() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteOutgoingShipmentEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipments.all }),
  });
}

/** Orders eligible to become a stop on this shipment (or already on it, when
 * editing) — excludes orders already assigned to a *different* shipment. Pass
 * `undefined` when creating a brand-new shipment. */
export function useAvailableOrders(shipmentId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: [...qk.shipmentOrders, shipmentId ?? null],
    queryFn: ({ signal }) => ds.getOrdersListForOutgoingShipmentsEndpoint(shipmentId ?? null, {}, signal),
  });
}
