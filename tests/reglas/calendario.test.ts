// @vitest-environment node
// E07 (PLAN_AMPLIACION 5.3): reglas puras del Calendario.
import { describe, expect, it } from 'vitest';
import { estaVencida, esMesValido, mesDe, nombreMes, semanasDelMes, sumarMeses } from '@/lib/reglas/calendario';

describe('calendario', () => {
  it('cuadrícula de lunes a domingo en semanas completas, con días de los meses vecinos', () => {
    const nov = semanasDelMes('2026-11'); // 1 de nov. de 2026 es domingo
    expect(nov[0]?.[0]).toBe('2026-10-26');
    expect(nov[0]?.[6]).toBe('2026-11-01');
    expect(nov.at(-1)?.[6]).toBe('2026-12-06');
    expect(nov).toHaveLength(6);
    expect(nov.every((s) => s.length === 7)).toBe(true);
    const feb = semanasDelMes('2027-02'); // 1 de feb. de 2027 es lunes y tiene 28 días: 4 semanas justas
    expect(feb).toHaveLength(4);
    expect(feb[0]?.[0]).toBe('2027-02-01');
    expect(feb.at(-1)?.[6]).toBe('2027-02-28');
    expect(semanasDelMes('2028-02').flat()).toContain('2028-02-29'); // bisiesto
  });

  it('mes anterior y siguiente cruzan el año', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(sumarMeses('2027-01', -1)).toBe('2026-12');
    expect(sumarMeses('2026-11', 0)).toBe('2026-11');
  });

  it('nombre del mes, mes de una fecha y meses válidos', () => {
    expect(nombreMes('2026-11')).toBe('noviembre de 2026');
    expect(mesDe('2026-11-07')).toBe('2026-11');
    expect(esMesValido('2026-11')).toBe(true);
    for (const malo of ['2026-13', '2026-00', '2026-1', 'nov', '2026-11-01']) expect(esMesValido(malo)).toBe(false);
  });

  it('vencida: pendiente con fecha límite antes de hoy; una completada o de hoy no', () => {
    expect(estaVencida({ estado: 'Pendiente', fechaLimite: '2026-11-06' }, '2026-11-07')).toBe(true);
    expect(estaVencida({ estado: 'Pendiente', fechaLimite: '2026-11-07' }, '2026-11-07')).toBe(false);
    expect(estaVencida({ estado: 'Completada', fechaLimite: '2026-11-01' }, '2026-11-07')).toBe(false);
  });
});
