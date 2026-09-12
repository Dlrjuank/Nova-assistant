import { z } from 'zod';
import { exampleRecordSchema } from './example.schema';
import { noteSchema } from './note.schema';

export const schemaRegistry: Record<string, z.ZodObject<any>> = {
  example: exampleRecordSchema,
  note: noteSchema,
};

export function getSchema(collection: string): z.ZodObject<any> | null {
  return schemaRegistry[collection] ?? null;
}
