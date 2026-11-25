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

/** La etiqueta interna con que una tarea va al modelo ("Tarea 1a2b3c4d"): la persona nunca la ve. */
export const MARCA_TAREA = /^tarea\s+[0-9a-f]{6,}$/i;
/** Las etiquetas cortas de temas y fragmentos en los planes y los temas ("T2", "F3"). */
const MARCA_CORTA = /^[TF]\d{1,3}$/;

/**
 * Quita del texto del modelo las marcas internas que copió del contexto: "[Tarea 1a2b3c4d]" o "(tarea 1a2b3c4d)"
 * y, con `cortas`, "[T2]" o "[F3]". En una cita con varias partes ("[a.pdf · p. 4; Tarea 1a2b3c4d]") se quita
 * solo la marca. Las demás citas (páginas de PDF, fuentes web) quedan igual.
 */
export function sinMarcasInternas(texto: string, opciones: { cortas?: boolean } = {}): string {
  const esMarca = (parte: string) => MARCA_TAREA.test(parte) || (opciones.cortas === true && MARCA_CORTA.test(parte));
  return texto
    .split('\n')
    .map((linea) => {
      const limpia = linea.replace(/[ \t]*([[(])([^\])\n]*)([\])])/g, (todo, abre: string, dentro: string, cierra: string) => {
        if ((abre === '[') !== (cierra === ']')) return todo;
        const partes = dentro.split(/\s*[;,]\s*/);
        const quedan = partes.filter((p) => !esMarca(p.trim()));
        if (quedan.length === partes.length) return todo;
        if (quedan.length === 0) return '';
        return `${/^[ \t]*/.exec(todo)?.[0] ?? ''}${abre}${quedan.join('; ')}${cierra}`;
      });
      if (limpia === linea) return linea;
      const sangria = /^[ \t]*/.exec(linea)?.[0] ?? '';
      const resto = limpia.slice(sangria.length).trimStart();
      return sangria + resto.replace(/(\S)[ \t]{2,}/g, '$1 ').replace(/[ \t]+([.,;:!?])/g, '$1').trimEnd();
    })
    .join('\n');
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
