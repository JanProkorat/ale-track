import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'src/auth/AuthProvider';
import { listBreweryNotes, createBreweryNote, deleteBreweryNote } from 'src/mock/demoNotes';

// Brewery notes are demo-only (no backend endpoint). The queries run only in
// demo sessions; in real sessions the Poznámky tab shows an "unavailable" state.
const key = (breweryId: string) => ['breweryNotes', breweryId] as const;

export function useBreweryNotes(breweryId: string | undefined) {
  const { isDemo } = useAuth();
  return useQuery({
    queryKey: key(breweryId ?? ''),
    queryFn: () => listBreweryNotes(breweryId!),
    enabled: isDemo && Boolean(breweryId),
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
