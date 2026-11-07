import { semanaDe, sumarDias } from './fechas';
import { compararPorHorario } from './horario';

/**
 * E06 (PLAN_AMPLIACION 5.1 y 7.1): reglas puras de Inicio. Las fechas son 'YYYY-MM-DD' ya calculadas en
 * Bogotá (hoyBogota, semanaDe): aquí no hay reloj ni zonas horarias.
 */

const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const partes = (fecha: string) => fecha.split('-').map(Number) as [number, number, number];

/** Los 7 días (lunes a domingo) de la semana de una fecha. */
export function diasDeSemana(fecha: string): string[] {
  const { lunes } = semanaDe(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/** "2 – 8 de nov.", "30 de nov. – 6 de dic." o, si cambia el año, "29 de dic. de 2025 – 4 de ene. de 2026". */
export function rangoSemana(fecha: string): string {
  const { lunes, domingo } = semanaDe(fecha);
  const [a1, m1, d1] = partes(lunes);
  const [a2, m2, d2] = partes(domingo);
  const mes = (m: number) => MESES_CORTOS[m - 1];
  if (a1 !== a2) return `${d1} de ${mes(m1)} de ${a1} – ${d2} de ${mes(m2)} de ${a2}`;
  if (m1 !== m2) return `${d1} de ${mes(m1)} – ${d2} de ${mes(m2)}`;
  return `${d1} – ${d2} de ${mes(m2)}`;
}

/** "lunes 2 de nov." para lectores de pantalla y encabezados. */
export function nombreDia(fecha: string): string {
  const [, m, d] = partes(fecha);
  const indice = diasDeSemana(fecha).indexOf(fecha);
  return `${DIAS_LARGOS[indice]} ${d} de ${MESES_CORTOS[m - 1]}`;
}

export interface TareaSemana {
  id: string;
  titulo: string;
  prioridad: number;
  estado: string;
  fechaLimite: string;
}

export interface Progreso {
  total: number;
  completadas: number;
  pendientes: number;
  /** De 0 a 100, sin decimales y truncado; 0 si no hay tareas (sin dividir por cero). */
  porcentaje: number;
}

/** PLAN_AMPLIACION 7.1: sobre las tareas con fecha límite en la semana mostrada. */
export function progresoSemanal(tareas: ReadonlyArray<Pick<TareaSemana, 'estado'>>): Progreso {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estado === 'Completada').length;
  const porcentaje = total === 0 ? 0 : Math.floor((completadas * 100) / total);
  return { total, completadas, pendientes: total - completadas, porcentaje };
}

/** Prioridades de hoy: pendientes con fecha límite hoy, Alta primero y luego por título. */
export function prioridadesDeHoy<T extends TareaSemana>(tareas: readonly T[], hoy: string): T[] {
  return tareas
    .filter((t) => t.estado !== 'Completada' && t.fechaLimite.slice(0, 10) === hoy)
    .sort((a, b) => b.prioridad - a.prioridad || a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }));
}

/**
 * Agrupa las tareas por día de la semana (por fecha límite). En cada día, primero las que tienen hora
 * (por hora de inicio) y después las demás, por prioridad y título (RB-34).
 */
export function tareasPorDia<T extends Pick<TareaSemana, 'fechaLimite' | 'prioridad' | 'titulo'> & { horaInicio?: string | null; horaFin?: string | null }>(
  tareas: readonly T[],
  dias: readonly string[],
): Record<string, T[]> {
  const grupos: Record<string, T[]> = Object.fromEntries(dias.map((d) => [d, [] as T[]]));
  for (const t of tareas) grupos[t.fechaLimite.slice(0, 10)]?.push(t);
  for (const lista of Object.values(grupos)) lista.sort(compararPorHorario);
  return grupos;
}

/** "1 tarea vencida" / "3 tareas vencidas". */
export function textoVencidas(n: number): string {
  return n === 1 ? '1 tarea vencida' : `${n} tareas vencidas`;
}
