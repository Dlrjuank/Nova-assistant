/**
 * E17, ajuste del usuario (2026-11-17): "Objetivos y plan" muestra una sola materia. La cookie guarda la última
 * materia abierta en este navegador (en "Objetivos y plan" o en la página de la materia), para mostrarla al entrar
 * sin esperar al navegador. Va aquí, fuera de los archivos 'use client', porque la usan el servidor y el cliente.
 */
export const COOKIE_MATERIA = 'nova-materia';

/** La de la dirección (?materia=) si es del usuario; si no, la recordada; si no, la más reciente. */
export function elegirMateria(ids: readonly string[], pedida: string | undefined, recordada: string | undefined, masReciente: string | null): string | null {
  for (const id of [pedida, recordada, masReciente]) if (id && ids.includes(id)) return id;
  return ids[0] ?? null;
}

/** La cookie de un año, solo para las páginas de Nova. */
export const textoCookieMateria = (id: string) => `${COOKIE_MATERIA}=${encodeURIComponent(id)}; path=/nova; max-age=31536000; samesite=lax`;
