// Client-specific product prices — a per-(client, product) override of the
// brewery's ceník price, used by orders and counter sales alike. Mirrors
// useDeliveryPlaces.ts's shape. Every mutation here also invalidates
// `qk.orders.all`: an order's displayed line prices come from whatever price
// applies to the client at read time, so a price change has to bust that
// cache too, not just this client's own price list.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type ClientProductPriceEntryDto, type SaveClientProductPriceDto } from 'src/generated/api-client';

export function useClientProductPrices(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clientProductPrices(clientId ?? ''),
    queryFn: ({ signal }) => ds.getClientProductPricesEndpoint(clientId!, signal),
    enabled: !!clientId,
  });
}

export function useSaveClientProductPrice() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, productId, data }: { clientId: string; productId: string; data: SaveClientProductPriceDto }) =>
      ds.saveClientProductPriceEndpoint(clientId, productId, data),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientProductPrices(clientId) });
      qc.invalidateQueries({ queryKey: qk.orders.all });
    },
  });
}

export function useDeleteClientProductPrice() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, productId }: { clientId: string; productId: string }) =>
      ds.deleteClientProductPriceEndpoint(clientId, productId),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientProductPrices(clientId) });
      qc.invalidateQueries({ queryKey: qk.orders.all });
    },
  });
}

/** Replaces the client's whole price list in one call — the bulk editor
 * (Task 10) is its consumer; this hook only wires the mutation and its
 * invalidation. */
export function useReplaceClientProductPrices() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: ClientProductPriceEntryDto[] }) =>
      ds.replaceClientProductPricesEndpoint(clientId, data),
    onSuccess: (_res, { clientId }) => {
      qc.invalidateQueries({ queryKey: qk.clientProductPrices(clientId) });
      qc.invalidateQueries({ queryKey: qk.orders.all });
    },
  });
}
