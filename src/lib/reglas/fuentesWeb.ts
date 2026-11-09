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

/** Agrupa por categoría, General primero y luego alfabético, como en Tareas. */
export function agruparFuentes<T extends { categoria: string }>(fuentes: readonly T[]): Array<{ categoria: string; fuentes: T[] }> {
  const grupos = new Map<string, T[]>();
  for (const f of fuentes) grupos.set(f.categoria, [...(grupos.get(f.categoria) ?? []), f]);
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === CATEGORIA_POR_DEFECTO ? -1 : b === CATEGORIA_POR_DEFECTO ? 1 : a.localeCompare(b, 'es')))
    .map(([categoria, lista]) => ({ categoria, fuentes: lista }));
}
