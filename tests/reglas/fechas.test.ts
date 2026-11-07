// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  aplicarMascaraFecha,
  esFechaISOValida,
  esFechaPasada,
  fechaLarga,
  hoyBogota,
  lineaHoy,
  semanaDe,
  sumarDias,
} from '@/lib/reglas/fechas';

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

describe('RB-31: hoy, mañana y la semana en America/Bogota', () => {
  it('semanaDe: de lunes a domingo, también en los bordes y entre meses y años', () => {
    expect(semanaDe('2026-11-06')).toEqual({ lunes: '2026-11-02', domingo: '2026-11-08' }); // viernes
    expect(semanaDe('2026-11-02')).toEqual({ lunes: '2026-11-02', domingo: '2026-11-08' }); // lunes
    expect(semanaDe('2026-11-08')).toEqual({ lunes: '2026-11-02', domingo: '2026-11-08' }); // domingo
    expect(semanaDe('2026-12-31')).toEqual({ lunes: '2026-12-28', domingo: '2027-01-03' });
    expect(semanaDe('2026-03-01')).toEqual({ lunes: '2026-02-23', domingo: '2026-03-01' });
  });

  it('sumarDias cruza meses, años y febrero bisiesto', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('fechaLarga en español', () => {
    expect(fechaLarga('2026-11-06')).toBe('viernes, 6 de noviembre de 2026');
  });

  it('domingo 22:30 en Bogotá: UTC ya es lunes, pero hoy sigue siendo domingo y la semana no cambia', () => {
    const reloj = new Date('2026-11-09T03:30:00Z'); // 2026-11-08 22:30 en Bogotá (UTC-5)
    expect(reloj.toISOString().slice(0, 10)).toBe('2026-11-09'); // la fecha del servidor (UTC) sería otra
    expect(hoyBogota(reloj)).toBe('2026-11-08');
    const linea = lineaHoy(reloj);
    expect(linea).toBe(
      'HOY: domingo, 8 de noviembre de 2026 (2026-11-08), hora de Bogotá. Mañana: 2026-11-09. ' +
        'Esta semana: del lunes, 2 de noviembre de 2026 (2026-11-02) al domingo, 8 de noviembre de 2026 (2026-11-08).',
    );
  });

  it('viernes 23:59 en Bogotá (sábado 04:59 UTC) sigue siendo viernes; a las 00:00 de Bogotá cambia', () => {
    expect(lineaHoy(new Date('2026-11-07T04:59:00Z'))).toContain('(2026-11-06), hora de Bogotá. Mañana: 2026-11-07.');
    expect(lineaHoy(new Date('2026-11-07T05:00:00Z'))).toContain('(2026-11-07), hora de Bogotá. Mañana: 2026-11-08.');
  });
});
