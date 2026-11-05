// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { calcularIndice } from '@/lib/reglas/productividad';

describe('productividad', () => {
  it('T-24 4/5 con 120 min → 86.0 Excelente', () => {
    expect(calcularIndice({ completadas: 4, totales: 5, minutos: 120 })).toEqual({ puntos: 86, nivel: 'Excelente' });
  });
  it('T-25 3/5 con 30 min → 49.5 Bajo', () => {
    expect(calcularIndice({ completadas: 3, totales: 5, minutos: 30 })).toEqual({ puntos: 49.5, nivel: 'Bajo' });
  });
  it('T-26 5/5 con 0 min → 70.0 Aceptable', () => {
    expect(calcularIndice({ completadas: 5, totales: 5, minutos: 0 })).toEqual({ puntos: 70, nivel: 'Aceptable' });
  });
  it('T-27 bruto 79.93 se redondea hacia abajo a 79.9 y sigue Aceptable', () => {
    // 999/1000 × 70 = 69.93; 40 min × 0.25 = 10; bruto 79.93
    expect(calcularIndice({ completadas: 999, totales: 1000, minutos: 40 })).toEqual({
      puntos: 79.9,
      nivel: 'Aceptable',
    });
  });
  it('T-28 0/4 con 0 min → 0.0 Bajo', () => {
    expect(calcularIndice({ completadas: 0, totales: 4, minutos: 0 })).toEqual({ puntos: 0, nivel: 'Bajo' });
  });
  it('aplica el tope de 120 minutos', () => {
    expect(calcularIndice({ completadas: 5, totales: 5, minutos: 500 }).puntos).toBe(100);
  });
});
