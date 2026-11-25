/**
 * E20c-1 (7.15, S-84): ningún registro ni mensaje lleva una clave de Gemini. Borra lo que tenga forma de clave de
 * Google (empieza con "AIza"), el parámetro `key=` de una dirección, el encabezado `x-goog-api-key` y, si se da,
 * la clave exacta que se está usando (por si tuviera otra forma).
 */
export function ocultarClave(texto: string, clave?: string): string {
  let limpio = texto;
  if (clave && clave.length >= 8) limpio = limpio.split(clave).join('[clave oculta]');
  return limpio
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[clave oculta]')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[clave oculta]')
    .replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[clave oculta]');
}

/** El texto de un error (mensaje y causa) sin claves, para el registro. */
export function errorSinClave(error: unknown, clave?: string): string {
  const e = error as { message?: unknown; status?: unknown; name?: unknown } | null;
  const base = e && typeof e === 'object' ? `${String(e.name ?? 'Error')}${e.status ? ` ${String(e.status)}` : ''}: ${String(e.message ?? '')}` : String(error);
  return ocultarClave(base, clave);
}
