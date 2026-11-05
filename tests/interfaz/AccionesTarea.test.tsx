import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

import { AccionesTarea } from '@/components/nova/AccionesTarea';

const ID = '11111111-1111-4111-8111-111111111111';
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const montar = (completada = false) =>
  render(<AccionesTarea id={ID} titulo="Pagar luz" completada={completada} prefijo="tabla" />);

describe('AccionesTarea', () => {
  beforeEach(() => nav.refresh.mockReset());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('una tarea completada no ofrece Completar, pero sí Eliminar', () => {
    montar(true);
    expect(screen.queryByRole('button', { name: 'Completar tarea: Pagar luz' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Eliminar tarea: Pagar luz' })).toBeTruthy();
  });

  it('completar envía los minutos y refresca la lista', async () => {
    const f = vi.fn().mockResolvedValue(responder({ ok: true, datos: {} }));
    vi.stubGlobal('fetch', f);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Completar tarea: Pagar luz' }));
    fireEvent.change(screen.getByLabelText('Minutos dedicados'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe(`/api/nova/tareas/${ID}/completar`);
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ minutos: 45 });
  });

  it('minutos no válidos deshabilitan Confirmar y no llaman al servidor', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Completar tarea: Pagar luz' }));
    fireEvent.change(screen.getByLabelText('Minutos dedicados'), { target: { value: '-5' } });
    expect(screen.getByText('Escriba un número entero de 0 en adelante.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled')).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación antes de llamar al servidor', async () => {
    const f = vi.fn().mockResolvedValue(responder({ ok: true, datos: { id: ID } }));
    vi.stubGlobal('fetch', f);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar tarea: Pagar luz' }));
    expect(f).not.toHaveBeenCalled();
    expect(screen.getByText('¿Eliminar esta tarea? No se puede deshacer.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith(`/api/nova/tareas/${ID}`, { method: 'DELETE' });
  });

  it('cancelar la eliminación no llama al servidor', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar tarea: Pagar luz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Eliminar tarea: Pagar luz' })).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('muestra el mensaje del servidor si rechaza la acción y no refresca', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(responder({ ok: false, error: { mensaje: 'La tarea ya está completada.' } }, 409)),
    );
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Completar tarea: Pagar luz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('La tarea ya está completada.')).toBeTruthy();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
