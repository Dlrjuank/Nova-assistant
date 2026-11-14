import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

/** E12: pide a la API de Semestre y devuelve los datos o el mensaje exacto del servidor. */
export async function pedirSemestre<T = unknown>(url: string, metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE', cuerpo?: unknown): Promise<Resultado<T>> {
  try {
    const r = await fetch(url, {
      method: metodo,
      ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
    });
    const d = (await r.json().catch(() => null)) as { ok?: boolean; datos?: T; error?: { mensaje?: string } } | null;
    if (!r.ok || !d?.ok) return { ok: false, mensaje: d?.error?.mensaje ?? MENSAJES.ERROR_INTERNO };
    return { ok: true, datos: d.datos as T };
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' };
  }
}

/** Corre una validación de `reglas/notas.ts` y devuelve su mensaje exacto, o '' si pasa. */
export function mensajeDe(validar: () => unknown): string {
  try {
    validar();
    return '';
  } catch (e) {
    return e instanceof ErrorDeNegocio ? e.message : MENSAJES.DATOS_INVALIDOS;
  }
}
