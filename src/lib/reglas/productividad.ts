import { MINUTOS_TOPE_INDICE } from '@/lib/config/nova';

export type NivelProductividad = 'Bajo' | 'Aceptable' | 'Excelente';

/**
 * RN-03: puntos = completadas/totales × 70 + min(minutos, 120) × 0.25, redondeado HACIA ABAJO a un decimal.
 * totales = 0 no se maneja aquí: el servicio corta antes (RN-18).
 */
export function calcularIndice(d: { completadas: number; totales: number; minutos: number }): {
  puntos: number;
  nivel: NivelProductividad;
} {
  const bruto = (d.completadas * 70) / d.totales + Math.min(d.minutos, MINUTOS_TOPE_INDICE) * 0.25;
  // 1e-9 absorbe el error binario de los flotantes sin alterar el redondeo hacia abajo
  const puntos = Math.floor(bruto * 10 + 1e-9) / 10;
  const nivel: NivelProductividad = puntos < 50 ? 'Bajo' : puntos < 80 ? 'Aceptable' : 'Excelente';
  return { puntos, nivel };
}
