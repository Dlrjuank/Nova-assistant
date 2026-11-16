import { formatearMinutos } from '@/lib/formato';
import { ErrorDeNegocio } from './errores';
import { hoyBogota, semanaDe } from './fechas';

/**
 * E15 (PLAN_AMPLIACION 5.6, 7.8; RB-16, RB-17): reglas puras de las metas semanales. El progreso cuenta las
 * tareas completadas con fecha de cierre dentro de la semana actual (lunes a domingo, Bogotá), no por su fecha
 * límite como el índice diario. Una meta con categoría solo cuenta las de esa categoría (sin mayúsculas).
 */

export type TipoMeta = 'tareas' | 'minutos';

export interface MetaSemanal {
  id: string;
  tipo: TipoMeta;
  categoria: string | null; // null = todas las categorías
  objetivo: number; // tareas, o minutos en las de tiempo
}

export interface TareaCerrada {
  estado: string;
  fechaCierre: string | null; // 'YYYY-MM-DD'
  categoria: string;
  minutosInvertidos: number | null;
}

export interface ProgresoMeta {
  progreso: number;
  porcentaje: number; // 0 a 100, truncado
  cumplida: boolean;
}

/** La semana actual en Bogotá: un domingo a las 23:59 de Bogotá aún es esa semana, aunque en UTC ya sea lunes. */
export function semanaActual(reloj: Date = new Date()): { lunes: string; domingo: string } {
  return semanaDe(hoyBogota(reloj));
}

const normalizar = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLowerCase();

/** 7.8: progreso de la semana [lunes, domingo]. Porcentaje = min(progreso / objetivo, 100 %), truncado. */
export function progresoMeta(meta: Pick<MetaSemanal, 'tipo' | 'categoria' | 'objetivo'>, tareas: readonly TareaCerrada[], semana: { lunes: string; domingo: string }): ProgresoMeta {
  const categoria = meta.categoria === null ? null : normalizar(meta.categoria);
  const cuentan = tareas.filter(
    (t) =>
      t.estado === 'Completada' &&
      t.fechaCierre !== null &&
      t.fechaCierre >= semana.lunes &&
      t.fechaCierre <= semana.domingo &&
      (categoria === null || normalizar(t.categoria) === categoria),
  );
  const progreso = meta.tipo === 'tareas' ? cuentan.length : cuentan.reduce((suma, t) => suma + (t.minutosInvertidos ?? 0), 0);
  const porcentaje = Math.min(100, Math.floor((progreso * 100) / meta.objetivo));
  return { progreso, porcentaje, cumplida: progreso >= meta.objetivo };
}

/** "7 de 10 tareas", "1 de 1 tarea" o "3 h 20 min de 5 h". */
export function textoProgreso(meta: Pick<MetaSemanal, 'tipo' | 'objetivo'>, progreso: number): string {
  if (meta.tipo === 'minutos') return `${formatearMinutos(progreso)} de ${formatearMinutos(meta.objetivo)}`;
  return `${progreso} de ${meta.objetivo} ${meta.objetivo === 1 ? 'tarea' : 'tareas'}`;
}

/** "Tareas completadas" o "Tiempo dedicado", con la categoría o "todas las categorías". */
export function tituloMeta(meta: Pick<MetaSemanal, 'tipo' | 'categoria'>): string {
  return `${meta.tipo === 'tareas' ? 'Tareas completadas' : 'Tiempo dedicado'} · ${meta.categoria ?? 'Todas las categorías'}`;
}

const TOPE_TAREAS = 1000;
const TOPE_HORAS = 168; // las horas de una semana

const entero = (v: string | number): number | null => {
  const t = typeof v === 'number' ? String(v) : v.trim();
  return /^\d{1,6}$/.test(t) ? Number(t) : null;
};

/** RB-16: un objetivo de tareas es un entero de 1 a 1000. */
export function validarObjetivoTareas(valor: string | number): number {
  const n = entero(valor);
  if (n === null || n < 1 || n > TOPE_TAREAS) throw new ErrorDeNegocio('OBJETIVO_INVALIDO');
  return n;
}

/**
 * RB-16: el de tiempo se escribe en horas y minutos y se guarda en minutos. Horas vacías = 0; minutos de 0 a
 * 59; el total, más de 0 y como mucho las 168 horas de una semana.
 */
export function validarObjetivoMinutos(horas: string | number, minutos: string | number): number {
  const h = typeof horas === 'string' && horas.trim() === '' ? 0 : entero(horas);
  const m = typeof minutos === 'string' && minutos.trim() === '' ? 0 : entero(minutos);
  if (h === null || m === null || m > 59) throw new ErrorDeNegocio('OBJETIVO_INVALIDO');
  const total = h * 60 + m;
  if (total < 1 || total > TOPE_HORAS * 60) throw new ErrorDeNegocio('OBJETIVO_INVALIDO');
  return total;
}
