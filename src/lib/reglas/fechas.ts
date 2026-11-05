import { ZONA_HORARIA } from '@/lib/config/nova';

/** Fecha de hoy en Bogotá como 'YYYY-MM-DD'. El reloj se puede inyectar para pruebas. */
export function hoyBogota(reloj: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(reloj);
}

/** Formato YYYY-MM-DD estricto y fecha real del calendario. */
export function esFechaISOValida(fecha: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
