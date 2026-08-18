// Suppliers CRUD plus their opening hours, price-list goods and notes. Same shape as
// useClients.ts: everything goes through the active data source and invalidates the
// `suppliers` resource root.
//
// The nested writes (hours, goods) also invalidate the list, not just the detail — the list
// renders the "Dnes" column from the week and a goods count, so both change when either is
// edited.

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type CreateNoteDto,
  type CreateSupplierDto,
  type ReplaceSupplierOpeningHoursDto,
  type SupplierDto,
  type SupplierGoodUpsertDto,
  type UpdateSupplierDto,
} from 'src/generated/api-client';

/** `enabled` is for callers outside the Dodavatelé module — the dovoz editor offers suppliers as
 * stops only to a user who may read them, and firing a query the API will refuse achieves nothing
 * but a retry. */
export function useSuppliers(params: Record<string, string> = {}, options: { enabled?: boolean } = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.suppliers.list(params),
    queryFn: ({ signal }) => ds.getSupplierListEndpoint(params, signal),
    enabled: options.enabled ?? true,
  });
}

export function useSupplier(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.suppliers.detail(id ?? ''),
    queryFn: ({ signal }) => ds.getSupplierDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

/**
 * Several suppliers' details at once, keyed by id — each one carrying its price list, which is
 * what a dovoz stop picks its goods from.
 *
 * The counterpart of useBreweryProductsMany, and there for the same reason: the dovoz editor's
 * stop count changes as the user edits, so it cannot call useSupplier per stop. Shares the cache
 * with {@link useSupplier}. Returns a fresh Map per render, as that hook's note explains.
 */
export function useSuppliersMany(ids: string[]) {
  const ds = useDataSource();
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.suppliers.detail(id),
      queryFn: ({ signal }: { signal?: AbortSignal }) => ds.getSupplierDetailEndpoint(id, signal),
    })),
  });

  const bySupplier = new Map<string, SupplierDto>();
  const loading = new Set<string>();
  ids.forEach((id, i) => {
    const r = results[i];
    if (r?.data) bySupplier.set(id, r.data);
    if (r?.isLoading) loading.add(id);
  });

  return { bySupplier, loading };
}

export function useCreateSupplier() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierDto) => ds.createSupplierEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers.all }),
  });
}

export function useUpdateSupplier() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierDto }) =>
      ds.updateSupplierEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.suppliers.all });
      qc.invalidateQueries({ queryKey: qk.suppliers.detail(id) });
    },
  });
}

export function useDeleteSupplier() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteSupplierEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers.all }),
  });
}

/** Replaces the whole weekly schedule — the editor edits the week, not single rows. */
export function useReplaceOpeningHours() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReplaceSupplierOpeningHoursDto }) =>
      ds.replaceSupplierOpeningHoursEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      // The list's "Dnes" column reads the same week, so it goes stale too.
      qc.invalidateQueries({ queryKey: qk.suppliers.all });
      qc.invalidateQueries({ queryKey: qk.suppliers.detail(id) });
    },
  });
}

export function useCreateSupplierGood() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierGoodUpsertDto }) =>
      ds.createSupplierGoodEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.suppliers.all });
      qc.invalidateQueries({ queryKey: qk.suppliers.detail(id) });
    },
  });
}

/**
 * Updates one price-list item. `supplierId` is not part of the request — a good is
 * addressed by its own public id — but it is taken here so the detail whose ceník changed
 * can be invalidated.
 */
export function useUpdateSupplierGood() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goodId, data }: { supplierId: string; goodId: string; data: SupplierGoodUpsertDto }) =>
      ds.updateSupplierGoodEndpoint(goodId, data),
    onSuccess: (_res, { supplierId }) => {
      qc.invalidateQueries({ queryKey: qk.suppliers.all });
      qc.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
    },
  });
}

export function useDeleteSupplierGood() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goodId }: { supplierId: string; goodId: string }) =>
      ds.deleteSupplierGoodEndpoint(goodId),
    onSuccess: (_res, { supplierId }) => {
      qc.invalidateQueries({ queryKey: qk.suppliers.all });
      qc.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
    },
  });
}

export function useSupplierNotes(supplierId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.supplierNotes(supplierId ?? ''),
    queryFn: ({ signal }) => ds.getSupplierNotesEndpoint(supplierId!, signal),
    enabled: Boolean(supplierId),
  });
}

export function useCreateSupplierNote() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: CreateNoteDto }) =>
      ds.createSupplierNoteEndpoint(supplierId, data),
    onSuccess: (_res, { supplierId }) =>
      qc.invalidateQueries({ queryKey: qk.supplierNotes(supplierId) }),
  });
}

export function useDeleteSupplierNote() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId }: { supplierId: string; noteId: string }) =>
      ds.deleteSupplierNoteEndpoint(noteId),
    onSuccess: (_res, { supplierId }) =>
      qc.invalidateQueries({ queryKey: qk.supplierNotes(supplierId) }),
  });
}
