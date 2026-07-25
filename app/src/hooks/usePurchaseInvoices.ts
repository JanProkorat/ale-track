// The split of a nakládka across the invoices the brewery issues to us.
//
// Unlike the client-facing split (useShipmentInvoices) this has no query of its
// own: the invoices ride along in the shipment detail, because the columns are
// part of the nakládka table and would otherwise pop in a beat late. Every
// mutation therefore invalidates the shipment detail.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { SetPurchaseInvoiceLineDto, UpdatePurchaseInvoiceDto } from 'src/generated/api-client';

function useInvalidateShipment(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.shipments.all });
    if (shipmentId) qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId) });
  };
}

export function useAddPurchaseInvoice(shipmentId: string | undefined) {
  const ds = useDataSource();
  const invalidate = useInvalidateShipment(shipmentId);
  return useMutation({
    mutationFn: () => ds.addPurchaseInvoiceEndpoint(shipmentId!),
    onSuccess: invalidate,
  });
}

export function useDeletePurchaseInvoice(shipmentId: string | undefined) {
  const ds = useDataSource();
  const invalidate = useInvalidateShipment(shipmentId);
  return useMutation({
    mutationFn: (invoiceId: string) => ds.deletePurchaseInvoiceEndpoint(shipmentId!, invoiceId),
    onSuccess: invalidate,
  });
}

export interface SetPurchaseInvoiceLineArgs {
  invoiceId: string;
  productId: string;
  quantity: number;
}

export function useSetPurchaseInvoiceLine(shipmentId: string | undefined) {
  const ds = useDataSource();
  const invalidate = useInvalidateShipment(shipmentId);
  return useMutation({
    mutationFn: ({ invoiceId, productId, quantity }: SetPurchaseInvoiceLineArgs) =>
      ds.setPurchaseInvoiceLineEndpoint(
        shipmentId!,
        invoiceId,
        new SetPurchaseInvoiceLineDto({ productId, quantity }),
      ),
    onSuccess: invalidate,
  });
}

export interface UpdatePurchaseInvoiceArgs {
  invoiceId: string;
  label?: string;
}

export function useUpdatePurchaseInvoice(shipmentId: string | undefined) {
  const ds = useDataSource();
  const invalidate = useInvalidateShipment(shipmentId);
  return useMutation({
    mutationFn: ({ invoiceId, label }: UpdatePurchaseInvoiceArgs) =>
      ds.updatePurchaseInvoiceEndpoint(shipmentId!, invoiceId, new UpdatePurchaseInvoiceDto({ label })),
    onSuccess: invalidate,
  });
}
