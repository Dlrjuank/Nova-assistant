// E13 (5.7, 7.4, 7.5, RB-12, RB-18, B-28 a B-30): la calculadora de una materia.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Calculadora } from '@/components/nova/semestre/Calculadora';
import type { Materia } from '@/lib/dataService';

afterEach(cleanup);

const nota = (id: string, valor: number | null) => ({ id, orden: 1, nombre: null, nota: valor, fecha: null });
const componente = (id: string, nombre: string, porcentaje: number, notas: Array<number | null>) => ({ id, orden: 1, nombre, porcentaje, notas: notas.map((n, i) => nota(`${id}-${i}`, n)) });

/** El ejemplo de 7.4 (B-28). */
const EJEMPLO: Materia = {
  id: 'm1',
  nombre: 'Cálculo',
  creditos: 3,
  docente: null,
  usaCortes: false,
  fallasLimite: null,
  fallasRegistradas: 0,
  cortes: [
    {
      id: 'c1',
      orden: 1,
      nombre: 'Corte único',
      porcentaje: 10000,
      fecha: null,
      componentes: [
        componente('k1', 'Parcial', 4000, [350]),
        componente('k2', 'Talleres', 2000, [400, 440]),
        componente('k3', 'Quizzes', 2000, [300, 500, null, null, null]),
        componente('k4', 'Actividades', 2000, []),
      ],
    },
  ],
};

describe('Calculadora', () => {
  it('B-28: nota actual 3,7, asegurado 2,5, "Aprueba" y 1,4 para aprobar; la meta cambia el cálculo y no se guarda', () => {
    render(<Calculadora materia={EJEMPLO} notaAprobar={300} redondeo="truncar" />);
    expect(screen.getByText('3,7')).toBeTruthy();
    expect(screen.getByText('2,5')).toBeTruthy();
    expect(screen.getByText('Aprueba')).toBeTruthy();
    expect(screen.getByText('Falta por calificar: 32 %')).toBeTruthy();
    expect((screen.getByLabelText('Nota meta') as HTMLInputElement).value).toBe('3,0');
    expect(screen.getByRole('status').textContent).toBe('Necesitas al menos 1,4 en lo que falta para llegar a 3,0.');
    fireEvent.change(screen.getByLabelText('Nota meta'), { target: { value: '4' } });
    expect(screen.getByRole('status').textContent).toBe('Necesitas al menos 4,5 en lo que falta para llegar a 4,0.');
    fireEvent.change(screen.getByLabelText('Nota meta'), { target: { value: '4,5' } });
    expect(screen.getByRole('status').textContent).toBe('Con lo que falta no es posible llegar a 4,5. Lo máximo que puedes alcanzar es 4,1.'); // B-30
  });

  it('RB-18: una meta fuera de rango muestra su mensaje y ningún resultado', () => {
    render(<Calculadora materia={EJEMPLO} notaAprobar={300} redondeo="truncar" />);
    fireEvent.change(screen.getByLabelText('Nota meta'), { target: { value: '5,5' } });
    expect(screen.getByText('La meta debe estar entre 0,1 y 5,0.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('B-29: con 2,96 exacto, truncar muestra 2,9 sin aprobar y redondear 3,0 aprobando', () => {
    const materia: Materia = { ...EJEMPLO, cortes: [{ ...EJEMPLO.cortes[0]!, componentes: [componente('k', 'Final', 10000, [296])] }] };
    const { unmount } = render(<Calculadora materia={materia} notaAprobar={300} redondeo="truncar" />);
    expect(screen.getByText('2,9')).toBeTruthy();
    expect(screen.getByText('Reprobada')).toBeTruthy();
    expect(screen.getByText('Nota definitiva')).toBeTruthy();
    unmount();
    render(<Calculadora materia={materia} notaAprobar={300} redondeo="redondear" />);
    expect(screen.getByText('3,0')).toBeTruthy();
    expect(screen.getByText('Aprobada')).toBeTruthy();
  });

  it('sin notas: RB-13; con porcentajes que no suman 100 %, la nota actual sin estado ni "¿Cuánto necesito?" (B-25)', () => {
    const vacia: Materia = { ...EJEMPLO, cortes: [{ ...EJEMPLO.cortes[0]!, componentes: [componente('k', 'Final', 10000, [])] }] };
    const { unmount } = render(<Calculadora materia={vacia} notaAprobar={300} redondeo="truncar" />);
    expect(screen.getByText('Aún no hay notas registradas.')).toBeTruthy();
    unmount();
    const noSuma: Materia = { ...EJEMPLO, cortes: [{ ...EJEMPLO.cortes[0]!, componentes: [componente('k', 'Parcial', 9000, [400])] }] };
    render(<Calculadora materia={noSuma} notaAprobar={300} redondeo="truncar" />);
    expect(screen.getByText('4,0')).toBeTruthy();
    expect(screen.queryByText('Aprueba')).toBeNull();
    expect(screen.queryByLabelText('Nota meta')).toBeNull();
    expect(screen.getByText('Para ver el estado y «¿Cuánto necesito?», los porcentajes deben sumar 100 %.')).toBeTruthy();
  });

  it('con cortes, la nota de cada corte', () => {
    const conCortes: Materia = {
      ...EJEMPLO,
      usaCortes: true,
      cortes: [
        { id: 'c1', orden: 1, nombre: 'Corte 1', porcentaje: 5000, fecha: null, componentes: [componente('a', 'Parcial', 10000, [400])] },
        { id: 'c2', orden: 2, nombre: 'Corte 2', porcentaje: 5000, fecha: null, componentes: [componente('b', 'Parcial', 10000, [])] },
      ],
    };
    render(<Calculadora materia={conCortes} notaAprobar={300} redondeo="truncar" />);
    const lista = within(screen.getByRole('list', { name: 'Nota de cada corte' }));
    expect(lista.getByText('4,0')).toBeTruthy();
    expect(lista.getByText('Sin notas')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Necesitas al menos 2,0 en lo que falta para llegar a 3,0.');
  });
});
