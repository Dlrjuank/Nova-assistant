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
