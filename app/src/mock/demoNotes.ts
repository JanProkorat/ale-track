// Brewery notes have no backend endpoint (only client notes exist), so they
// can't go through the IClient-typed mockApi. They're served from this
// in-memory store in BOTH real and demo sessions — client-side only, so they
// live for the session and reset on reload. Persisting them needs a backend
// brewery-note endpoint.
import { db, mockId, mockDelay } from './db';

export interface DemoNote {
  id: string;
  text: string;
  createdDate: Date;
}

export function listBreweryNotes(breweryId: string): Promise<DemoNote[]> {
  const rows = db.breweryNotes
    .filter((n) => n.ownerId === breweryId)
    .map((n) => ({ id: n.id, text: n.text, createdDate: n.createdDate }))
    .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  return mockDelay(rows);
}

export function createBreweryNote(breweryId: string, text: string): Promise<string> {
  const id = mockId('bnote');
  db.breweryNotes.unshift({ id, ownerId: breweryId, text, createdDate: new Date() });
  return mockDelay(id);
}

export function deleteBreweryNote(noteId: string): Promise<string> {
  const i = db.breweryNotes.findIndex((n) => n.id === noteId);
  if (i >= 0) db.breweryNotes.splice(i, 1);
  return mockDelay(noteId);
}
