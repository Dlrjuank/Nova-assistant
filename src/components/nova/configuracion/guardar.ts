import type { Configuracion } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

/** Llama a una ruta de Nova y devuelve los datos o el mensaje exacto del error. */
export async function pedirNova<T>(url: string, metodo: 'PATCH' | 'DELETE', cuerpo?: unknown): Promise<Resultado<T>> {
  try {
    const r = await fetch(url, {
      method: metodo,
      ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
    });
    const d = (await r.json().catch(() => null)) as { ok?: boolean; datos?: T; error?: { mensaje?: string } } | null;
    if (!r.ok || !d?.ok || d.datos === undefined) return { ok: false, mensaje: d?.error?.mensaje ?? MENSAJES.ERROR_INTERNO };
    return { ok: true, datos: d.datos };
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' };
  }
}

/** E11: PATCH /api/nova/configuracion con solo los campos que cambian. */
export const guardarConfiguracion = (cambios: Record<string, unknown>) => pedirNova<Configuracion>('/api/nova/configuracion', 'PATCH', cambios);
