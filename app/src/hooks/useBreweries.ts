import type {
     CreateBreweryDto,
     UpdateBreweryDto,
     CreateReminderDto,
     UpdateReminderDto,
} from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';
import { SetBreweryReminderResolvedDateRequest } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const BREWERIES_KEY = 'breweries';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBreweries(search?: string) {
     return useQuery({
          queryKey: [BREWERIES_KEY, search],
          queryFn: ({ signal }) =>
               apiClient.getBreweriesListEndpoint(search ? { Name: `contains:${search}` } : {}, signal),
     });
}

export function useBrewery(id: string) {
     return useQuery({
          queryKey: [BREWERIES_KEY, id],
          queryFn: ({ signal }) => apiClient.getBreweryDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBrewery() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateBreweryDto) => apiClient.createBreweryEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [BREWERIES_KEY] });
               notifyCreate('breweries');
          },
          onError: () => {
               notifyCreateError('breweries');
          },
     });
}

export function useUpdateBrewery() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateBreweryDto }) =>
               apiClient.updateBreweryEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [BREWERIES_KEY] });
               notifyUpdate('breweries');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteBrewery() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteBreweryEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [BREWERIES_KEY] });
               notifyDelete('breweries');
          },
          onError: () => {
               notifyDeleteError('breweries');
          },
     });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const productsKey = (breweryId: string) => [BREWERIES_KEY, breweryId, 'products'];

export function useBreweryProducts(breweryId: string) {
     return useQuery({
          queryKey: productsKey(breweryId),
          queryFn: ({ signal }) => apiClient.getBreweryProductsListEndpoint(breweryId, {}, signal),
          enabled: !!breweryId,
     });
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const remindersKey = (breweryId: string) => [BREWERIES_KEY, breweryId, 'reminders'];

export function useBreweryReminders(breweryId: string) {
     return useQuery({
          queryKey: remindersKey(breweryId),
          queryFn: ({ signal }) => apiClient.getBreweryRemindersListEndpoint(breweryId, {}, signal),
          enabled: !!breweryId,
     });
}

export function useCreateBreweryReminder() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: ({ breweryId, data }: { breweryId: string; data: CreateReminderDto }) =>
               apiClient.createBreweryReminderEndpoint(breweryId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.breweryId) });
               notifyCreate('breweries');
          },
          onError: () => {
               notifyCreateError('breweries');
          },
     });
}

export function useUpdateBreweryReminder() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({
               breweryId,
               reminderId,
               data,
          }: {
               breweryId: string;
               reminderId: string;
               data: UpdateReminderDto;
          }) => apiClient.updateBreweryReminderEndpoint(reminderId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.breweryId) });
               notifyUpdate('breweries');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteBreweryReminder() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: ({ breweryId, reminderId }: { breweryId: string; reminderId: string }) =>
               apiClient.deleteBreweryReminderEndpoint(reminderId),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.breweryId) });
               notifyDelete('breweries');
          },
          onError: () => {
               notifyDeleteError('breweries');
          },
     });
}

export function useSetBreweryReminderResolved() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({
               breweryId,
               reminderId,
               resolvedDate,
          }: {
               breweryId: string;
               reminderId: string;
               resolvedDate: Date | undefined;
          }) => {
               const request = new SetBreweryReminderResolvedDateRequest();
               request.resolvedDate = resolvedDate;
               return apiClient.setBreweryReminderResolvedDateEndpoint(reminderId, request);
          },
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: remindersKey(variables.breweryId) });
               notifyUpdate('breweries');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}
