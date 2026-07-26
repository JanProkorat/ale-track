// The split of a nakládka across the invoices the brewery issues to us.
//
// Unlike the client-facing split (useShipmentInvoices) this has no query of its
// own: the invoices ride along in the shipment detail, because the columns are
// part of the nakládka table and would otherwise pop in a beat late. Every
// mutation therefore invalidates the shipment detail.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { OutgoingShipmentDetailDto, SetPurchaseInvoiceLineDto } from 'src/generated/api-client';
import { applyLineLocally } from 'src/features/shipments/purchaseSplitModel';

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
  /** Which invoice, by column position. The server creates it if it does not exist yet. */
  sequence: number;
  productId: string;
  quantity: number;
}

/**
 * Writes one product's quantity onto a brewery invoice, updating the cache before
 * the server answers.
 *
 * The optimistic step is not decoration: the edited column is local state in its
 * stepper and moves at once, while the remainder column is derived from this cache.
 * Waiting for the round trip would leave the row visibly not adding up in between.
 * A failed write restores the snapshot, so the numbers go back to what the server
 * still holds.
 */
export function useSetPurchaseInvoiceLine(shipmentId: string | undefined) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const invalidate = useInvalidateShipment(shipmentId);
  const detailKey = qk.shipments.detail(shipmentId ?? '');

  return useMutation({
    mutationFn: ({ sequence, productId, quantity }: SetPurchaseInvoiceLineArgs) =>
      ds.setPurchaseInvoiceLineEndpoint(
        shipmentId!,
        new SetPurchaseInvoiceLineDto({ sequence, productId, quantity }),
      ),

    onMutate: async (args: SetPurchaseInvoiceLineArgs) => {
      if (!shipmentId) return undefined;

      // Otherwise a refetch already in flight can land after this patch and undo it.
      await qc.cancelQueries({ queryKey: detailKey });

      const previous = qc.getQueryData<OutgoingShipmentDetailDto>(detailKey);
      if (!previous) return undefined;

      // Shallow clone keeping the DTO prototype — consumers call its methods, and a
      // plain-object copy would lose them.
      const next = Object.assign(
        Object.create(Object.getPrototypeOf(previous)) as OutgoingShipmentDetailDto,
        previous,
      );
      next.purchaseInvoices = applyLineLocally(previous.purchaseInvoices ?? [], args);
      qc.setQueryData(detailKey, next);

      return { previous };
    },

    onError: (_error, _args, context) => {
      if (context?.previous) qc.setQueryData(detailKey, context.previous);
    },

    // On both paths: success replaces the guess with the server's own clamping,
    // failure resyncs after the rollback.
    onSettled: invalidate,
  });
}
