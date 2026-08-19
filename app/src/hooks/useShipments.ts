// Outgoing shipments (Vývozy) CRUD — same list/detail/create/update/delete
// pattern as useOrders.ts, plus a read-only lookup for the shipment editor's
// "Objednávky k rozvozu" picker (orders not already riding another shipment).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  SetOrderItemSourcingDto,
  SetSupplierGoodSourcingDto,
  ReorderShipmentStopsDto,
  SetPreparationStepDto,
  SetShipmentStateDto,
  SetStockPurchaseDto,
  type CreateOutgoingShipmentDto,
  type OutgoingShipmentDetailDto,
  type OutgoingShipmentState,
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

/**
 * Moves the shipment to another state.
 *
 * Its own endpoint rather than the full shipment PUT. Advancing a run used to re-post the
 * whole thing — every stop, order line, via point, purchase and checklist step — for the
 * server to diff, rebuild and re-link before it reached the one field that changed. This
 * sends the state and nothing else.
 *
 * Not optimistic, unlike the checklist and the sourcing stepper: a transition moves stock,
 * rewrites the orders' own states and freezes prices, so what comes back is a genuinely
 * different shipment and guessing at it would be guessing at all of that. The caller shows
 * what is happening instead — see `stateChange` in ShipmentDetail.
 */
export function useSetShipmentState(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: OutgoingShipmentState) =>
      ds.setShipmentStateEndpoint(shipmentId!, new SetShipmentStateDto({ state })),

    // Awaited, not fired and forgotten: TanStack holds the mutation open until a promise
    // returned from here settles, which keeps the caller's progress overlay up until the
    // refreshed shipment has actually arrived. Without the await the overlay clears on the
    // 204 and the screen re-renders its pre-transition self for a beat — which reads as the
    // click having done nothing.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId ?? '') }),
      qc.invalidateQueries({ queryKey: qk.shipments.all }),
      // The run's orders change state along with it, so the orders module is stale too.
      qc.invalidateQueries({ queryKey: qk.orders.all }),
      // Loading and unloading move stock.
      qc.invalidateQueries({ queryKey: qk.inventory.all }),
    ]),
  });
}

export interface SetOrderItemSourcingArgs {
  orderItemId: string;
  quantityFromInventory: number;
  inventoryItemId?: string;
}

/**
 * Sets how many of one order line's pieces come off our own shelf.
 *
 * Its own endpoint for the same reason the preparation checklist has one: the "Z garáže"
 * stepper is clicked once per piece, and re-posting the whole run to move a single piece
 * between two columns made every click wait on a whole-shipment rebuild.
 *
 * Optimistic for the same reason too — a number that only moves after the round trip
 * invites a second click, and a second click on a stepper is a wrong quantity.
 */
export function useSetOrderItemSourcing(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: ({ orderItemId, quantityFromInventory, inventoryItemId }: SetOrderItemSourcingArgs) =>
      ds.setOrderItemSourcingEndpoint(
        shipmentId!,
        orderItemId,
        new SetOrderItemSourcingDto({ quantityFromInventory, inventoryItemId }),
      ),

    onMutate: async ({ orderItemId, quantityFromInventory, inventoryItemId }: SetOrderItemSourcingArgs) => {
      if (!shipmentId) return undefined;

      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      // Cloned through the prototype so the patched value stays an OutgoingShipmentDetailDto —
      // a plain spread would lose its methods.
      const clone = <T extends object>(value: T, patch: Partial<T>): T =>
        Object.assign(Object.create(Object.getPrototypeOf(value)) as T, value, patch);

      qc.setQueryData(detailKey, clone(previous, {
        stops: (previous.stops ?? []).map((stop) => clone(stop, {
          products: (stop.products ?? []).map((p) => (p.orderItemId === orderItemId
            ? clone(p, { quantityFromInventory, inventoryItemId })
            : p)),
        })),
      }));

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

/**
 * Writes a new stop sequence for a run.
 *
 * Its own endpoint like the sourcing writes, and for the same reason: moving a stop one place is
 * a single click, and re-posting the whole run to change two integers made every click wait on a
 * whole-shipment rebuild — address diffing and stop reconciliation included.
 *
 * Optimistic, so the row moves under the cursor. The reorder is also the only way to place an
 * auto-derived pickup stop, which the shipment editor keeps out of its draft entirely.
 */
export function useReorderShipmentStops(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: (stopIds: string[]) =>
      ds.reorderShipmentStopsEndpoint(shipmentId!, new ReorderShipmentStopsDto({ stopIds })),

    onMutate: async (stopIds: string[]) => {
      if (!shipmentId) return undefined;

      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      // Cloned through the prototype so the patched values keep their DTO methods — a plain
      // spread would lose them.
      const clone = <T extends object>(value: T, patch: Partial<T>): T =>
        Object.assign(Object.create(Object.getPrototypeOf(value)) as T, value, patch);

      // `order` is what every consumer sorts by, so the patch rewrites that rather than the
      // array's own sequence: the detail screen sorts the stops itself.
      const positionById = new Map(stopIds.map((id, i) => [id, i + 1]));
      qc.setQueryData(detailKey, clone(previous, {
        stops: (previous.stops ?? []).map((stop) => {
          const next = stop.id ? positionById.get(stop.id) : undefined;
          return next == null ? stop : clone(stop, { order: next });
        }),
      }));

      return { previous };
    },

    onError: (_error, _args, context) => {
      if (context?.previous) qc.setQueryData(detailKey, context.previous);
    },

    // Returns the invalidation so the refetch is awaited: React Query resolves the mutate-level
    // onSettled only after this one's promise settles, and the caller drops its predicted stops
    // there. Without the await the prediction is dropped while the cache still holds the
    // pre-write route, which reads on screen as the stop snapping back and then forward again.
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.shipments.all }),
      shipmentId ? qc.invalidateQueries({ queryKey: detailKey }) : Promise.resolve(),
    ]),
  });
}

