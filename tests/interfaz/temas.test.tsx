// E17 (5.7, 6.8, 9.1; RB-21, B-35): los temas de un corte en "Objetivos y plan".
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemasCorte } from '@/components/nova/semestre/TemasCorte';
import type { Tema } from '@/lib/dataService';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const falla = (mensaje: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { mensaje } }), { status });

const TEMAS: Tema[] = [
  { id: 't1', corteId: 'c1', nombre: 'Límites', origen: 'manual', estado: 'confirmado', fuente: null },
  { id: 't2', corteId: 'c1', nombre: 'Derivadas', origen: 'asistente', estado: 'propuesto', fuente: 'syllabus.pdf · p. 2' },
];
const DOCS = [{ id: 'd1', nombre: 'syllabus.pdf' }];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  m.refresh.mockReset();
});

describe('TemasCorte', () => {
  it('los confirmados y los propuestos con su fuente; solo los confirmados cuentan (B-35)', () => {
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={TEMAS} documentos={DOCS} />);
    expect(screen.getByText('1 tema confirmado')).toBeTruthy();
    expect(screen.getByText('Propuesto')).toBeTruthy();
    expect(screen.getByText('Fuente: syllabus.pdf · p. 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar Derivadas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar Límites' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar Derivadas' })).toBeTruthy();
  });

  it('confirmar un propuesto manda PATCH con confirmar', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({}));
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={TEMAS} documentos={DOCS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Derivadas' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/nova/temas/t2');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ confirmar: true });
  });

  it('agregar a mano: vacío se rechaza sin enviar; repetido muestra el mensaje del servidor', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(falla('Ese tema ya está en este corte.', 409));
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={[]} documentos={DOCS} />);
    expect(screen.getByText('Aún no hay temas.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribe un tema de 1 a 200 caracteres.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nuevo tema'), { target: { value: 'Límites' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Ese tema ya está en este corte.')).toBeTruthy();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/nova/cortes/c1/temas');
  });

  it('RB-21: sin PDF de la materia, el mensaje con el enlace a Fuentes', () => {
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={[]} documentos={[]} />);
    expect(screen.getByText(/Sube un PDF de esta materia \(por ejemplo, el syllabus\) para proponer temas\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a Fuentes' }).getAttribute('href')).toBe('/nova/fuentes');
    expect(screen.queryByRole('button', { name: /Proponer temas/ })).toBeNull();
  });

  it('proponer: manda el PDF elegido y dice cuántos se propusieron; un error del servidor se muestra tal cual', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok([{ id: 'n1' }, { id: 'n2' }], 201))
      .mockResolvedValueOnce(falla('Pon una fecha futura al corte para proponer temas.'));
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={[]} documentos={DOCS} />);
    fireEvent.click(screen.getByRole('button', { name: /Proponer temas/ }));
    expect(await screen.findByText('Se propusieron 2 temas. Confírmalos o descártalos: solo cuentan los confirmados.')).toBeTruthy();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/nova/cortes/c1/temas/proponer');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ documentoId: 'd1' });
    // E20b (commit 7): el botón dice "Temas propuestos" unos 2,5 s antes de volver.
    fireEvent.click(await screen.findByRole('button', { name: /Proponer temas/ }, { timeout: 4000 }));
    expect(await screen.findByText('Pon una fecha futura al corte para proponer temas.')).toBeTruthy();
  });
});
