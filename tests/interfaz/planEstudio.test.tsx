// E18 (5.7, 9.2 a 9.4; RB-22, RB-23): el plan de estudio de un corte en "Objetivos y plan".
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanEstudio } from '@/components/nova/semestre/PlanEstudio';
import type { PlanCorte, Tema } from '@/lib/dataService';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const falla = (mensaje: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { mensaje } }), { status });

const C1 = '33333333-3333-4333-8333-333333333331';
const T1 = '66666666-6666-4666-8666-666666666661';
const T2 = '66666666-6666-4666-8666-666666666662';
const TEMAS: Tema[] = [
  { id: T1, corteId: C1, nombre: 'Límites', origen: 'manual', estado: 'confirmado', fuente: null },
  { id: T2, corteId: C1, nombre: 'Derivadas', origen: 'asistente', estado: 'confirmado', fuente: 'syllabus.pdf · p. 2' },
];
const version = (numero: number, titulo = 'Repasar límites') => ({
  numero,
  origen: 'asistente' as const,
  creadaEn: '2026-11-17T19:40',
  contenido: {
    semanas: [
      { inicio: '2026-11-16', dias: [{ fecha: '2026-11-18', pasos: [{ id: 'p1', titulo, tema_id: T1, minutos: 45, fuentes: ['syllabus.pdf · p. 2'] }] }] },
      { inicio: '2026-11-23', dias: [{ fecha: '2026-11-25', pasos: [{ id: 'p2', titulo: 'Ejercicios de derivadas', tema_id: T2, minutos: 90, fuentes: [] }] }] },
    ],
  },
});
const PLAN: PlanCorte = {
  planId: 'plan',
  corteId: C1,
  vigente: 2,
  version: version(2),
  versiones: [
    { numero: 2, origen: 'manual', creadaEn: '2026-11-17T20:00', pasos: 2 },
    { numero: 1, origen: 'asistente', creadaEn: '2026-11-17T19:40', pasos: 2 },
  ],
  cambios: [],
  enTareas: {},
};
const props = { corteId: C1, titulo: 'Corte 1', temas: TEMAS, hoy: '2026-11-17', fechaCorte: '2026-11-30' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  m.refresh.mockReset();
});

describe('PlanEstudio', () => {
  it('sin plan: lo explica y "Generar plan" lo pide; un error llega con su mensaje (RB-20)', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(falla('Primero confirma al menos un tema del corte.')).mockResolvedValueOnce(ok(PLAN, 201));
    render(<PlanEstudio {...props} plan={null} />);
    expect(screen.getByText(/Aún no hay plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Generar plan' }));
    await screen.findByText('Primero confirma al menos un tema del corte.');
    expect(fetch.mock.calls[0]?.[0]).toBe(`/api/nova/cortes/${C1}/plan/generar`);
    fireEvent.click(screen.getByRole('button', { name: 'Generar plan' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
  });

  it('el plan por semanas y días, con el tema, los minutos y las citas de cada paso', () => {
    render(<PlanEstudio {...props} plan={PLAN} />);
    expect(screen.getByText('2 pasos · 2 h 15 min')).toBeTruthy();
    expect(screen.getByText('Versión 2')).toBeTruthy();
    expect(screen.getByText('Semana del 16 de noviembre')).toBeTruthy();
    expect(screen.getByText('Semana del 23 de noviembre')).toBeTruthy();
    expect(screen.getByText('miércoles, 18 de noviembre')).toBeTruthy();
    expect(screen.getByText('Repasar límites')).toBeTruthy();
    expect(screen.getByText('Tema: Límites')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('Fuente: syllabus.pdf · p. 2')).toBeTruthy();
    expect(screen.getByText('1 h 30 min')).toBeTruthy();
    expect(screen.queryByText(/Hay cambios/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Generar de nuevo' })).toBeTruthy();
  });

  it('RB-23: con cambios, el aviso con la lista y "Actualizar plan"; el plan no cambia solo', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(PLAN, 201));
    render(<PlanEstudio {...props} plan={{ ...PLAN, cambios: ['un PDF nuevo', 'notas nuevas'] }} />);
    expect(screen.getByText('Hay cambios desde la última versión del plan: un PDF nuevo y notas nuevas. ¿Quieres actualizarlo?')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar plan' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/nova/cortes/${C1}/plan/generar`, expect.objectContaining({ method: 'POST' })));
  });

  it('versiones: ver una anterior y restaurarla como nueva', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ ...PLAN, version: version(1, 'Plan viejo') }))
      .mockResolvedValueOnce(ok(PLAN, 201));
    render(<PlanEstudio {...props} plan={PLAN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Versiones (2)' }));
    const lista = screen.getByRole('list', { name: 'Versiones del plan de Corte 1' });
    expect(within(lista).getByText('Vigente')).toBeTruthy();
    expect(within(lista).getByText(/editada a mano/)).toBeTruthy();
    fireEvent.click(within(lista).getByRole('button', { name: 'Ver la versión 1' }));
    await screen.findByText('Plan viejo');
    expect(fetch.mock.calls[0]?.[0]).toBe(`/api/nova/cortes/${C1}/plan?version=1`);
    expect(screen.getByText('Estás viendo la versión 1. La vigente es la 2.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar esta versión' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(JSON.parse(String((fetch.mock.calls[1]?.[1] as RequestInit).body))).toEqual({ numero: 1 });
  });

  it('editar: cambiar un paso, quitar otro, agregar uno; la validación avisa antes de enviar', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(PLAN, 201));
    render(<PlanEstudio {...props} plan={PLAN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getAllByLabelText('Qué hacer')).toHaveLength(2);
    fireEvent.change(screen.getAllByLabelText('Minutos')[0] as HTMLElement, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Los minutos van de 15 a 240.');
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText('Minutos')[0] as HTMLElement, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el paso 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar paso' }));
    fireEvent.change(screen.getAllByLabelText('Qué hacer')[1] as HTMLElement, { target: { value: 'Simulacro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(fetch.mock.calls[0]?.[0]).toBe(`/api/nova/cortes/${C1}/plan/versiones`);
    expect(JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      pasos: [
        { id: 'p1', titulo: 'Repasar límites', fecha: '2026-11-18', minutos: '60', temaId: T1 },
        { titulo: 'Simulacro', fecha: '2026-11-17', minutos: '30', temaId: T1 },
      ],
    });
  });
});
