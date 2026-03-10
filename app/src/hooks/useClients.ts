import type {
     Region,
     CreateClientDto,
     UpdateClientDto,
     CreateReminderDto,
     UpdateReminderDto,
} from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';
import { SetClientReminderResolvedDateRequest } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CLIENTS_KEY = 'clients';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useClients(search?: string, region?: Region) {
     return useQuery({
          queryKey: [CLIENTS_KEY, { search, region }],
          queryFn: ({ signal }) => {
               const params: Record<string, string> = {};
               if (search) params.Name = `contains:${search}`;
               if (region != null) params.region = `eq:${region}`;
               return apiClient.getClientListEndpoint(params, signal);
          },
     });
}

export function useClient(id: string) {
     return useQuery({
          queryKey: [CLIENTS_KEY, id],
          queryFn: ({ signal }) => apiClient.getClientDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

export function useClientReminders(clientId: string) {
     return useQuery({
          queryKey: [CLIENTS_KEY, clientId, 'reminders'],
          queryFn: ({ signal }) => apiClient.getClientRemindersListEndpoint(clientId, {}, signal),
          enabled: !!clientId,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateClient() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateClientDto) => apiClient.createClientEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
               notifyCreate('clients');
          },
          onError: () => {
               notifyCreateError('clients');
          },
     });
}

export function useUpdateClient() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
               apiClient.updateClientEndpoint(id, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
               queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, variables.id] });
               notifyUpdate('clients');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteClient() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteClientEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
               notifyDelete('clients');
          },
          onError: () => {
               notifyDeleteError('clients');
          },
     });
}

// ---------------------------------------------------------------------------
// Reminder mutations
// ---------------------------------------------------------------------------

const remindersKey = (clientId: string) => [CLIENTS_KEY, clientId, 'reminders'];

export function useCreateClientReminder() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: ({ clientId, data }: { clientId: string; data: CreateReminderDto }) =>
               apiClient.createClientReminderEndpoint(clientId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.clientId) });
               notifyCreate('clients');
          },
          onError: () => {
               notifyCreateError('clients');
          },
     });
}

export function useUpdateClientReminder() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({
               clientId,
               reminderId,
               data,
          }: {
               clientId: string;
               reminderId: string;
               data: UpdateReminderDto;
          }) => apiClient.updateClientReminderEndpoint(reminderId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.clientId) });
               notifyUpdate('clients');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteClientReminder() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: ({ clientId, reminderId }: { clientId: string; reminderId: string }) =>
               apiClient.deleteClientReminderEndpoint(reminderId),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.clientId) });
               notifyDelete('clients');
          },
          onError: () => {
               notifyDeleteError('clients');
          },
     });
}

export function useSetClientReminderResolved() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({
               clientId,
               reminderId,
               resolvedDate,
          }: {
               clientId: string;
               reminderId: string;
               resolvedDate: Date | undefined;
          }) => {
               const request = new SetClientReminderResolvedDateRequest();
               request.resolvedDate = resolvedDate;
               return apiClient.setClientReminderResolvedDateEndpoint(reminderId, request);
          },
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.clientId) });
               notifyUpdate('clients');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}
