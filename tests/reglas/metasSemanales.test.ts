// E15 (PLAN_AMPLIACION 7.8, RB-16): S-25 a S-28, metas semanales por fecha de cierre en la semana de Bogotá.
import { describe, expect, it } from 'vitest';
import {
  progresoMeta,
  semanaActual,
  textoProgreso,
  tituloMeta,
  validarObjetivoMinutos,
  validarObjetivoTareas,
  type TareaCerrada,
} from '@/lib/reglas/metasSemanales';

// Semana del lunes 16 al domingo 22 de noviembre de 2026.
const SEMANA = { lunes: '2026-11-16', domingo: '2026-11-22' };
const t = (fechaCierre: string | null, categoria = 'Universidad', minutos: number | null = 30, estado = 'Completada'): TareaCerrada => ({
  estado,
  fechaCierre,
  categoria,
  minutosInvertidos: minutos,
});

describe('S-25 a S-28: metas semanales (7.8)', () => {
  it('S-25: meta de tareas: cuenta las completadas con fecha de cierre en la semana, no las de otras semanas ni las pendientes', () => {
    const tareas = [t('2026-11-16'), t('2026-11-22'), t('2026-11-15'), t('2026-11-23'), t(null, 'Universidad', null, 'Pendiente'), t('2026-11-18', 'Hogar')];
    expect(progresoMeta({ tipo: 'tareas', categoria: null, objetivo: 5 }, tareas, SEMANA)).toEqual({ progreso: 3, porcentaje: 60, cumplida: false });
    expect(textoProgreso({ tipo: 'tareas', objetivo: 5 }, 3)).toBe('3 de 5 tareas');
    expect(textoProgreso({ tipo: 'tareas', objetivo: 1 }, 0)).toBe('0 de 1 tarea');
  });

  it('S-26: meta de tiempo en una categoría: suma los minutos de esa categoría sin distinguir mayúsculas (B-33)', () => {
    const tareas = [t('2026-11-17', 'universidad ', 90), t('2026-11-19', 'UNIVERSIDAD', 110), t('2026-11-20', 'Hogar', 500), t('2026-11-21', 'Universidad', null)];
    const r = progresoMeta({ tipo: 'minutos', categoria: 'Universidad', objetivo: 300 }, tareas, SEMANA);
    expect(r).toEqual({ progreso: 200, porcentaje: 66, cumplida: false }); // 66,6 % truncado
    expect(textoProgreso({ tipo: 'minutos', objetivo: 300 }, 200)).toBe('3 h 20 min de 5 h');
    expect(tituloMeta({ tipo: 'minutos', categoria: 'Universidad' })).toBe('Tiempo dedicado · Universidad');
    expect(tituloMeta({ tipo: 'tareas', categoria: null })).toBe('Tareas completadas · Todas las categorías');
  });

  it('S-27: al llegar al objetivo, "Cumplida" y el porcentaje no pasa de 100 %', () => {
    const tareas = Array.from({ length: 7 }, () => t('2026-11-18'));
    expect(progresoMeta({ tipo: 'tareas', categoria: null, objetivo: 7 }, tareas, SEMANA)).toEqual({ progreso: 7, porcentaje: 100, cumplida: true });
    expect(progresoMeta({ tipo: 'tareas', categoria: null, objetivo: 5 }, tareas, SEMANA)).toEqual({ progreso: 7, porcentaje: 100, cumplida: true });
  });

  it('S-28: la semana es la de Bogotá: el domingo a las 23:59 aún cuenta; el lunes a las 00:00 empieza otra', () => {
    // Domingo 22 de nov. a las 23:59 en Bogotá = lunes 23 a las 04:59 en UTC.
    expect(semanaActual(new Date('2026-11-23T04:59:00Z'))).toEqual(SEMANA);
    // Lunes 23 a las 00:00 en Bogotá = 05:00 UTC.
    expect(semanaActual(new Date('2026-11-23T05:00:00Z'))).toEqual({ lunes: '2026-11-23', domingo: '2026-11-29' });
    // La tarea completada el domingo cuenta en la semana que termina ese domingo, no en la siguiente.
    const domingo = [t('2026-11-22')];
    expect(progresoMeta({ tipo: 'tareas', categoria: null, objetivo: 1 }, domingo, semanaActual(new Date('2026-11-23T04:59:00Z'))).progreso).toBe(1);
    expect(progresoMeta({ tipo: 'tareas', categoria: null, objetivo: 1 }, domingo, semanaActual(new Date('2026-11-23T05:00:00Z'))).progreso).toBe(0);
  });

  it('RB-16: el objetivo es un entero mayor que 0; el de tiempo va en horas y minutos', () => {
    const mensaje = 'El objetivo debe ser un número entero mayor que 0.';
    expect(validarObjetivoTareas(' 5 ')).toBe(5);
    for (const malo of ['0', '-2', '2,5', 'cinco', '', '1001']) expect(() => validarObjetivoTareas(malo)).toThrow(mensaje);
    expect(validarObjetivoMinutos('3', '')).toBe(180);
    expect(validarObjetivoMinutos('', '45')).toBe(45);
    expect(validarObjetivoMinutos(1, 30)).toBe(90);
    for (const [h, m] of [['0', '0'], ['', ''], ['1', '60'], ['-1', '0'], ['1,5', '0'], ['169', '0']] as const) expect(() => validarObjetivoMinutos(h, m)).toThrow(mensaje);
    expect(validarObjetivoMinutos('168', '0')).toBe(10080);
  });
});
