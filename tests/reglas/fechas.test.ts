// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { esFechaISOValida, hoyBogota } from '@/lib/reglas/fechas';

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
  it('hoyBogota usa la zona America/Bogota (UTC-5)', () => {
    expect(hoyBogota(new Date('2026-03-10T03:00:00Z'))).toBe('2026-03-09');
    expect(hoyBogota(new Date('2026-03-10T05:00:00Z'))).toBe('2026-03-10');
  });
});
