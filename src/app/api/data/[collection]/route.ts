import { NextResponse } from 'next/server';
import { getSchema } from '@/../data/_schema/registry';
import { create, getAll, getById, JsonDBError, remove, update } from '@/lib/json-db';
import type { BaseRecord } from '@/lib/types';

interface RouteContext {
  params: Promise<{ collection: string }>;
}

function errorResponse(error: unknown) {
  const normalized = error instanceof JsonDBError ? error : new JsonDBError('Error interno.', 'IO_ERROR');
  return NextResponse.json(
    { success: false, error: normalized.message, code: normalized.code, timestamp: new Date().toISOString() },
    { status: normalized.statusCode },
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { collection } = await context.params;
    if (!getSchema(collection)) {
      throw new JsonDBError(`La colección '${collection}' no está registrada.`, 'NOT_FOUND', 404);
    }
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const data = id
      ? await getById(collection, id)
      : await getAll(collection, {
          limit: Number(url.searchParams.get('limit') ?? 50),
          offset: Number(url.searchParams.get('offset') ?? 0),
          sortBy: url.searchParams.get('sortBy') ?? undefined,
          sortOrder: url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc',
        });

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { collection } = await context.params;
    const schema = getSchema(collection);
    if (!schema) {
      throw new JsonDBError(`La colección '${collection}' no está registrada.`, 'NOT_FOUND', 404);
    }
    const parsed = schema
      .omit({ id: true, createdAt: true, updatedAt: true })
      .safeParse(await request.json());
    if (!parsed.success) {
      throw new JsonDBError('Los datos no cumplen el esquema.', 'VALIDATION_ERROR', 400);
    }
    const data = await create(collection, parsed.data as Omit<BaseRecord, 'id' | 'createdAt' | 'updatedAt'>);
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { collection } = await context.params;
    const schema = getSchema(collection);
    if (!schema) {
      throw new JsonDBError(`La colección '${collection}' no está registrada.`, 'NOT_FOUND', 404);
    }
    const body = (await request.json()) as BaseRecord;
    const { id, ...partial } = body;
    if (!id) {
      throw new JsonDBError('El campo id es obligatorio.', 'VALIDATION_ERROR', 400);
    }
    const data = await update(collection, id, partial);
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { collection } = await context.params;
    if (!getSchema(collection)) {
      throw new JsonDBError(`La colección '${collection}' no está registrada.`, 'NOT_FOUND', 404);
    }
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      throw new JsonDBError('El parámetro id es obligatorio.', 'VALIDATION_ERROR', 400);
    }
    await remove(collection, id);
    return NextResponse.json({ success: true, data: true, timestamp: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
