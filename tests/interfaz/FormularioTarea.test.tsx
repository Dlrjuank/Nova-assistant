import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas/nueva' }));

import { FormularioTarea } from '@/components/nova/FormularioTarea';

const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const respuesta = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

describe('FormularioTarea', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.refresh.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('arranca con categoría General y prioridad 2', () => {
    render(<FormularioTarea />);
    expect((screen.getByLabelText('Categoría') as HTMLInputElement).value).toBe('General');
    expect((screen.getByLabelText('Prioridad') as HTMLSelectElement).value).toBe('2');
  });

  it('la prioridad solo ofrece 1, 2 y 3', () => {
    render(<FormularioTarea />);
    const valores = [...(screen.getByLabelText('Prioridad') as HTMLSelectElement).options].map((o) => o.value);
    expect(valores).toEqual(['1', '2', '3']);
  });

  it('valida en vivo la fecha con el mensaje exacto, una vez que el campo se toca', () => {
    render(<FormularioTarea />);
    escribir('Fecha límite', '2026-02-30');
    expect(screen.queryByText(/formato AAAA-MM-DD y ser una fecha real/)).toBeNull();
    fireEvent.blur(screen.getByLabelText('Fecha límite'));
    expect(screen.getByText('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.')).toBeTruthy();
    expect(screen.getByLabelText('Fecha límite').getAttribute('aria-invalid')).toBe('true');

    escribir('Fecha límite', '2026-03-10');
    expect(screen.queryByText(/formato AAAA-MM-DD y ser una fecha real/)).toBeNull();
  });

  it('rechaza 03-10-2026 y acepta fechas pasadas', () => {
    render(<FormularioTarea />);
    const campo = screen.getByLabelText('Fecha límite');
    escribir('Fecha límite', '03-10-2026');
    fireEvent.blur(campo);
    expect(screen.getByText(/formato AAAA-MM-DD/, { selector: 'p#fechaLimite-error' })).toBeTruthy();
    escribir('Fecha límite', '2020-01-01');
    expect(screen.queryByText(/formato AAAA-MM-DD y ser una fecha real/)).toBeNull();
  });

  it('máscara: con solo números el campo queda en AAAA-MM-DD', () => {
    render(<FormularioTarea />);
    const campo = screen.getByLabelText('Fecha límite') as HTMLInputElement;
    escribir('Fecha límite', '20990');
    expect(campo.value).toBe('2099-0');
    escribir('Fecha límite', '20990210');
    expect(campo.value).toBe('2099-02-10');
    escribir('Fecha límite', '20260230');
    fireEvent.blur(campo);
    expect(campo.value).toBe('2026-02-30');
    expect(screen.getByText('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.')).toBeTruthy();
  });

  it('una fecha pasada muestra un aviso, pero se puede guardar (RN-07)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => respuesta({ ok: true, datos: { id: '1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);
    render(<FormularioTarea />);
    escribir('Título', 'Pagar luz');
    escribir('Fecha límite', '2099-01-01');
    expect(screen.queryByText(/Esta fecha ya pasó/)).toBeNull();
    escribir('Fecha límite', '2020-01-01');
    expect(screen.getByText(/Esta fecha ya pasó/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/nova/tareas'));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).fechaLimite).toBe('2020-01-01');
  });

  it('un título en blanco muestra error y al enviar no llama al servidor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<FormularioTarea />);
    escribir('Título', '   ');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(screen.getByText('El título es obligatorio.')).toBeTruthy();
    expect(screen.getByText('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía los datos normalizados y navega a /nova/tareas', async () => {
    const fetchMock = vi.fn().mockImplementation(() => respuesta({ ok: true, datos: { id: '1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);
    render(<FormularioTarea />);
    escribir('Título', '  Renovar pasaporte  ');
    escribir('Prioridad', '3');
    escribir('Fecha límite', '2026-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/nova/tareas'));
    expect(fetchMock).toHaveBeenCalledWith('/api/nova/tareas', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
      titulo: 'Renovar pasaporte',
      categoria: 'General',
      prioridad: 3,
      fechaLimite: '2026-03-10',
      horaInicio: null,
      horaFin: null,
    });
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('muestra el mensaje del servidor si rechaza la tarea y no navega', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        respuesta({ ok: false, error: { codigo: 'PRIORIDAD_INVALIDA', mensaje: 'La prioridad debe ser 1, 2 o 3' } }, 422),
      ),
    );
    render(<FormularioTarea />);
    escribir('Título', 'Pagar luz');
    escribir('Fecha límite', '2026-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));

    expect(await screen.findByText('La prioridad debe ser 1, 2 o 3')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar tarea' }).hasAttribute('disabled')).toBe(false);
  });

  it('si no hay conexión muestra un aviso y deja reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<FormularioTarea />);
    escribir('Título', 'Pagar luz');
    escribir('Fecha límite', '2026-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
