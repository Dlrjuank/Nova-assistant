// E10d (RB-42): elegir capítulos y fechas, ver el plan y confirmarlo.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanLectura } from '@/components/nova/PlanLectura';

const refrescar = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refrescar }) }));

const DOC = '22222222-2222-4222-8222-222222222222';
const CAPS = [
  { orden: 0, nivel: 1, titulo: 'Capítulo 1. Energía', paginaInicio: 1, paginaFin: 10, etiquetaPaginas: '1–10', enTareas: false },
  { orden: 1, nivel: 2, titulo: '1.1 Calor', paginaInicio: 3, paginaFin: 5, etiquetaPaginas: '3–5', enTareas: false },
  { orden: 2, nivel: 1, titulo: 'Capítulo 2. Ecosistemas', paginaInicio: 11, paginaFin: 20, etiquetaPaginas: '11–20', enTareas: true },
  { orden: 3, nivel: 1, titulo: 'Capítulo 3. Células', paginaInicio: 21, paginaFin: 30, etiquetaPaginas: '21–30', enTareas: false },
];
const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const VISTA = {
  categoria: 'Biología',
  tareas: [
    { orden: 0, titulo: 'Leer cap. 1: Energía (pp. 1–10)', fechaLimite: '2026-11-22' },
    { orden: 3, titulo: 'Leer cap. 3: Células (pp. 21–30)', fechaLimite: '2026-11-29' },
  ],
  yaEnTareas: [],
};
const pintar = () => render(<PlanLectura documentoId={DOC} capitulos={CAPS} categoriaInicial="Biología" categorias={[{ nombre: 'Biología', color: 'verde' }]} />);
const fecha = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refrescar.mockClear();
});

describe('PlanLectura', () => {
  it('solo los capítulos de nivel 1 se eligen; el que ya está en Tareas lo dice y no se puede elegir', () => {
    pintar();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    const ya = screen.getByLabelText(/Capítulo 2\. Ecosistemas/) as HTMLInputElement;
    expect(ya.disabled).toBe(true);
    expect(screen.getByText('Este capítulo ya está en Tareas.')).toBeTruthy();
    expect(screen.getByText('1.1 Calor')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Elige al menos un capítulo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Elegir todos" toma solo los disponibles', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir todos' }));
    const marcados = (screen.getAllByRole('checkbox') as HTMLInputElement[]).filter((c) => c.checked);
    expect(marcados).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Quitar todos' })).toBeTruthy();
  });

  it('la fecha final antes de la de inicio muestra el mensaje y no deja pedir el plan', () => {
    pintar();
    fireEvent.click(screen.getByLabelText(/Capítulo 1\. Energía/));
    fecha('Fecha de inicio', '20261120');
    fecha('Fecha final', '20261110');
    expect(screen.getByText('La fecha final debe ser igual o posterior a la de inicio.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Ver plan' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('vista previa con título y fecha, y al confirmar crea las tareas y refresca los capítulos', async () => {
    const f = vi.fn().mockResolvedValueOnce(ok(VISTA)).mockResolvedValueOnce(ok({ creadas: 2, omitidas: 0, categoria: 'Biología' }, 201));
    vi.stubGlobal('fetch', f);
    pintar();
    fireEvent.click(screen.getByLabelText(/Capítulo 3\. Células/));
    fireEvent.click(screen.getByLabelText(/Capítulo 1\. Energía/));
    fecha('Fecha de inicio', '20261116');
    fecha('Fecha final', '20261129');
    fireEvent.click(screen.getByRole('button', { name: 'Ver plan' }));

    const lista = await screen.findByRole('list', { name: 'Tareas que se crearán' });
    expect(within(lista).getByText('Leer cap. 1: Energía (pp. 1–10)')).toBeTruthy();
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(f.mock.calls[0]?.[0]).toBe(`/api/nova/documentos/${DOC}/plan-lectura`);
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ capitulos: [0, 3], categoria: 'Biología', modo: 'fechas', inicio: '2026-11-16', fin: '2026-11-29' });

    fireEvent.click(screen.getByRole('button', { name: 'Crear 2 tareas' }));
    expect(await screen.findByText(/Se crearon 2 tareas de lectura en «Biología»/)).toBeTruthy();
    expect(f.mock.calls[1]?.[0]).toBe(`/api/nova/documentos/${DOC}/plan-lectura/confirmar`);
    expect(screen.getByRole('link', { name: 'Ver en Tareas' }).getAttribute('href')).toBe('/nova/tareas?categoria=Biolog%C3%ADa');
    expect(refrescar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('list', { name: 'Tareas que se crearán' })).toBeNull();
  });

  it('por semana envía cuántos capítulos y valida de 1 a 20', async () => {
    const f = vi.fn().mockResolvedValue(ok(VISTA));
    vi.stubGlobal('fetch', f);
    pintar();
    fireEvent.click(screen.getByLabelText(/Capítulo 1\. Energía/));
    fireEvent.click(screen.getByLabelText('Capítulos por semana'));
    fireEvent.change(screen.getByLabelText('Cuántos por semana'), { target: { value: '25' } });
    expect(screen.getByText('Escribe un número de 1 a 20.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Cuántos por semana'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver plan' }));
    await screen.findByRole('list', { name: 'Tareas que se crearán' });
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toMatchObject({ modo: 'semana', porSemana: 2, capitulos: [0] });
  });

  it('cambiar algo después de la vista previa la quita: se confirma solo lo que se ve', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(VISTA)));
    pintar();
    fireEvent.click(screen.getByLabelText(/Capítulo 1\. Energía/));
    fireEvent.click(screen.getByRole('button', { name: 'Ver plan' }));
    await screen.findByRole('list', { name: 'Tareas que se crearán' });
    fecha('Fecha final', '20261231');
    expect(screen.queryByRole('list', { name: 'Tareas que se crearán' })).toBeNull();
  });

  it('un error del servidor se muestra con su mensaje', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { mensaje: 'Este capítulo ya está en Tareas.' } }), { status: 409 })));
    pintar();
    fireEvent.click(screen.getByLabelText(/Capítulo 1\. Energía/));
    fireEvent.click(screen.getByRole('button', { name: 'Ver plan' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Este capítulo ya está en Tareas.');
  });
});
