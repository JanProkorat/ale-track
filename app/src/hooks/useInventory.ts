// Inventory module hooks — copied from the useVehicles CRUD pattern. The list
// endpoint returns brewery-grouped sections (not a flat item list); CRUD
// operates on individual items nested inside those sections.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateInventoryItemDto, type UpdateInventoryItemDto } from 'src/generated/api-client';

export function useInventory(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.inventory.list(params),
    queryFn: ({ signal }) => ds.getInventoryItemsListEndpoint(params, signal),
  });
}

export function useCreateInventoryItem() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryItemDto) => ds.createInventoryItemEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory.all }),
  });
}

export function useUpdateInventoryItem() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
      ds.updateInventoryItemEndpoint(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory.all }),
  });
}

export function useDeleteInventoryItem() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteInventoryItemEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory.all }),
  });
}