export interface SetSupplierGoodSourcingArgs {
  /** Public ID of the supplier-good order line. */
  itemId: string;
  /** Absolute, not a delta. */
  quantityFromGarage: number;
}

/**
 * Sets how many of a supplier-good line's pieces come from the garage rather than the supplier.
 *
 * Its own endpoint for the same reason {@link useSetOrderItemSourcing} has one — the stepper is
 * clicked once per piece. Unlike that one, the server also re-derives the run's pickup stops
 * from the answer, so the *route* changes on the click too; hence the full invalidation on
 * settle rather than trusting the optimistic patch alone.
 */
export function useSetSupplierGoodSourcing(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: ({ itemId, quantityFromGarage }: SetSupplierGoodSourcingArgs) =>
      ds.setSupplierGoodSourcingEndpoint(
        shipmentId!,
        itemId,
        new SetSupplierGoodSourcingDto({ quantityFromGarage }),
      ),

    onMutate: async ({ itemId, quantityFromGarage }: SetSupplierGoodSourcingArgs) => {
      if (!shipmentId) return undefined;

      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      // Cloned through the prototype so the patched value keeps its DTO methods — a plain
      // spread would lose them.
      const clone = <T extends object>(value: T, patch: Partial<T>): T =>
        Object.assign(Object.create(Object.getPrototypeOf(value)) as T, value, patch);

      // Only the number is patched, not the stops: which stops the run needs is the server's
      // derivation, and guessing it here would flicker the route the wrong way on the way to
      // being corrected.
      qc.setQueryData(detailKey, clone(previous, {
        supplierGoods: (previous.supplierGoods ?? []).map((g) => (g.id === itemId
          ? clone(g, { quantityFromGarage })
          : g)),
      }));

      return { previous };
    },

    onError: (_error, _args, context) => {
      if (context?.previous) qc.setQueryData(detailKey, context.previous);
    },

    // Returns the invalidation so the refetch is awaited: React Query resolves the mutate-level
    // onSettled only after this one's promise settles, and the caller drops its predicted stops
    // there. Without the await the prediction is dropped while the cache still holds the
    // pre-write route, which reads on screen as the stop snapping back and then forward again.
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.shipments.all }),
      shipmentId ? qc.invalidateQueries({ queryKey: detailKey }) : Promise.resolve(),
    ]),
  });
}

export interface SetStockPurchaseArgs {
  productId: string;
  /** Absolute, not a delta. Zero removes the line. */
  quantity: number;
}

/**
 * Sets how many pieces of a product the run buys for our own warehouse — "Do garáže".
 *
 * The counterpart to {@link useSetOrderItemSourcing}, and its own endpoint for the same
 * reason: the stepper is clicked once per piece, and re-posting the whole run per click made
 * each one wait on a whole-shipment rebuild.
 *
 * Optimistic, so the number moves on click. A purchase is content rather than progress, so
 * the API only accepts it while the run is still being planned — the screen hides the
 * controls past that point, and a rejection here rolls the cache back.
 */
export function useSetStockPurchase(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: ({ productId, quantity }: SetStockPurchaseArgs) =>
      ds.setStockPurchaseEndpoint(shipmentId!, new SetStockPurchaseDto({ productId, quantity })),

    onMutate: async ({ productId, quantity }: SetStockPurchaseArgs) => {
      if (!shipmentId) return undefined;

      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      const lines = previous.stockPurchases ?? [];
      const existing = lines.find((p) => p.productId === productId);

      // A brand-new line is left to the server: the row needs an id and the product's name,
      // brewery, package size and weight, none of which this hook has. Only quantity changes
      // to an existing line — the stepper's case — are guessed at here.
      if (!existing && quantity > 0) return { previous };

      qc.setQueryData(detailKey, Object.assign(
        Object.create(Object.getPrototypeOf(previous)) as OutgoingShipmentDetailDto,
        previous,
        {
          stockPurchases: quantity === 0
            ? lines.filter((p) => p.productId !== productId)
            : lines.map((p) => (p.productId === productId
              ? Object.assign(Object.create(Object.getPrototypeOf(p)), p, { quantity })
              : p)),
        },
      ));

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
