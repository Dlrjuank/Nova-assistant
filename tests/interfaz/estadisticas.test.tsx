// E20 (5.7, B-40): la pestaña Estadísticas: resumen, riesgo, comparación y evolución, con su tabla equivalente.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComparacionMaterias, EvolucionPorCorte, MateriasEnRiesgo, ResumenEstadisticas } from '@/components/nova/semestre/GraficosEstadisticas';
import { calcularEstadisticas } from '@/lib/reglas/estadisticas';

const comp = (notas: Array<number | null>) => [{ nombre: 'Parcial', porcentaje: 10000, notas }];
const DATOS = calcularEstadisticas(
  [
    {
      id: 'calculo',
      nombre: 'Cálculo',
      creditos: 4,
      fallasLimite: null,
      fallasRegistradas: 0,
      entrada: { usaCortes: true, cortes: [{ nombre: 'Corte 1', porcentaje: 5000, componentes: comp([420]) }, { nombre: 'Corte 2', porcentaje: 5000, componentes: comp([null]) }] },
    },
    { id: 'fisica', nombre: 'Física', creditos: 3, fallasLimite: 4, fallasRegistradas: 3, entrada: { usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes: comp([200, null]) }] } },
    { id: 'arte', nombre: 'Arte', creditos: 1, fallasLimite: null, fallasRegistradas: 0, entrada: { usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes: [] }] } },
  ],
  300,
  'truncar',
);

afterEach(cleanup);

describe('Estadísticas', () => {
  it('el resumen: promedio, materias con notas y en riesgo', () => {
    render(<ResumenEstadisticas datos={DATOS} />);
    expect(screen.getByText('2 de 3')).toBeTruthy();
    expect(screen.getByText('1 materia en riesgo')).toBeTruthy();
  });

  it('materias en riesgo con su estado, el motivo por nota y por fallas, y el enlace a la materia', () => {
    render(<MateriasEnRiesgo datos={DATOS} />);
    const enlace = screen.getByRole('link', { name: /Física/ });
    expect(enlace.getAttribute('href')).toBe('/nova/semestre/fisica');
    expect(within(enlace).getByText('En riesgo')).toBeTruthy();
    expect(within(enlace).getByText('Por nota: hoy tienes 2,0 y aún puedes llegar a 3,0.')).toBeTruthy();
    expect(within(enlace).getByText('Por fallas: te queda 1 falla antes de perder la materia.')).toBeTruthy();
  });

  it('sin materias en riesgo, el texto amable', () => {
    render(<MateriasEnRiesgo datos={{ ...DATOS, enRiesgo: [] }} />);
    expect(screen.getByText('Ninguna materia está en riesgo por nota ni por fallas.')).toBeTruthy();
  });

  it('comparación: cada barra dice su valor (también sin notas) y la tabla equivalente lo repite con el estado', () => {
    render(<ComparacionMaterias datos={DATOS} />);
    expect(screen.getByRole('figure', { name: 'Comparación entre materias' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Cálculo: 4,2' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Arte: sin notas' })).toBeTruthy();
    expect(screen.getByText(/La línea marca la nota para aprobar \(3,0\)/)).toBeTruthy();
    const tabla = screen.getByRole('table', { name: 'Comparación entre materias' });
    expect(within(tabla).getAllByRole('row').map((f) => f.textContent)).toEqual(['MateriaNota actualEstado', 'Cálculo4,2Aprueba', 'Física2,0En riesgo', 'ArteSin notas—']);
  });

  it('evolución: un gráfico por materia con cortes, con su descripción; un corte sin notas queda vacío; las demás con su nota actual', () => {
    render(<EvolucionPorCorte datos={DATOS} />);
    const grafico = screen.getByRole('img', { name: 'Cálculo Actual 4,2' });
    expect(grafico.querySelector('desc')?.textContent).toBe('Nota por corte: Corte 1: 4,2, Corte 2: Sin notas. Nota para aprobar 3,0.');
    expect(within(grafico as unknown as HTMLElement).getByText('Sin notas')).toBeTruthy();
    expect(grafico.querySelectorAll('path')).toHaveLength(0); // un solo corte con nota: sin línea
    expect(screen.getByText(/\(sin cortes\): nota actual 2,0/)).toBeTruthy();
    const tabla = screen.getByRole('table', { name: 'Evolución por corte' });
    expect(within(tabla).getAllByRole('row')).toHaveLength(3);
  });
});
