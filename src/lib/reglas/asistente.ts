/**
 * E20b (commit 5): reglas del Asistente nuevo: el extracto de una cita que se despliega y las preguntas sugeridas.
 * Funciones puras (sin 'use client'): las usan el servidor y la pantalla.
 */

/** Largo máximo del extracto que se ve al desplegar una cita. */
export const MAX_EXTRACTO_CITA = 320;

/** El texto del fragmento citado, en una línea y cortado en una palabra con "…" si es largo. */
export function extractoCita(contenido: string, max = MAX_EXTRACTO_CITA): string {
  const limpio = contenido.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.–-]+$/, '')}…`;
}

/**
 * Cada fuente de PDF lleva el extracto del primer fragmento con su misma etiqueta (dos fragmentos de la misma
 * página comparten etiqueta, RB-36). Las tareas y la web quedan igual.
 */
export function conExtractos<F extends { tipo: string; etiqueta: string }, G extends { contenido: string }>(
  fuentes: F[],
  fragmentos: readonly G[],
  etiquetaDe: (f: G) => string,
): Array<F & { fragmento?: string }> {
  const porEtiqueta = new Map<string, string>();
  for (const f of fragmentos) {
    const etiqueta = etiquetaDe(f);
    if (!porEtiqueta.has(etiqueta)) porEtiqueta.set(etiqueta, f.contenido);
  }
  return fuentes.map((f) => {
    const contenido = f.tipo === 'pdf' ? porEtiqueta.get(f.etiqueta) : undefined;
    return contenido ? { ...f, fragmento: extractoCita(contenido) } : f;
  });
}

/** Cuántas preguntas sugeridas se muestran. */
export const MAX_SUGERENCIAS = 4;

/**
 * E20b (presentación: "chips con preguntas de ejemplo bajo el chat"): según lo que tiene la persona. Con tareas,
 * sobre la semana y las vencidas; con documentos, sobre el más reciente. Sin nada, cómo empezar.
 */
export function sugerenciasAsistente({ hayTareas, documentos }: { hayTareas: boolean; documentos: ReadonlyArray<{ nombre: string }> }): string[] {
  const lista: string[] = [];
  if (hayTareas) lista.push('¿Qué tengo esta semana?', '¿Qué tareas tengo vencidas?');
  const doc = documentos[0]?.nombre.replace(/\.pdf$/i, '');
  if (doc) lista.push(`Resume las ideas principales de «${doc}»`, `¿Qué temas trata «${doc}»?`);
  if (!hayTareas) lista.push('¿Qué tareas tengo pendientes?');
  return lista.slice(0, MAX_SUGERENCIAS);
}
