import type { CreateNoteDto, UpdateNoteDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const notesKey = (clientId: string) => ['clients', clientId, 'notes'];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useClientNotes(clientId: string) {
     return useQuery({
          queryKey: notesKey(clientId),
          queryFn: ({ signal }) => apiClient.getClientNotesEndpoint(clientId, signal),
          enabled: !!clientId,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateClientNote() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: ({ clientId, data }: { clientId: string; data: CreateNoteDto }) =>
               apiClient.createClientNoteEndpoint(clientId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: notesKey(variables.clientId) });
               notifyCreate('clients');
          },
          onError: () => {
               notifyCreateError('clients');
          },
     });
}

export function useUpdateClientNote() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({
               clientId,
               noteId,
               data,
          }: {
               clientId: string;
               noteId: string;
               data: UpdateNoteDto;
          }) => apiClient.updateClientNoteEndpoint(noteId, data),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: notesKey(variables.clientId) });
               notifyUpdate('clients');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteClientNote() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: ({ clientId, noteId }: { clientId: string; noteId: string }) =>
               apiClient.deleteClientNoteEndpoint(noteId),
          onSuccess: (_result, variables) => {
               queryClient.invalidateQueries({ queryKey: notesKey(variables.clientId) });
               notifyDelete('clients');
          },
          onError: () => {
               notifyDeleteError('clients');
          },
     });
}
