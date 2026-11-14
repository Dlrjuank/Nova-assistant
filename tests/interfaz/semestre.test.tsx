// E12 (5.7, 6.4): formularios de Semestre con los mensajes exactos y los avisos de suma.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetalleMateria } from '@/components/nova/semestre/DetalleMateria';
import { FormularioMateria } from '@/components/nova/semestre/FormularioMateria';
import type { Materia } from '@/lib/dataService';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const falla = (mensaje: string, status = 409) => new Response(JSON.stringify({ ok: false, error: { mensaje } }), { status });

const SIN_CORTES: Materia = {
  id: 'm1',
  nombre: 'Cálculo',
  creditos: 3,
  docente: null,
  usaCortes: false,
  cortes: [
    {
      id: 'c1',
      orden: 1,
      nombre: 'Corte único',
      porcentaje: 10000,
      fecha: null,
      componentes: [
        { id: 'k1', orden: 1, nombre: 'Parcial', porcentaje: 5000, notas: [{ id: 'n1', orden: 1, nombre: null, nota: 350, fecha: null }] },
        { id: 'k2', orden: 2, nombre: 'Talleres', porcentaje: 4000, notas: [{ id: 'n2', orden: 1, nombre: 'Taller 1', nota: null, fecha: '2026-11-10' }] },
      ],
    },
  ],
};

const CON_CORTES: Materia = {
  ...SIN_CORTES,
  usaCortes: true,
  cortes: [
    { id: 'c1', orden: 1, nombre: 'Corte 1', porcentaje: 3000, fecha: null, componentes: [{ id: 'k1', orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: [] }] },
    { id: 'c2', orden: 2, nombre: 'Corte 2', porcentaje: 6000, fecha: null, componentes: [] },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('FormularioMateria (RB-05, RB-06)', () => {
  it('valida créditos con el mensaje exacto y muestra el error del servidor', async () => {
    const f = vi.fn().mockResolvedValue(falla('Ya existe una materia con ese nombre.'));
    vi.stubGlobal('fetch', f);
    const alTerminar = vi.fn();
    render(<FormularioMateria alTerminar={alTerminar} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cálculo' } });
    fireEvent.change(screen.getByLabelText('Créditos'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    expect(screen.getByText('Los créditos deben ser un número entero entre 1 y 10.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Créditos'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    expect(await screen.findByText('Ya existe una materia con ese nombre.')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ nombre: 'Cálculo', creditos: '3', docente: null });
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

describe('DetalleMateria', () => {
  it('sin cortes: componentes con sus notas, "Sin nota" y el aviso RB-08 (B-25)', () => {
    render(<DetalleMateria materia={SIN_CORTES} plantilla={[3000, 3000, 4000]} />);
    expect(screen.getByText('Los porcentajes de los componentes suman 90 %; deben sumar 100 %.')).toBeTruthy();
    const notas = within(screen.getByRole('list', { name: 'Notas de Talleres' }));
    expect(notas.getByText('Taller 1')).toBeTruthy();
    expect(notas.getByText('Sin nota')).toBeTruthy();
    expect(screen.getByText('3,5')).toBeTruthy();
    expect(screen.getByText(/30 % \+ 30 % \+ 40 %/)).toBeTruthy();
    expect(screen.getByLabelText('Fecha final de la materia')).toBeTruthy();
  });

  it('una nota de 5,5 se rechaza con RB-09 sin llamar al servidor (B-27)', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<DetalleMateria materia={SIN_CORTES} plantilla={[3000, 3000, 4000]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nota a Parcial' }));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '5,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
    expect(screen.getByText('La nota debe estar entre 0,0 y 5,0.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('una nota "sin nota" se envía con nota null', async () => {
    const f = vi.fn().mockResolvedValue(ok({ id: 'n9' }, 201));
    vi.stubGlobal('fetch', f);
    render(<DetalleMateria materia={SIN_CORTES} plantilla={[3000, 3000, 4000]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nota a Parcial' }));
    fireEvent.click(screen.getByLabelText('Sin nota (aún no la tengo)'));
    expect(screen.queryByLabelText('Nota')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nombre (opcional)'), { target: { value: 'Quiz 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
    await vi.waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/componentes/k1/notas');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ nombre: 'Quiz 3', nota: null, fecha: null });
  });

  it('con cortes: el aviso RB-07, el de cada corte, y "Quitar cortes" muestra RB-35 (B-24, B-26)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(falla('Para quitar los cortes, deja solo uno.')));
    render(<DetalleMateria materia={CON_CORTES} plantilla={[3000, 3000, 4000]} />);
    expect(screen.getByText('Los porcentajes de los cortes suman 90 %; deben sumar 100 %.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Componentes de Corte 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar cortes' }));
    expect(await screen.findByText('Para quitar los cortes, deja solo uno.')).toBeTruthy();
  });

  it('quitar un corte con componentes avisa que se borran al guardar; el porcentaje se valida', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<DetalleMateria materia={CON_CORTES} plantilla={[3000, 3000, 4000]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Corte 1' }));
    expect(screen.getByText('Al guardar se borrarán Corte 1 con sus componentes y notas.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Porcentaje (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cortes' }));
    expect(screen.getByText('El porcentaje debe ser mayor que 0 y como máximo 100.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });
});
