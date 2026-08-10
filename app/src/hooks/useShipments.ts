// Outgoing shipments (Vývozy) CRUD — same list/detail/create/update/delete
// pattern as useOrders.ts, plus a read-only lookup for the shipment editor's
// "Objednávky k rozvozu" picker (orders not already riding another shipment).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  SetPreparationStepDto,
  type CreateOutgoingShipmentDto,
  type OutgoingShipmentDetailDto,
  type UpdateOutgoingShipmentDto,
} from 'src/generated/api-client';

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

/** Clears the `addressChangedAt` stamp on every stop of this shipment once the
 * planner has seen the AddressChangedBanner's notice — see the banner in
 * src/features/shipments/AddressChangedBanner.tsx. */
export function useAcknowledgeAddressChanges() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shipmentId: string) => ds.acknowledgeAddressChangesEndpoint(shipmentId),

    // Dismissing a notice is the one thing that should never feel like it is
    // thinking about it, so clear the stamps in the cache up front: the banner
    // reads `addressChangedAt` off this query on both the detail and the
    // editor, so it disappears on click rather than after a server round trip.
    // Returns the previous shipment for rollback — without it a rejected call
    // (a 403, a dropped connection) would leave the banner gone while the
    // server still holds the stamp, and it would silently reappear on the next
    // refetch.
    onMutate: async (shipmentId: string) => {
      const key = qk.shipments.detail(shipmentId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(key);
      if (previous) {
        qc.setQueryData<OutgoingShipmentDetailDto>(key, {
          ...previous,
          stops: (previous.stops ?? []).map((s) => ({ ...s, addressChangedAt: undefined })),
        } as OutgoingShipmentDetailDto);
      }
      return { previous, key };
    },

    onError: (_err, _shipmentId, context) => {
      if (context?.previous) qc.setQueryData(context.key, context.previous);
    },

    // Reconcile with the server either way: on success to pick up anything that
    // changed alongside, on failure to undo a rollback that guessed wrong.
    onSettled: (_res, _err, shipmentId) => {
      qc.invalidateQueries({ queryKey: qk.shipments.all });
      qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId) });
    },
  });
}

export interface SetPreparationStepArgs {
  stepId: string;
  isDone: boolean;
}

/**
 * Ticks one step of the shipment's preparation checklist.
 *
 * Its own endpoint rather than a field on the full shipment PUT, so ticking a box never
 * rewrites the rest of the run. Optimistic for the same reason the nakládka toggles are: the
 * boxes are worked through one after another, and a checkbox that only moves after the round
 * trip invites a second click.
 */
export function useSetPreparationStep(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: ({ stepId, isDone }: SetPreparationStepArgs) =>
      ds.setPreparationStepEndpoint(shipmentId!, stepId, new SetPreparationStepDto({ isDone })),

    onMutate: async ({ stepId, isDone }: SetPreparationStepArgs) => {
      if (!shipmentId) return undefined;

      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      // Cloned through the prototype so the patched value stays an
      // OutgoingShipmentDetailDto — a plain spread would lose its methods.
      const next = Object.assign(
        Object.create(Object.getPrototypeOf(previous)) as OutgoingShipmentDetailDto,
        previous,
      );
      next.preparationSteps = (previous.preparationSteps ?? []).map((s) => {
        if (s.id !== stepId) return s;
        const patched = Object.assign(Object.create(Object.getPrototypeOf(s)), s);
        patched.isDone = isDone;
        return patched;
      });
      qc.setQueryData(detailKey, next);

      return { previous };
    },

    onError: (_error, _args, context) => {
      if (context?.previous) qc.setQueryData(detailKey, context.previous);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.shipments.all });
      if (shipmentId) qc.invalidateQueries({ queryKey: detailKey });
    },
  });
}

/** Which file the shipment export produces. */
export type ShipmentExportFormat = 'excel' | 'word';

/**
 * Downloads the shipment as a spreadsheet or a document — an overview of the run, then one sheet
 * (Excel) or one page (Word) per client listing what that client ordered.
 *
 * A mutation rather than a query even though the endpoints only read: it runs when the user picks a
 * format, and its result is a file rather than something to cache. Nothing is invalidated for the
 * same reason — exporting changes no server state.
 *
 * One hook over both formats rather than two: the caller has one button and one pending state, and
 * splitting them would let the two exports be in flight at once for no gain. The generated client
 * returns a `FileResponse` either way, so the blob and the server's own filename both arrive here;
 * the caller saves them with `downloadBlob`.
 */
export function useExportShipment() {
  const ds = useDataSource();
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: ShipmentExportFormat }) =>
      (format === 'word'
        ? ds.exportOutgoingShipmentWordEndpoint(id)
        : ds.exportOutgoingShipmentExcelEndpoint(id)),
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

/** Places a run may be loaded at: the company warehouse, then every brewery.
 *
 * Reference data that changes only when a brewery is added or its address is
 * corrected, so it is cached far longer than the 30s client default — every
 * shipment screen mounts it. */
export function useShipmentStartPoints() {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.shipmentStartPoints,
    queryFn: ({ signal }) => ds.getShipmentStartPointsEndpoint(signal),
    staleTime: 30 * 60 * 1000,
  });
}
