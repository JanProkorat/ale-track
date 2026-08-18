// Suppliers CRUD plus their opening hours, price-list goods and notes. Same shape as
// useClients.ts: everything goes through the active data source and invalidates the
// `suppliers` resource root.
//
// The nested writes (hours, goods) also invalidate the list, not just the detail — the list
// renders the "Dnes" column from the week and a goods count, so both change when either is
// edited.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type CreateNoteDto,
  type CreateSupplierDto,
  type ReplaceSupplierOpeningHoursDto,
  type SupplierGoodUpsertDto,
  type UpdateSupplierDto,
} from 'src/generated/api-client';

export function useSuppliers(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.suppliers.list(params),
    queryFn: ({ signal }) => ds.getSupplierListEndpoint(params, signal),
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
