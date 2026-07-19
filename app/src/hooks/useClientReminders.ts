// Client reminders — mirrors useBreweryReminders.ts against the client endpoints.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  type CreateReminderDto,
  type UpdateReminderDto,
  SetClientReminderResolvedDateRequest,
} from 'src/generated/api-client';

export function useClientReminders(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clientReminders(clientId ?? ''),
    queryFn: ({ signal }) => ds.getClientRemindersListEndpoint(clientId!, {}, signal),
    enabled: Boolean(clientId),
  });
}

export function useCreateClientReminder(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReminderDto) => ds.createClientReminderEndpoint(clientId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientReminders(clientId) }),
  });
}

export function useUpdateClientReminder(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReminderDto }) =>
      ds.updateClientReminderEndpoint(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientReminders(clientId) }),
  });
}

/** Mark a reminder resolved (or clear it) by setting/clearing the resolved date. */
export function useResolveClientReminder(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolvedDate }: { id: string; resolvedDate: Date | undefined }) =>
      ds.setClientReminderResolvedDateEndpoint(id, new SetClientReminderResolvedDateRequest({ resolvedDate })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientReminders(clientId) }),
  });
}

export function useDeleteClientReminder(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteClientReminderEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientReminders(clientId) }),
  });
}
