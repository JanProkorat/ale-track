import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type BreweryProductListItemDto,
  type CreateProductsDto, type FileParameter, type UpdateProductDto,
} from 'src/generated/api-client';

/** The brewery's ceník (price list). */
export function useBreweryProducts(breweryId: string | undefined, params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweryProducts(breweryId ?? '', params),
    queryFn: ({ signal }) => ds.getBreweryProductsListEndpoint(breweryId!, params, signal),
    enabled: Boolean(breweryId),
  });
}

/**
 * The ceníky of several breweries at once, keyed by brewery id.
 *
 * For a screen that has to price lines from more than one brewery — the dovoz editor's cart adds
 * up every stop's items — a hook per stop cannot work, since the number of stops changes as the
 * user edits. Shares the cache with {@link useBreweryProducts}, so a stop card and the cart read
 * one fetch per brewery between them rather than one each.
 *
 * Returns a fresh Map per render on purpose: memoising it would need a dependency describing
 * every query's data, and the maps are small enough that recomputing beats getting that wrong.
 */
export function useBreweryProductsMany(breweryIds: string[]) {
  const ds = useDataSource();
  const results = useQueries({
    queries: breweryIds.map((id) => ({
      queryKey: qk.breweryProducts(id),
      queryFn: ({ signal }: { signal?: AbortSignal }) => ds.getBreweryProductsListEndpoint(id, {}, signal),
    })),
  });

  const byBrewery = new Map<string, BreweryProductListItemDto[]>();
  const loading = new Set<string>();
  breweryIds.forEach((id, i) => {
    const r = results[i];
    if (r?.data) byBrewery.set(id, r.data);
    if (r?.isLoading) loading.add(id);
  });

  return { byBrewery, loading };
}

/** Create one or more products under a brewery (the API takes a batch). */
export function useCreateProducts(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductsDto) => ds.createProductsEndpoint(breweryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

export function useUpdateProduct(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) => ds.updateProductEndpoint(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

/**
 * Ask what an uploaded price list would change. Writes nothing, so it is a mutation only in the
 * sense that it posts a file — the returned `sourceHash` is what ties the apply below to the diff
 * the user actually reviewed.
 */
export function usePreviewPriceList(breweryId: string) {
  const ds = useDataSource();
  return useMutation({
    mutationFn: ({ file, effectiveFrom }: { file: FileParameter; effectiveFrom: Date }) =>
      ds.previewPriceListEndpoint(breweryId, file, effectiveFrom),
  });
}

/** Apply a previewed price list. The API rejects a file that no longer matches `sourceHash`. */
export function useApplyPriceList(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, effectiveFrom, sourceHash }: {
      file: FileParameter;
      effectiveFrom: Date;
      sourceHash: string;
    }) => ds.applyPriceListEndpoint(breweryId, file, effectiveFrom, sourceHash),
    onSuccess: () => {
      // An import can add, reprice and remove at once, so nothing narrower than the whole
      // product surface is safe to keep.
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useDeleteProduct(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteProductEndpoint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.breweryProducts(breweryId) });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}
