// E16 (5.7, 7.9, RB-18, B-34): "Objetivos y plan" y la meta guardada en la calculadora.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calculadora } from '@/components/nova/semestre/Calculadora';
import { ObjetivosMateria } from '@/components/nova/semestre/ObjetivosMateria';
import type { Materia } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown) => new Response(JSON.stringify({ ok: true, datos }), { status: 200 });
const nota = (id: string, valor: number | null) => ({ id, orden: 1, nombre: null, nota: valor, fecha: null });

const CON_CORTES: Materia = {
  id: 'm1',
  nombre: 'Física',
  creditos: 3,
  docente: null,
  usaCortes: true,
  fallasLimite: null,
  fallasRegistradas: 0,
  cortes: [
    {
      id: 'c1',
      orden: 1,
      nombre: 'Corte 1',
      porcentaje: 3000,
      fecha: '2026-09-15',
      componentes: [
        { id: 'k1', orden: 1, nombre: 'Parcial', porcentaje: 5000, notas: [nota('n1', 300)] },
        { id: 'k2', orden: 2, nombre: 'Taller', porcentaje: 5000, notas: [nota('n2', null)] },
      ],
    },
    { id: 'c2', orden: 2, nombre: 'Corte 2', porcentaje: 7000, fecha: null, componentes: [{ id: 'k3', orden: 1, nombre: 'Final', porcentaje: 10000, notas: [] }] },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  m.refresh.mockReset();
});

describe('ObjetivosMateria', () => {
  it('la meta de la materia y la de cada corte con su porcentaje, su fecha y si es alcanzable (B-34)', () => {
    render(<ObjetivosMateria materia={CON_CORTES} metas={[{ materiaId: 'm1', corteId: 'c1', meta: 410 }]} redondeo="truncar" />);
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(within(filas[0] as HTMLElement).getByText('Sin meta.')).toBeTruthy();
    const corte1 = within(filas[1] as HTMLElement);
    expect(corte1.getByText(`30 % · hasta el ${formatearFecha("2026-09-15")}`)).toBeTruthy();
    expect(corte1.getByText('No alcanzable: lo máximo posible es 4,0.')).toBeTruthy();
    expect(within(filas[2] as HTMLElement).getByText('70 % · sin fecha')).toBeTruthy();
  });

  it('definir una meta: vista previa al escribir, RB-18 sin enviar y PUT con el corte', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({}));
    render(<ObjetivosMateria materia={CON_CORTES} metas={[]} redondeo="truncar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Definir la meta de Corte 1' }));
    const campo = screen.getByLabelText('Meta');
    fireEvent.change(campo, { target: { value: '5,5' } });
    expect(screen.getByText('La meta debe estar entre 0,1 y 5,0.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meta' }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '4' } });
    expect(screen.getByRole('status').textContent).toBe('Alcanzable: necesitas 5,0 en lo que falta.');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meta' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/nova/metas-nota');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ materiaId: 'm1', corteId: 'c1', meta: '4' });
  });

  it('sin cortes: solo la meta de la materia, con su fecha final y la indicación para dividir', () => {
    const sinCortes: Materia = { ...CON_CORTES, usaCortes: false, cortes: [{ ...(CON_CORTES.cortes[0] as Materia['cortes'][number]), nombre: 'Corte único', porcentaje: 10000, fecha: null }] };
    render(<ObjetivosMateria materia={sinCortes} metas={[{ materiaId: 'm1', corteId: null, meta: 300 }]} redondeo="truncar" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Fecha final: sin fecha')).toBeTruthy();
    expect(screen.getByText('Alcanzable: necesitas 3,0 en lo que falta.')).toBeTruthy();
    expect(screen.getByText('Para tener metas por corte, divide la materia en cortes desde su página.')).toBeTruthy();
  });
});

describe('Calculadora con meta guardada', () => {
  it('la meta guardada es el valor inicial de "Nota meta"; sin meta, la nota para aprobar', () => {
    render(<Calculadora materia={CON_CORTES} notaAprobar={300} redondeo="truncar" metaGuardada={450} />);
    expect((screen.getByLabelText('Nota meta') as HTMLInputElement).value).toBe('4,5');
    expect(screen.getByText('Por defecto, tu meta de Objetivos y plan. Lo que escribas aquí no se guarda.')).toBeTruthy();
    cleanup();
    render(<Calculadora materia={CON_CORTES} notaAprobar={300} redondeo="truncar" />);
    expect((screen.getByLabelText('Nota meta') as HTMLInputElement).value).toBe('3,0');
  });
});
