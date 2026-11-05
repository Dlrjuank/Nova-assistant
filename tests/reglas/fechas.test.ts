// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aplicarMascaraFecha, esFechaISOValida, esFechaPasada, hoyBogota } from '@/lib/reglas/fechas';

describe('fechas', () => {
  it('T-16 "2026-03-10" es válida', () => {
    expect(esFechaISOValida('2026-03-10')).toBe(true);
  });
  it('rechaza fechas irreales y formatos distintos', () => {
    expect(esFechaISOValida('2026-02-30')).toBe(false);
    expect(esFechaISOValida('03-10-2026')).toBe(false);
    expect(esFechaISOValida('2026-3-1')).toBe(false);
    expect(esFechaISOValida('2024-02-29')).toBe(true);
    expect(esFechaISOValida('2025-02-29')).toBe(false);
  });
  it('máscara AAAA-MM-DD: el guion aparece con el dígito que lo sigue', () => {
    expect(aplicarMascaraFecha('2026')).toBe('2026');
    expect(aplicarMascaraFecha('20260')).toBe('2026-0');
    expect(aplicarMascaraFecha('202602')).toBe('2026-02');
    expect(aplicarMascaraFecha('2026021')).toBe('2026-02-1');
    expect(aplicarMascaraFecha('20260210')).toBe('2026-02-10');
    expect(aplicarMascaraFecha('2026-02-')).toBe('2026-02'); // borrar hacia atrás no se traba en el guion
    expect(aplicarMascaraFecha('2026-02-109')).toBe('2026-02-10'); // máximo 8 dígitos
    expect(aplicarMascaraFecha('2026/02/10')).toBe('2026-02-10');
    expect(aplicarMascaraFecha('abc')).toBe('');
  });
  it('la máscara conserva las fechas irreales para que las rechace esFechaISOValida', () => {
    expect(aplicarMascaraFecha('20260230')).toBe('2026-02-30');
    expect(esFechaISOValida(aplicarMascaraFecha('20260230'))).toBe(false);
    expect(esFechaISOValida(aplicarMascaraFecha('03-10-2026'))).toBe(false);
  });
  it('esFechaPasada: solo fechas válidas anteriores a hoy; hoy no es pasada', () => {
    expect(esFechaPasada('2026-03-09', '2026-03-10')).toBe(true);
    expect(esFechaPasada('2026-03-10', '2026-03-10')).toBe(false);
    expect(esFechaPasada('2026-03-11', '2026-03-10')).toBe(false);
    expect(esFechaPasada('2026-02-30', '2026-03-10')).toBe(false);
    expect(esFechaPasada('2026-0', '2026-03-10')).toBe(false);
  });
  it('hoyBogota usa la zona America/Bogota (UTC-5)', () => {
    expect(hoyBogota(new Date('2026-03-10T03:00:00Z'))).toBe('2026-03-09');
    expect(hoyBogota(new Date('2026-03-10T05:00:00Z'))).toBe('2026-03-10');
  });
});
