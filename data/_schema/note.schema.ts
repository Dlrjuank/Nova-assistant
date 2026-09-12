import { z } from 'zod';
import { baseRecordSchema } from './base.schema';

export const noteSchema = baseRecordSchema.extend({
  title: z.string().min(1).max(200),
  content: z.string().max(5000),
  category: z.enum(['general', 'importante', 'pendiente']),
  pinned: z.boolean().default(false),
});

export const noteInputSchema = noteSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type NoteRecord = z.infer<typeof noteSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
