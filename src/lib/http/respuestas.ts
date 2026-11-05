import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { ErrorDeNegocio, ESTADO_HTTP, MENSAJES, type CodigoError } from '@/lib/reglas/errores';

const CABECERAS = { 'Cache-Control': 'no-store' };

export function responderOk<T>(datos: T, estado = 200): NextResponse {
  return NextResponse.json({ ok: true, datos }, { status: estado, headers: CABECERAS });
}

function cuerpoError(codigo: CodigoError, mensaje?: string, detalles: unknown = null) {
  return { ok: false, error: { codigo, mensaje: mensaje ?? MENSAJES[codigo], detalles } };
}

/** Traduce cualquier error a la respuesta del contrato (secciones 8.4, 12.1 y 12.2). */
export function responderError(error: unknown): NextResponse {
  if (error instanceof ErrorDeNegocio) {
    return NextResponse.json(cuerpoError(error.codigo, error.message, error.detalles ?? null), {
      status: ESTADO_HTTP[error.codigo],
      headers: CABECERAS,
    });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(cuerpoError('DATOS_INVALIDOS', undefined, error.flatten()), {
      status: ESTADO_HTTP.DATOS_INVALIDOS,
      headers: CABECERAS,
    });
  }

  const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
  let codigo: CodigoError = 'ERROR_INTERNO';
  if (code === '23514') codigo = constraint === 'tareas_prioridad_valida' ? 'PRIORIDAD_INVALIDA' : 'DATOS_INVALIDOS';
  else if (code === '42704' || code === '42883') {
    console.error('Falta la extensión vector o la función buscar_fragmentos: habilite pgvector.', error);
  } else {
    console.error('Error interno', error);
  }
  return NextResponse.json(cuerpoError(codigo), { status: ESTADO_HTTP[codigo], headers: CABECERAS });
}

/** Envuelve un handler para que cualquier error salga con el formato del contrato. */
export function conManejoDeErrores<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return responderError(error);
    }
  };
}

/** Lee el cuerpo JSON y lo valida con el esquema; un cuerpo ausente o mal formado es DATOS_INVALIDOS. */
export async function leerCuerpo<T>(request: Request, esquema: ZodType<T>): Promise<T> {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    throw new ErrorDeNegocio('DATOS_INVALIDOS');
  }
  return esquema.parse(crudo);
}
