// Invoice split of an outgoing shipment (Fakturace) — read plus the edits
// the section offers. Deliberately its own query rather than part of the shipment
// detail: nakládka and fakturace answer different questions for different people,
// so they load independently.
//
// Every mutation invalidates the invoice query, because the backend reconciles on
// read — after any edit the split (and the drift banner) has to come from the
// server rather than be patched locally. The readiness tick is the one exception:
// it is a flag the office sets by hand, nothing is recomputed from it, so it is
// patched in first and invalidated after.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  AddShipmentInvoiceDto,
  MoveInvoiceLineDto,
  SetInvoiceBillingRecipientsDto,
  SetInvoiceReadinessDto,
  ShipmentInvoiceConfirmationDto,
  ShipmentInvoicesDto,
  type InvoiceLineSourceKind,
} from 'src/generated/api-client';

export function useShipmentInvoices(shipmentId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.shipmentInvoices(shipmentId ?? ''),
    queryFn: ({ signal }) => ds.getShipmentInvoicesEndpoint(shipmentId!, signal),
    enabled: Boolean(shipmentId),
  });
}

export interface MoveInvoiceLineArgs {
  /** Origin invoice; omitted when the pieces come off the private ones. */
  fromInvoiceId?: string;
  sourceKind: InvoiceLineSourceKind;
  sourceItemId: string;
  quantity: number;
  /** Target invoice, `toClientId` to open a new one for that client, or `toPrivate` for none. */
  toInvoiceId?: string;
  toClientId?: string;
  /** Excludes the pieces from every invoice — still delivered, never billed. */
  toPrivate?: boolean;
}

export function useMoveInvoiceLine(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: MoveInvoiceLineArgs) =>
      ds.moveInvoiceLineEndpoint(shipmentId!, new MoveInvoiceLineDto(args)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
  });
}

export function useAddShipmentInvoice(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      ds.addShipmentInvoiceEndpoint(shipmentId!, new AddShipmentInvoiceDto({ clientId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
  });
}

export function useDeleteShipmentInvoice(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => ds.deleteShipmentInvoiceEndpoint(shipmentId!, invoiceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
  });
}

export interface SetInvoiceReadinessArgs {
  /** Client whose row is being ticked — the payer, which is what covers a whole sub-client group. */
  clientId: string;
  isReady: boolean;
}

/**
 * Applies a tick to a cached split the way the endpoint applies it to the run: a row that already
 * exists keeps its number, a first tick gets the next number on the run, and clearing a row nobody
 * ever marked is a no-op rather than a burnt number.
 */
function withReadiness(data: ShipmentInvoicesDto, clientId: string, isReady: boolean) {
  const confirmations = data.confirmations ?? [];
  const existing = confirmations.find((c) => c.clientId === clientId);

  if (!existing) {
    if (!isReady) return data;
    // Mirrors ShipmentInvoiceGraph.NextConfirmationNumber, so the band's circle shows its number
    // from the click. A concurrent tick elsewhere makes this a guess, which the refetch corrects.
    const number = Math.max(0, ...confirmations.map((c) => c.number ?? 0)) + 1;
    return new ShipmentInvoicesDto({
      ...data,
      confirmations: [
        ...confirmations,
        new ShipmentInvoiceConfirmationDto({ clientId, number, isReady: true, deviationCount: 0 }),
      ],
    });
  }

  return new ShipmentInvoicesDto({
    ...data,
    confirmations: confirmations.map((c) => (c === existing
      ? new ShipmentInvoiceConfirmationDto({ ...c, isReady })
      : c)),
  });
}

export function useSetInvoiceReadiness(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, isReady }: SetInvoiceReadinessArgs) =>
      ds.setInvoiceReadinessEndpoint(shipmentId!, clientId, new SetInvoiceReadinessDto({ isReady })),

    // The one mutation on this screen that patches the cache instead of only invalidating it. The
    // tick is a flag the office flips by hand, not something the backend recomputes on read, so
    // the answer is knowable here — and waiting for the round trip to show it meant a visibly
    // dead control on every band, since one pending mutation gates them all.
    onMutate: async ({ clientId, isReady }: SetInvoiceReadinessArgs) => {
      const key = qk.shipmentInvoices(shipmentId ?? '');
      // An in-flight read would otherwise land after the patch and undo it.
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ShipmentInvoicesDto>(key);
      if (previous) qc.setQueryData(key, withReadiness(previous, clientId, isReady));
      return { previous };
    },

    onError: (_error, _args, context) => {
      if (context?.previous) {
        qc.setQueryData(qk.shipmentInvoices(shipmentId ?? ''), context.previous);
      }
    },

    // Ticking a row is not only an invoicing fact: it is what opens recording a deviation, and that
    // flag is carried on the shipment's stops and on the order itself. With only the invoices query
    // invalidated, the button appeared or vanished a page refresh late.
    //
    // Deliberately not awaited — what the tick itself changes is already on screen from onMutate,
    // so nothing is waiting for these. Awaiting them (which is what this used to do) held the
    // mutation pending for the whole round trip, and orders are invalidated wholesale, because a
    // payer's tick covers its whole sub-client group and which orders it touched is not knowable
    // from here.
    onSuccess: () => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
        qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId ?? '') }),
        qc.invalidateQueries({ queryKey: qk.orders.all }),
      ]);
    },
  });
}

/**
 * Files the run's invoicing — the one-way door.
 *
 * Invalidates what the readiness tick does, and for the same reason: filing closes the run's
 * orders to editing and opens recording against them, and both flags travel on the shipment's
 * stops and on the orders themselves.
 */
export function useFileShipmentInvoicing(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ds.fileShipmentInvoicingEndpoint(shipmentId!),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
      qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId ?? '') }),
      qc.invalidateQueries({ queryKey: qk.orders.all }),
    ]),
  });
}

export interface SetInvoiceBillingRecipientsArgs {
  invoiceId: string;
  /** The whole selection — the endpoint replaces the invoice's list with it. */
  clientIds: string[];
}

export function useSetInvoiceBillingRecipients(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, clientIds }: SetInvoiceBillingRecipientsArgs) =>
      ds.setInvoiceBillingRecipientsEndpoint(
        shipmentId!,
        invoiceId,
        new SetInvoiceBillingRecipientsDto({ clientIds }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
  });
}
