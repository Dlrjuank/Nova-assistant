import { create, getAll, getById, remove, update } from '@/lib/json-db';
import type { NoteInput, NoteRecord } from './types';

export async function listNotes() {
  return getAll<NoteRecord>('note', { limit: 100, sortBy: 'updatedAt', sortOrder: 'desc' });
}

export function getNote(id: string) {
  return getById<NoteRecord>('note', id);
}

export function createNote(input: NoteInput) {
  return create<NoteRecord>('note', input);
}

export function updateNote(id: string, input: Partial<NoteInput>) {
  return update<NoteRecord>('note', id, input);
}

export function deleteNote(id: string) {
  return remove('note', id);
}
