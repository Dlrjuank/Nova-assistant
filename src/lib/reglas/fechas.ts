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
