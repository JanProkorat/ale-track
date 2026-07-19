import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listBreweryNotes, createBreweryNote, deleteBreweryNote } from 'src/mock/demoNotes';

// Brewery notes are client-side only (no backend endpoint yet), so these run in
// both real and demo sessions against the in-memory store.
const key = (breweryId: string) => ['breweryNotes', breweryId] as const;

export function useBreweryNotes(breweryId: string | undefined) {
  return useQuery({
    queryKey: key(breweryId ?? ''),
    queryFn: () => listBreweryNotes(breweryId!),
    enabled: Boolean(breweryId),
  });
}

export function useCreateBreweryNote(breweryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => createBreweryNote(breweryId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(breweryId) }),
  });
}

export function useDeleteBreweryNote(breweryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => deleteBreweryNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(breweryId) }),
  });
}
