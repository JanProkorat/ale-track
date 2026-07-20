// Client notes — real backend endpoints, called through useDataSource() like
// every other module hook.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { CreateNoteDto } from 'src/generated/api-client';

export function useClientNotes(clientId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clientNotes(clientId ?? ''),
    queryFn: ({ signal }) => ds.getClientNotesEndpoint(clientId!, signal),
    enabled: Boolean(clientId),
  });
}

export function useCreateClientNote(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => ds.createClientNoteEndpoint(clientId, new CreateNoteDto({ text })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientNotes(clientId) }),
  });
}

export function useDeleteClientNote(clientId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => ds.deleteClientNoteEndpoint(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clientNotes(clientId) }),
  });
}
