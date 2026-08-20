// Brewery notes — real backend endpoints (GET/CREATE/DELETE), same shape as
// client notes. Calls go through useDataSource() like every other module hook.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { CreateNoteDto } from 'src/generated/api-client';

export function useBreweryNotes(breweryId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.breweryNotes(breweryId ?? ''),
    queryFn: ({ signal }) => ds.getBreweryNotesEndpoint(breweryId!, signal),
    enabled: Boolean(breweryId),
  });
}

export function useCreateBreweryNote(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => ds.createBreweryNoteEndpoint(breweryId, new CreateNoteDto({ text })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryNotes(breweryId) }),
  });
}

export function useDeleteBreweryNote(breweryId: string) {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => ds.deleteBreweryNoteEndpoint(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.breweryNotes(breweryId) }),
  });
}
