import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { colorDeCategoria, type ColorCategoria } from './categorias';
import { sumarDias } from './fechas';

/**
 * E08 (PLAN_AMPLIACION 5.4): pestañas de Tareas. "vencidas" no es una pestaña fija: es la vista a la que
 * lleva "N tareas vencidas" desde Inicio, y su píldora solo aparece mientras se está en ella (decisión del
 * usuario, 2026-11-07).
 */
export const PESTANAS_TAREAS = ['todas', 'hoy', 'importantes', 'completadas'] as const;
export type Vista = (typeof PESTANAS_TAREAS)[number] | 'vencidas';

export const TEXTO_VISTA: Record<Vista, string> = {
  todas: 'Todas',
  hoy: 'Hoy',
  importantes: 'Importantes',
  completadas: 'Completadas',
  vencidas: 'Vencidas',
};

const VISTAS: readonly string[] = [...PESTANAS_TAREAS, 'vencidas'];

/**
 * La vista de la URL (`?vista=`). Los enlaces viejos con `?estado=` siguen sirviendo: Completada →
 * "completadas" y Pendiente (el de "N tareas vencidas" antes de E08) → "vencidas". Lo demás, "todas".
 */
export function vistaDeParametros(vista?: string, estado?: string): Vista {
  if (vista && VISTAS.includes(vista)) return vista as Vista;
  if (estado === 'Completada') return 'completadas';
  if (estado === 'Pendiente') return 'vencidas';
  return 'todas';
}

/** Filtro del servicio para cada vista, con la fecha de hoy en Bogotá. */
export interface FiltroVista {
  estado?: 'Completada';
  soloPendientes?: true;
  prioridad?: number;
  desde?: string;
  hasta?: string;
}

export function filtroDeVista(vista: Vista, hoy: string): FiltroVista {
  switch (vista) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }; // fecha límite hoy, pendientes y completadas (el contador muestra el avance)
    case 'importantes':
      return { soloPendientes: true, prioridad: 3 }; // Alta y pendientes
    case 'completadas':
      return { estado: 'Completada' };
    case 'vencidas':
      return { soloPendientes: true, hasta: sumarDias(hoy, -1) };
    default:
      return {};
  }
}

/** Texto del estado vacío de cada vista, con la categoría si hay filtro. */
export function textoVacio(vista: Vista, categoria: string | null): string {
  const base: Record<Vista, string> = {
    todas: 'Aún no tienes tareas',
    hoy: 'No tienes tareas para hoy',
    importantes: 'No tienes tareas importantes pendientes',
    completadas: 'Aún no has completado tareas',
    vencidas: 'No tienes tareas vencidas',
  };
  if (!categoria) return base[vista];
  return vista === 'todas' ? `No hay tareas en «${categoria}»` : `${base[vista]} en «${categoria}»`;
}

export interface GrupoCategoria<T> {
  nombre: string;
  color: ColorCategoria;
  completadas: number;
  total: number;
  tareas: T[];
}

/**
 * Agrupa por categoría (sin distinguir mayúsculas ni espacios), con el nombre registrado si existe.
 * Orden: General primero y luego alfabético, como la fila de categorías. Dentro de cada grupo se respeta el
 * orden recibido (fecha límite y hora), con las completadas al final. El contador es completadas/total
 * dentro de la vista.
 */
export function agruparPorCategoria<T extends { categoria: string; estado: string }>(
  tareas: readonly T[],
  categorias: ReadonlyArray<{ nombre: string; color: string }>,
): GrupoCategoria<T>[] {
  const grupos = new Map<string, GrupoCategoria<T>>();
  for (const t of tareas) {
    const limpio = t.categoria.trim().replace(/\s+/g, ' ') || CATEGORIA_POR_DEFECTO;
    const clave = limpio.toLowerCase();
    let grupo = grupos.get(clave);
    if (!grupo) {
      const registrada = categorias.find((c) => c.nombre.toLowerCase() === clave);
      grupo = { nombre: registrada?.nombre ?? limpio, color: colorDeCategoria(limpio, categorias), completadas: 0, total: 0, tareas: [] };
      grupos.set(clave, grupo);
    }
    grupo.total += 1;
    if (t.estado === 'Completada') grupo.completadas += 1;
    grupo.tareas.push(t);
  }
  const general = CATEGORIA_POR_DEFECTO.toLowerCase();
  return [...grupos.entries()]
    .sort(([a, ga], [b, gb]) => (a === general ? -1 : b === general ? 1 : ga.nombre.localeCompare(gb.nombre, 'es')))
    .map(([, g]) => ({
      ...g,
      tareas: [...g.tareas.filter((t) => t.estado !== 'Completada'), ...g.tareas.filter((t) => t.estado === 'Completada')],
    }));
}
