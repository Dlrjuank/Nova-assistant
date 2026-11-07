// @vitest-environment node
// E06 (PLAN_AMPLIACION 5.1 y 7.1): reglas puras de Inicio.
import { describe, expect, it } from 'vitest';
import { hoyBogota } from '@/lib/reglas/fechas';
import {
  diasDeSemana,
  nombreDia,
  prioridadesDeHoy,
  progresoSemanal,
  rangoSemana,
  tareasPorDia,
  textoVencidas,
} from '@/lib/reglas/semana';

const t = (id: string, fechaLimite: string, estado = 'Pendiente', prioridad = 2, titulo = id) => ({ id, titulo, prioridad, estado, fechaLimite });

describe('semana de Inicio', () => {
  it('los 7 días van de lunes a domingo, también en el borde de mes y año', () => {
    expect(diasDeSemana('2026-11-06')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(diasDeSemana('2026-12-31')[0]).toBe('2026-12-28');
    expect(diasDeSemana('2026-12-31')[6]).toBe('2027-01-03');
  });

  it('domingo 22:30 en Bogotá (UTC ya es lunes): la semana sigue siendo la del domingo', () => {
    const hoy = hoyBogota(new Date('2026-11-09T03:30:00Z'));
    expect(hoy).toBe('2026-11-08');
    expect(diasDeSemana(hoy)[0]).toBe('2026-11-02');
  });

  it('rango: mismo mes, cambio de mes y cambio de año', () => {
    expect(rangoSemana('2026-11-06')).toBe('2 – 8 de nov.');
    expect(rangoSemana('2026-12-02')).toBe('30 de nov. – 6 de dic.');
    expect(rangoSemana('2026-12-31')).toBe('28 de dic. de 2026 – 3 de ene. de 2027');
  });

  it('nombre del día', () => {
    expect(nombreDia('2026-11-06')).toBe('viernes 6 de nov.');
    expect(nombreDia('2026-11-08')).toBe('domingo 8 de nov.');
  });

  it('progreso semanal: porcentaje truncado y sin dividir por cero', () => {
    expect(progresoSemanal([])).toEqual({ total: 0, completadas: 0, pendientes: 0, porcentaje: 0 });
    expect(progresoSemanal([t('a', 'x', 'Completada'), t('b', 'x', 'Completada'), t('c', 'x')])).toEqual({
      total: 3,
      completadas: 2,
      pendientes: 1,
      porcentaje: 66, // 66,6… truncado
    });
    expect(progresoSemanal([t('a', 'x', 'Completada')]).porcentaje).toBe(100);
    expect(progresoSemanal([t('a', 'x', 'En Progreso')]).pendientes).toBe(1);
  });

  it('prioridades de hoy: solo pendientes de hoy, Alta primero y luego por título', () => {
    const hoy = '2026-11-07';
    const lista = [
      t('1', hoy, 'Pendiente', 2, 'banco'),
      t('2', hoy, 'Pendiente', 3, 'zapatos'),
      t('3', hoy, 'Pendiente', 3, 'agua'),
      t('4', hoy, 'Completada', 3, 'hecha'),
      t('5', '2026-11-08', 'Pendiente', 3, 'mañana'),
      t('6', hoy, 'Pendiente', 1, 'Árbol'),
    ];
    expect(prioridadesDeHoy(lista, hoy).map((x) => x.titulo)).toEqual(['agua', 'zapatos', 'banco', 'Árbol']);
  });

  it('agrupa por día y deja vacíos los días sin tareas', () => {
    const dias = diasDeSemana('2026-11-06');
    const grupos = tareasPorDia([t('a', '2026-11-02'), t('b', '2026-11-02'), t('c', '2026-11-08'), t('fuera', '2026-11-09')], dias);
    expect(grupos['2026-11-02']?.map((x) => x.id)).toEqual(['a', 'b']);
    expect(grupos['2026-11-05']).toEqual([]);
    expect(Object.keys(grupos)).toHaveLength(7);
  });

  it('texto de vencidas en singular y plural', () => {
    expect(textoVencidas(1)).toBe('1 tarea vencida');
    expect(textoVencidas(3)).toBe('3 tareas vencidas');
  });
});
