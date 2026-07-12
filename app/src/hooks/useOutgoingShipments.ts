import type { CreateOutgoingShipmentDto, UpdateOutgoingShipmentDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const SHIPMENTS_KEY = 'outgoingShipments';
const MODULE_COUNTS_KEY = 'moduleCounts';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOutgoingShipments() {
     return useQuery({
          queryKey: [SHIPMENTS_KEY],
          queryFn: ({ signal }) => apiClient.getOutgoingShipmentsListEndpoint({}, signal),
     });
}

export function useOutgoingShipment(id: string) {
     return useQuery({
          queryKey: [SHIPMENTS_KEY, id],
          queryFn: ({ signal }) => apiClient.getOutgoingShipmentDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

export function useOutgoingShipmentOrders(shipmentId: string | null | undefined) {
     return useQuery({
          queryKey: [SHIPMENTS_KEY, 'orders', shipmentId ?? 'new'],
          queryFn: ({ signal }) =>
               apiClient.getOrdersListForOutgoingShipmentsEndpoint(
                    shipmentId ?? undefined,
                    {},
                    signal,
               ),
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateOutgoingShipment() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateOutgoingShipmentDto) =>
               apiClient.createOutgoingShipmentEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyCreate('outgoingShipments');
          },
          onError: () => {
               notifyCreateError('outgoingShipments');
          },
     });
}

export function useUpdateOutgoingShipment() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateOutgoingShipmentDto }) =>
               apiClient.updateOutgoingShipmentEndpoint(id, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
               queryClient.invalidateQueries({ queryKey: [SHIPMENTS_KEY, variables.id] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyUpdate('outgoingShipments');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteOutgoingShipment() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteOutgoingShipmentEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
               queryClient.invalidateQueries({ queryKey: [MODULE_COUNTS_KEY] });
               notifyDelete('outgoingShipments');
          },
          onError: () => {
               notifyDeleteError('outgoingShipments');
          },
     });
}
