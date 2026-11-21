import { semanaDe, sumarDias } from './fechas';

/**
 * E07 (PLAN_AMPLIACION 5.3): reglas puras del Calendario. Fechas 'YYYY-MM-DD' y meses 'YYYY-MM', ya en
 * Bogotá (hoyBogota): aquí no hay reloj ni zonas horarias.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function esMesValido(mes: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  return Boolean(m && Number(m[2]) >= 1 && Number(m[2]) <= 12);
}

/** 'YYYY-MM' de una fecha 'YYYY-MM-DD'. */
export const mesDe = (fecha: string) => fecha.slice(0, 7);

/** Mes anterior o siguiente: '2026-12' + 1 → '2027-01'. */
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "noviembre de 2026". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return `${MESES[m - 1]} de ${a}`;
}

/**
 * Cuadrícula del mes, de lunes a domingo, en semanas completas: incluye los días del mes anterior y del
 * siguiente que completan la primera y la última semana (4 a 6 semanas).
 */
export function semanasDelMes(mes: string): string[][] {
  const primero = `${mes}-01`;
  const ultimo = sumarDias(`${sumarMeses(mes, 1)}-01`, -1);
  const semanas: string[][] = [];
  for (let lunes = semanaDe(primero).lunes; lunes <= ultimo; lunes = sumarDias(lunes, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)));
  }
  return semanas;
}

/** Una tarea pendiente con fecha límite antes de hoy (marca sutil "Vencida"). */
export function estaVencida(t: { estado: string; fechaLimite: string }, hoy: string): boolean {
  return t.estado !== 'Completada' && t.fechaLimite.slice(0, 10) < hoy;
}

/** E20b (commit 4): cuántos días hacia adelante mira "Próximos" y cuántos muestra. */
export const DIAS_PROXIMOS = 30;
export const MAX_PROXIMOS = 5;

export interface Proximo {
  id: string;
  tipo: 'tarea' | 'corte' | 'nota';
  fecha: string;
  titulo: string;
  /** Tarea: su categoría (para el color). Semestre: la materia a la que lleva. */
  categoria?: string;
  materiaId?: string;
  horaInicio?: string | null;
}

/**
 * E20b (commit 4, presentación): "Próximos" del Calendario. Las tareas pendientes y las fechas de Semestre desde
 * hoy, en orden de fecha; el mismo día, primero Semestre (un corte pesa más) y luego las tareas por hora. Como
 * máximo `max`.
 */
export function proximosDelCalendario(
  tareas: ReadonlyArray<{ id: string; titulo: string; categoria: string; estado: string; fechaLimite: string; horaInicio?: string | null }>,
  eventos: ReadonlyArray<{ id: string; tipo: 'corte' | 'nota'; fecha: string; titulo: string; materiaId: string }>,
  hoy: string,
  max = MAX_PROXIMOS,
): Proximo[] {
  const lista: Proximo[] = [
    ...eventos.filter((e) => e.fecha >= hoy).map((e) => ({ id: e.id, tipo: e.tipo, fecha: e.fecha, titulo: e.titulo, materiaId: e.materiaId })),
    ...tareas
      .filter((t) => t.estado !== 'Completada' && t.fechaLimite >= hoy)
      .map((t) => ({ id: t.id, tipo: 'tarea' as const, fecha: t.fechaLimite, titulo: t.titulo, categoria: t.categoria, horaInicio: t.horaInicio ?? null })),
  ];
  const peso = (p: Proximo) => (p.tipo === 'tarea' ? 1 : 0);
  lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || peso(a) - peso(b) || (a.horaInicio ?? '99').localeCompare(b.horaInicio ?? '99') || a.titulo.localeCompare(b.titulo, 'es'));
  return lista.slice(0, max);
}

/** E20b (commit 4): la etiqueta de cada próximo. */
export const ETIQUETA_PROXIMO: Record<Proximo['tipo'], string> = { tarea: 'Tarea', corte: 'Corte', nota: 'Nota' };
