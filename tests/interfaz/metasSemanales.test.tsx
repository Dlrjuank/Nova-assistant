// E15 (5.6, 7.8): la sección "Metas semanales" de Productividad.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetasSemanales } from '@/components/nova/MetasSemanales';
import type { MetasDeLaSemana } from '@/lib/dataService';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const falla = (mensaje: string, status = 409) => new Response(JSON.stringify({ ok: false, error: { mensaje } }), { status });

const SEMANA: MetasDeLaSemana = {
  lunes: '2026-11-16',
  domingo: '2026-11-22',
  metas: [
    { id: 'a', tipo: 'tareas', categoria: null, objetivo: 10, progreso: 7, porcentaje: 70, cumplida: false },
    { id: 'b', tipo: 'minutos', categoria: 'Universidad', objetivo: 180, progreso: 200, porcentaje: 100, cumplida: true },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  m.refresh.mockReset();
});

describe('MetasSemanales', () => {
  it('cada meta con su progreso, su barra y "Cumplida"; explica que usa la fecha en que se completó', () => {
    render(<MetasSemanales semana={SEMANA} categorias={['General', 'Universidad']} />);
    expect(screen.getByText('Semana del 16 – 22 de nov.')).toBeTruthy();
    expect(screen.getByText(/según el día en que las completaste/)).toBeTruthy();
    expect(screen.getByText('Tareas completadas · Todas las categorías')).toBeTruthy();
    expect(screen.getByText('7 de 10 tareas · 70 %')).toBeTruthy();
    expect(screen.getByText('3 h 20 min de 3 h · 100 %')).toBeTruthy();
    const barras = screen.getAllByRole('progressbar');
    expect(barras.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['70', '100']);
    expect(barras[1]?.getAttribute('aria-valuetext')).toBe('3 h 20 min de 3 h, cumplida');
    expect(screen.getAllByText('Cumplida')).toHaveLength(1);
  });

  it('sin metas, el texto amable', () => {
    render(<MetasSemanales semana={{ ...SEMANA, metas: [] }} categorias={[]} />);
    expect(screen.getByText('Aún no tienes metas semanales.')).toBeTruthy();
  });

  it('nueva meta de tiempo en una categoría: horas y minutos, envía y refresca', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'c' }, 201));
    render(<MetasSemanales semana={SEMANA} categorias={['General', 'Universidad']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva meta' }));
    fireEvent.change(screen.getByLabelText('Qué quieres medir'), { target: { value: 'minutos' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Universidad' } });
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meta' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ tipo: 'minutos', categoria: 'Universidad', horas: '3', minutos: '' });
  });

  it('RB-16 en la pantalla sin enviar; RB-17 muestra el mensaje del servidor', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(falla('Ya tienes una meta igual.'));
    render(<MetasSemanales semana={SEMANA} categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva meta' }));
    fireEvent.change(screen.getByLabelText('Tareas por semana'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meta' }));
    expect(await screen.findByText('El objetivo debe ser un número entero mayor que 0.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Tareas por semana'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meta' }));
    expect(await screen.findByText('Ya tienes una meta igual.')).toBeTruthy();
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ tipo: 'tareas', categoria: null, objetivo: '10' });
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación antes de borrar', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'a' }));
    render(<MetasSemanales semana={SEMANA} categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la meta Tareas completadas · Todas las categorías' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('¿Eliminar esta meta?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/nova/metas/a');
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });
});
