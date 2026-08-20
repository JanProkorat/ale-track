// Client delivery places — named drop-off addresses saved on a client, picked
// as a shipment stop's destination instead of re-typing an address each time.
// Mutations also invalidate the shipment editor's available-orders lookup
// (`qk.shipmentOrders`) so a place created inline from that editor shows up in
// the stop picker without a reload.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type SaveClientDeliveryPlaceDto } from 'src/generated/api-client';

export function useClientDeliveryPlaces(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clientDeliveryPlaces(clientId ?? ''),
    queryFn: ({ signal }) => ds.getClientDeliveryPlacesEndpoint(clientId!, signal),
    enabled: !!clientId,
  });
}

export function useCreateDeliveryPlace() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: SaveClientDeliveryPlaceDto }) =>
      ds.createClientDeliveryPlaceEndpoint(clientId, data),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientDeliveryPlaces(clientId) });
      qc.invalidateQueries({ queryKey: qk.shipmentOrders });
    },
  });
}

export function useUpdateDeliveryPlace() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; clientId: string; data: SaveClientDeliveryPlaceDto }) =>
      ds.updateClientDeliveryPlaceEndpoint(id, data),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientDeliveryPlaces(clientId) });
      qc.invalidateQueries({ queryKey: qk.shipmentOrders });
    },
  });
}

export function useDeleteDeliveryPlace() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; clientId: string }) => ds.deleteClientDeliveryPlaceEndpoint(id),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientDeliveryPlaces(clientId) });
      qc.invalidateQueries({ queryKey: qk.shipmentOrders });
    },
  });
}
