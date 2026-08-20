// Garage sales (Prodeje) — list/detail/create/update/delete plus the two commands that are not
// edits: completing a sale (which deducts stock) and confirming its invoice was paid.
//
// Every mutation that can move stock also invalidates qk.inventory.all. Forgetting that is the
// easy bug here: Sklad would keep showing the pre-sale quantities until something else refetched.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type CreateSaleDto,
  type UpdateSaleDto,
} from 'src/generated/api-client';

export function useSales(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.sales.list(params),
    queryFn: ({ signal }) => ds.getSalesListEndpoint(params, signal),
  });
}

export function useSale(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.sales.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getSaleDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

/**
 * What this client has bought over the counter before, for the editor's "Dříve prodané" tab.
 * Disabled without a client — a walk-in has no history to fetch.
 */
export function useSaleClientHistory(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.saleClientHistory(clientId ?? ''),
    queryFn: ({ signal }) => ds.getSaleClientHistoryEndpoint(clientId!, signal),
    enabled: Boolean(clientId),
  });
}

export function useCreateSale() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSaleDto) => ds.createSaleEndpoint(data),
    // A new sale is always a draft, so no stock has moved yet.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sales.all }),
  });
}

export function useUpdateSale() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSaleDto }) => ds.updateSaleEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.sales.detail(id) });
    },
  });
}

export function useCompleteSale() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.completeSaleEndpoint(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.sales.detail(id) });
      // Completing is the one action that takes goods off the shelf.
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

/**
 * Confirms an invoice was paid, moving the sale from "Čeká na platbu" to "Dokončený".
 *
 * Stock is untouched — the goods left the counter when the sale was completed, so there is no
 * reason to invalidate the inventory here.
 */
export function useConfirmSalePayment() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.confirmSalePaymentEndpoint(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.sales.detail(id) });
    },
  });
}

export function useDeleteSale() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteSaleEndpoint(id),
    // Only drafts are deletable, so inventory is untouched by definition.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sales.all }),
  });
}
