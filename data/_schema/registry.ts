import { z } from 'zod';
import { exampleRecordSchema } from './example.schema';
import { noteSchema } from './note.schema';

export const schemaRegistry: Record<string, z.ZodType> = {
  example: exampleRecordSchema,
  note: noteSchema,
};

export function getSchema(collection: string): z.ZodType | null {
  return schemaRegistry[collection] ?? null;
}
