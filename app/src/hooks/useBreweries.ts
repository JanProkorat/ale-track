import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateBreweryDto, type UpdateBreweryDto } from 'src/generated/api-client';

export function useBreweries(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweries.list(params),
    queryFn: ({ signal }) => ds.getBreweriesListEndpoint(params, signal),
  });
}

/** The brewery's own colour by id, for the square that marks a brewery across
 * the catalog surfaces. Rides on the cached brewery list, so a screen that
 * already loads breweries pays nothing extra. */
export function useBreweryColors(): (breweryId?: string) => string | undefined {
  const query = useBreweries();
  const byId = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of query.data ?? []) if (b.id && b.color) m.set(b.id, b.color);
    return m;
  }, [query.data]);
  return useCallback((breweryId?: string) => (breweryId ? byId.get(breweryId) : undefined), [byId]);
}

export function useBrewery(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweries.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getBreweryDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateBrewery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBreweryDto) => ds.createBreweryEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweries.all }),
  });
}

export function useUpdateBrewery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBreweryDto }) =>
      ds.updateBreweryEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.breweries.all });
      qc.invalidateQueries({ queryKey: qk.breweries.detail(id) });
    },
  });
}

export function useDeleteBrewery() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteBreweryEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweries.all }),
  });
}
