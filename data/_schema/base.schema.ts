import { z } from 'zod';

export const baseRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const collectionMetaSchema = z.object({
  version: z.number().int().positive(),
  lastModified: z.iso.datetime(),
  description: z.string(),
});

export const collectionFileSchema = z.object({
  _meta: collectionMetaSchema,
  records: z.array(baseRecordSchema),
});
