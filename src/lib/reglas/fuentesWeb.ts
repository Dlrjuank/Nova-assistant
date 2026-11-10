import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';

/** E10b2 (RB-54): el nombre del artículo sale de su dirección; la tabla no guarda el título. */
export function tituloDeArticulo(url: string): string {
  try {
    const segmento = new URL(url).pathname.split('/').pop() ?? '';
    return decodeURIComponent(segmento).replaceAll('_', ' ') || url;
  } catch {
    return url;
  }
}

/** E10c2: valores especiales de "Buscar en" y de `mensajes_chat.origen` (M21). Sin origen = documentos y tareas. */
export const BUSCAR_EN_WEB = 'web';
export const BUSCAR_EN_WIKIPEDIA = 'wikipedia';
export type OrigenMensaje = typeof BUSCAR_EN_WEB | typeof BUSCAR_EN_WIKIPEDIA;

export function origenDeBuscarEn(documentoId: string | undefined): OrigenMensaje | null {
  return documentoId === BUSCAR_EN_WEB || documentoId === BUSCAR_EN_WIKIPEDIA ? documentoId : null;
}

/** RB-55: solo se guardan artículos de Wikipedia en español. */
export function esUrlDeWikipedia(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'es.wikipedia.org';
  } catch {
    return false;
  }
}

/** RB-56: "Fotosíntesis · Wikipedia". */
export const etiquetaFuenteWeb = (url: string) => `${tituloDeArticulo(url)} · Wikipedia`;

/** RN-14 para fuentes web: las que el modelo citó; si no citó ninguna, todas las entregadas. */
export function fuentesCitadas<T extends { etiqueta: string }>(respuesta: string, entregadas: readonly T[]): T[] {
  const unicas = [...new Map(entregadas.map((f) => [f.etiqueta, f])).values()];
  const citadas = unicas.filter((f) => respuesta.includes(f.etiqueta));
  return citadas.length > 0 ? citadas : unicas;
}

/** Agrupa por categoría, General primero y luego alfabético, como en Tareas. */
export function agruparFuentes<T extends { categoria: string }>(fuentes: readonly T[]): Array<{ categoria: string; fuentes: T[] }> {
  const grupos = new Map<string, T[]>();
  for (const f of fuentes) grupos.set(f.categoria, [...(grupos.get(f.categoria) ?? []), f]);
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === CATEGORIA_POR_DEFECTO ? -1 : b === CATEGORIA_POR_DEFECTO ? 1 : a.localeCompare(b, 'es')))
    .map(([categoria, lista]) => ({ categoria, fuentes: lista }));
}
