import { z } from 'zod';
import { baseRecordSchema } from './base.schema';

export const exampleRecordSchema = baseRecordSchema.extend({
  name: z.string().min(1).max(255),
  active: z.boolean(),
});

export type ExampleRecord = z.infer<typeof exampleRecordSchema>;
