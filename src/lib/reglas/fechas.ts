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

/**
 * Máscara AAAA-MM-DD: deja solo dígitos (hasta 8) y pone cada guion cuando llega el dígito que lo sigue,
 * para que borrar hacia atrás no se trabe en un guion.
 */
export function aplicarMascaraFecha(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/** RN-07 permite fechas pasadas; esto solo sirve para avisar. Compara textos YYYY-MM-DD. */
export function esFechaPasada(fecha: string, hoy: string): boolean {
  return esFechaISOValida(fecha) && fecha < hoy;
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD', con aritmética de calendario (sin horas ni zonas). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** PLAN_AMPLIACION 7.1: la semana de una fecha, de lunes a domingo. */
export function semanaDe(fecha: string): { lunes: string; domingo: string } {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0 = domingo
  const lunes = sumarDias(fecha, -((diaSemana + 6) % 7));
  return { lunes, domingo: sumarDias(lunes, 6) };
}

/** "viernes, 6 de noviembre de 2026" a partir de 'YYYY-MM-DD' (la fecha ya está en Bogotá). */
export function fechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

/**
 * RB-31: primera línea del contexto del Asistente. Hoy, mañana y la semana se calculan en America/Bogota,
 * nunca con la hora del servidor (Vercel corre en UTC: a las 19:00 de Bogotá, UTC ya es el día siguiente).
 */
export function lineaHoy(reloj: Date = new Date()): string {
  const hoy = hoyBogota(reloj);
  const { lunes, domingo } = semanaDe(hoy);
  return (
    `HOY: ${fechaLarga(hoy)} (${hoy}), hora de Bogotá. ` +
    `Mañana: ${sumarDias(hoy, 1)}. ` +
    `Esta semana: del ${fechaLarga(lunes)} (${lunes}) al ${fechaLarga(domingo)} (${domingo}).`
  );
}
