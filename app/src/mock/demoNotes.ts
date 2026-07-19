// Brewery notes exist only in demo mode — the backend has no brewery-note
// endpoint (only client notes), so these can't go through the IClient-typed
// mockApi. The Poznámky tab uses these directly when the session is demo.
import { NoteDto } from 'src/generated/api-client';
import { db, mockId, mockDelay } from './db';

export function listBreweryNotes(breweryId: string): Promise<NoteDto[]> {
  const rows = db.breweryNotes
    .filter((n) => n.ownerId === breweryId)
    .map((n) => new NoteDto({ id: n.id, text: n.text }));
  return mockDelay(rows);
}

export function createBreweryNote(breweryId: string, text: string): Promise<string> {
  const id = mockId('bnote');
  db.breweryNotes.unshift({ id, ownerId: breweryId, text });
  return mockDelay(id);
}

export function deleteBreweryNote(noteId: string): Promise<string> {
  const i = db.breweryNotes.findIndex((n) => n.id === noteId);
  if (i >= 0) db.breweryNotes.splice(i, 1);
  return mockDelay(noteId);
}
