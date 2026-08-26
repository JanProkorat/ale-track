// Invoice split of an outgoing shipment (Fakturace) — read plus the edits
// the section offers. Deliberately its own query rather than part of the shipment
// detail: nakládka and fakturace answer different questions for different people,
// so they load independently.
//
// Every mutation invalidates the invoice query, because the backend reconciles on
// read — after any edit the split (and the drift banner) has to come from the
// server rather than be patched locally.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  AddShipmentInvoiceDto,
  MoveInvoiceLineDto,
  SetInvoiceBillingRecipientsDto,
  SetInvoiceReadinessDto,
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

export function useSetInvoiceReadiness(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, isReady }: SetInvoiceReadinessArgs) =>
      ds.setInvoiceReadinessEndpoint(shipmentId!, clientId, new SetInvoiceReadinessDto({ isReady })),

    // Ticking a row is not only an invoicing fact any more: it is what opens recording a
    // deviation, and that flag is carried on the shipment's stops and on the order itself. With
    // only the invoices query invalidated, the button appeared or vanished a page refresh late.
    //
    // Awaited, so the checkbox stays disabled until the refreshed flag has actually arrived —
    // the same reasoning useSetShipmentState gives for its own await. Orders are invalidated
    // wholesale because a payer's tick covers its whole sub-client group, so which orders it
    // touched is not knowable from here.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.shipmentInvoices(shipmentId ?? '') }),
      qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId ?? '') }),
      qc.invalidateQueries({ queryKey: qk.orders.all }),
    ]),
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
