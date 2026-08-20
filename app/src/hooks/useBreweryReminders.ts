import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type CreateReminderDto,
  type UpdateReminderDto,
  SetBreweryReminderResolvedDateRequest,
} from 'src/generated/api-client';

export function useBreweryReminders(breweryId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweryReminders(breweryId ?? ''),
    queryFn: ({ signal }) => ds.getBreweryRemindersListEndpoint(breweryId!, {}, signal),
    enabled: Boolean(breweryId),
  });
}

export function useCreateBreweryReminder(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReminderDto) => ds.createBreweryReminderEndpoint(breweryId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryReminders(breweryId) }),
  });
}

export function useUpdateBreweryReminder(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReminderDto }) =>
      ds.updateBreweryReminderEndpoint(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryReminders(breweryId) }),
  });
}

/** Mark a reminder resolved (or clear it) by setting/clearing the resolved date. */
export function useResolveBreweryReminder(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolvedDate }: { id: string; resolvedDate: Date | undefined }) =>
      ds.setBreweryReminderResolvedDateEndpoint(id, new SetBreweryReminderResolvedDateRequest({ resolvedDate })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryReminders(breweryId) }),
  });
}

export function useDeleteBreweryReminder(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteBreweryReminderEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryReminders(breweryId) }),
  });
}
