import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BaseRecord,
  CollectionFile,
  CreateInput,
  QueryOptions,
  QueryResult,
  UpdateInput,
} from './types';
import { generateId, now, safeJsonParse } from './utils';

export type JsonDBErrorCode = 'NOT_FOUND' | 'DUPLICATE_ID' | 'VALIDATION_ERROR' | 'IO_ERROR';

export class JsonDBError extends Error {
  constructor(
    message: string,
    public readonly code: JsonDBErrorCode,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = 'JsonDBError';
  }
}

export class ReadOnlyError extends JsonDBError {
  constructor() {
    super('Las escrituras están deshabilitadas en producción.', 'IO_ERROR', 503);
    this.name = 'ReadOnlyError';
  }
}

const locks = new Map<string, Promise<void>>();

function dataDirectory(): string {
  return path.resolve(process.env.DATA_DIR ?? './data');
}

export function resolveCollectionPath(collection: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection)) {
    throw new JsonDBError('Nombre de colección inválido.', 'VALIDATION_ERROR', 400);
  }

  return path.join(dataDirectory(), `${collection}.json`);
}

async function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, current);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(key) === current) {
      locks.delete(key);
    }
  }
}

export async function readCollection<T extends BaseRecord>(
  collection: string,
): Promise<CollectionFile<T>> {
  const filePath = resolveCollectionPath(collection);

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = safeJsonParse<CollectionFile<T>>(raw);
    if (!parsed || !Array.isArray(parsed.records) || !parsed._meta) {
      throw new JsonDBError('La colección no tiene un formato válido.', 'VALIDATION_ERROR', 422);
    }
    return parsed;
  } catch (error) {
    if (error instanceof JsonDBError) {
      throw error;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new JsonDBError(`La colección '${collection}' no existe.`, 'NOT_FOUND', 404);
    }
    throw new JsonDBError('No se pudo leer la colección.', 'IO_ERROR');
  }
}

async function writeCollection<T extends BaseRecord>(
  collection: string,
  data: CollectionFile<T>,
): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new ReadOnlyError();
  }

  const filePath = resolveCollectionPath(collection);
  const backupDirectory = path.join(dataDirectory(), '_backups');

  await withLock(filePath, async () => {
    await mkdir(backupDirectory, { recursive: true });
    try {
      await copyFile(filePath, path.join(backupDirectory, `${collection}_${Date.now()}.json`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new JsonDBError('No se pudo crear el backup.', 'IO_ERROR');
      }
    }

    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
      await rename(temporaryPath, filePath);
    } catch {
      throw new JsonDBError('No se pudo escribir la colección.', 'IO_ERROR');
    }
  });
}

export async function getAll<T extends BaseRecord>(
  collection: string,
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  const file = await readCollection<T>(collection);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? 50);
  const records = [...file.records];

  if (options.sortBy) {
    const sortBy = options.sortBy;
    const direction = options.sortOrder === 'desc' ? -1 : 1;
    records.sort((left, right) => String(left[sortBy as keyof T] ?? '').localeCompare(String(right[sortBy as keyof T] ?? '')) * direction);
  }

  return { data: records.slice(offset, offset + limit), total: records.length, limit, offset };
}

export async function getById<T extends BaseRecord>(collection: string, id: string): Promise<T | null> {
  const file = await readCollection<T>(collection);
  return file.records.find((record) => record.id === id) ?? null;
}

export async function create<T extends BaseRecord>(
  collection: string,
  input: CreateInput<T>,
): Promise<T> {
  const file = await readCollection<T>(collection);
  const prefix = collection.replace(/[^a-z0-9]/g, '').slice(0, 3) || 'rec';
  const record = { ...input, id: generateId(prefix), createdAt: now(), updatedAt: now() } as T;

  if (file.records.some((existing) => existing.id === record.id)) {
    throw new JsonDBError('El ID generado ya existe.', 'DUPLICATE_ID', 409);
  }

  file.records.push(record);
  file._meta.lastModified = now();
  await writeCollection(collection, file);
  return record;
}

export async function update<T extends BaseRecord>(
  collection: string,
  id: string,
  partial: UpdateInput<T>,
): Promise<T> {
  const file = await readCollection<T>(collection);
  const index = file.records.findIndex((record) => record.id === id);
  if (index < 0) {
    throw new JsonDBError(`No existe el registro '${id}'.`, 'NOT_FOUND', 404);
  }

  const existing = file.records[index];
  if (!existing) {
    throw new JsonDBError(`No existe el registro '${id}'.`, 'NOT_FOUND', 404);
  }
  const updated = { ...existing, ...partial, id, updatedAt: now() } as T;
  file.records[index] = updated;
  file._meta.lastModified = now();
  await writeCollection(collection, file);
  return updated;
}

export async function remove(collection: string, id: string): Promise<boolean> {
  const file = await readCollection(collection);
  const originalLength = file.records.length;
  file.records = file.records.filter((record) => record.id !== id);
  if (file.records.length === originalLength) {
    throw new JsonDBError(`No existe el registro '${id}'.`, 'NOT_FOUND', 404);
  }
  file._meta.lastModified = now();
  await writeCollection(collection, file);
  return true;
}

export async function query<T extends BaseRecord>(
  collection: string,
  filter: (record: T) => boolean,
): Promise<T[]> {
  const file = await readCollection<T>(collection);
  return file.records.filter(filter);
}

export async function count(collection: string): Promise<number> {
  const file = await readCollection(collection);
  return file.records.length;
}
